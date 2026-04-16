import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { addValidationJob, gtfsQueue } from '../queue/jobQueue.js';
import path from 'path';
import fs from 'fs';
import pool from '../db/client.js';
import { runSqlValidations, getMapStops, getMapShapes, getGtfsRoutes } from '../validators/sqlValidator.js';
import { getJobSchemaName } from '../db/schemaManager.js';

const router = express.Router();

// Configuración de Multer para guardar el ZIP temporalmente
const tempDir = path.resolve('./temp_uploads');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    // Para identificar univocamente el upload, creamos un name con uuid
    cb(null, `${uuidv4()}.zip`);
  }
});
const upload = multer({ storage });

/**
 * POST /api/validate
 * Recibe el ZIP y encola la validación.
 */
router.post('/validate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes enviar un archivo ZIP bajo la key "file".' });
    }

    // Ruta absoluta del archivo guardado
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // Encolamos en Redis a través de BullMQ
    const jobId = await addValidationJob(filePath, originalName);

    return res.status(202).json({
      message: 'Validación encolada exitosamente.',
      jobId,
      status: 'queued'
    });

  } catch (error) {
    console.error('Error en POST /validate:', error);
    return res.status(500).json({ error: 'Error interno encolando trabajo.' });
  }
});

/**
 * GET /api/validate/:id
 * Evalúa el progreso del Worker a través de BullMQ.
 * Si el trabajo no está en memoria/Redis, lee los esquemas existentes desde la BD y reconstruye la data.
 */
router.get('/validate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await gtfsQueue.getJob(id);

    // Si el trabajo figura en memoria (BullMQ) usamos esa informacion básica de estado
    if (job) {
      const state = await job.getState();     // active, completed, failed, waiting 
      const progress = job.progress || 0;     // numero u objeto enviado por el worker
      let returnValue = job.returnvalue;    // Resultado final si terminó
      const failedReason = job.failedReason;  // Error si falló

      // Mapear el estado interno de BullMQ al "status" que entiende el Frontend
      let status = state;
      if (state === 'active') status = 'processing';
      if (state === 'waiting') status = 'queued';
      if (state === 'failed') status = 'error';

      // Si está completado, consultamos en la Base de Datos el reporte real en lugar del returnvalue pesado
      if (status === 'completed') {
        const schema = getJobSchemaName(id);
        try {
           const reportResult = await pool.query(`SELECT report_data FROM "${schema}".validation_report ORDER BY id DESC LIMIT 1`);
           if (reportResult.rows.length > 0) {
              const dbReport = reportResult.rows[0].report_data;
              returnValue = {
                 success: true,
                 summary: { 
                    errors: dbReport.errors, 
                    warnings: dbReport.warnings, 
                    stats: dbReport.stats 
                 },
                 agencies: dbReport.agencies || [],
                 feed_validity: dbReport.feed_validity || { start: null, end: null },
                 issues: dbReport.details,
                 // Dejamos routes, stops y shapes vacios porque el frontend ahora los buscará con fetch
                 routes: [],
                 stops_geojson: null,
                 shapes_geojson: null
              };
           }
        } catch(e) {
             console.error('Error al leer validation_report', e);
        }
      }

      return res.json({
        jobId: id,
        status, 
        state,  
        progress,
        result: returnValue || null,
        error: failedReason || null
      });
    }

    // Si NO está en BullMQ (ej. expiró en cache de Redis, o servidor reiniciado), chequeamos la Base de Datos directamente!
    const schema_formatted = getJobSchemaName(id);
    const schemaQuery = await pool.query(
      `SELECT schema_name, original_name FROM public.gtfs_schema_registry WHERE schema_name = $1`, 
      [schema_formatted]
    );

    if (schemaQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Trabajo y/o esquema no encontrado en cache ni en la base de datos.' });
    }

    // ¡El esquema existe en la BD! Verificamos si tiene reporte consolidado (para no reconstruir el runSqlValidations de 0)
    let reconstructedResult = null;
    const schemaName = schemaQuery.rows[0].schema_name;
    
    try {
      const reportRes = await pool.query(`SELECT report_data FROM "${schemaName}".validation_report ORDER BY id DESC LIMIT 1`);
      if (reportRes.rows.length > 0) {
         const dbReport = reportRes.rows[0].report_data;
         reconstructedResult = {
           success: true,
           summary: { 
              errors: dbReport.errors, 
              warnings: dbReport.warnings, 
              stats: dbReport.stats 
           },
           agencies: dbReport.agencies || [],
           feed_validity: dbReport.feed_validity || { start: null, end: null },
           issues: dbReport.details,
           routes: [],
           stops_geojson: null,
           shapes_geojson: null
         };
      }
    } catch(err) { console.error('No se encontro tabla de validation_report, posiblemente el job no haya terminado'); }

    // Si por algun motivo no existe el reporte pero el schema si, podríamos intentar reejecutar (no es lo ideal)
    if (!reconstructedResult) {
       console.log(`[API] Reconstruyendo reporte dinámico leyendo la BD para schema: ${schemaName}...`);
       const report = await runSqlValidations(id);
       reconstructedResult = {
         success: true,
         summary: { 
            errors: report.errors, 
            warnings: report.warnings, 
            stats: report.stats 
         },
         agencies: report.agencies || [],
         feed_validity: report.feed_validity || { start: null, end: null },
         issues: report.details,
         routes: [],
         stops_geojson: null,
         shapes_geojson: null,
       };
    }

    return res.json({
      jobId: id,
      status: 'completed', // Forzado porque existe un esquema consolidado
      progress: 100,
      result: reconstructedResult,
      error: null
    });

  } catch (err) {
    console.error('Error consultando status o reconstruyendo BD:', err);
    res.status(500).json({ error: 'Error del servidor consultando estado.' });
  }
});

/**
 * GET /api/gtfs/:jobId/stops
 * Retorna el GeoJSON de las paradas
 */
router.get('/gtfs/:jobId/stops', async (req, res) => {
   try {
      const schema = getJobSchemaName(req.params.jobId);
      const routeId = req.query.route_id || null;
      const onlyIssues = req.query.only_issues === 'true';
      const geojson = await getMapStops(schema, routeId, onlyIssues);
      return res.json(geojson);
   } catch(err) {
      console.error(err);
      res.status(500).json({ error: 'No se pudo generar GeoJSON de Stops via PostGIS.' });
   }
});

/**
 * GET /api/gtfs/:jobId/shapes
 * Retorna el GeoJSON de los recorridos vectoriales
 */
router.get('/gtfs/:jobId/shapes', async (req, res) => {
   try {
      const schema = getJobSchemaName(req.params.jobId);
      const routeId = req.query.route_id || null;
      const geojson = await getMapShapes(schema, routeId);
      return res.json(geojson);
   } catch(err) {
      console.error(err);
      res.status(500).json({ error: 'No se pudo generar GeoJSON de Shapes via PostGIS.' });
   }
});

/**
 * GET /api/gtfs/:jobId/routes
 * Retorna metadatos ligeros de todas las rutas 
 */
router.get('/gtfs/:jobId/routes', async (req, res) => {
   try {
      const schema = getJobSchemaName(req.params.jobId);
      const routes = await getGtfsRoutes(schema);
      return res.json(routes);
   } catch(err) {
      console.error(err);
      res.status(500).json({ error: 'No se pudo obtener listado de rutas via PostGIS.' });
   }
});

/**
 * GET /api/history
 * Obtiene la lista de esquemas desde el gestor de estado POSTGIS.
 */
router.get('/history', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT schema_name, original_name, created_at
      FROM public.gtfs_schema_registry
      ORDER BY created_at DESC
    `);
    
    // El frontend espera: jobId, originalName, finishedOn
    const history = rows.map(row => {
      // Extraemos uuid del schema_name (job_xxxx)
      const jobId = row.schema_name.replace('job_', '');
      let cleanName = row.original_name;
      // Compatibilidad hacia atrás si faltaba original_name
      if (!cleanName || cleanName === 'Unknown Dataset') {
        cleanName = `Reporte guardado (${row.schema_name})`;
      }

      return {
        jobId,
        originalName: cleanName,
        finishedOn: row.created_at
      };
    });

    return res.json(history);
  } catch (err) {
    console.error('Error consultando historial desde DB:', err);
    res.status(500).json({ error: 'Error del servidor consultando historial en BD.' });
  }
});

export default router;
