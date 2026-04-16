import { 
  createDynamicSchema, 
  dropDynamicSchema, 
  getJobSchemaName,
  initializeRegistry,
  registerSchema,
  cleanupExpiredSchemas 
} from '../db/schemaManager.js';
import { ingestGtfsFromZip } from '../db/ingest.js';
import { runSqlValidations } from '../validators/sqlValidator.js';
import fs from 'fs/promises';

/**
 * Función principal que orquesta la Ingesta masiva y las Validaciones
 * Procesa un archivo GTFS:
 * 1. Crea schema PostGIS
 * 2. Ingesta data mediante streams
 * 3. Ejecuta validaciones SQL
 * 4. Limpia archivos
 */
export async function processJob(job) {
  const { id: jobId, data } = job;
  const { filePath, originalName } = data;

  console.log(`\n==============================================`);
  console.log(`[Job ${jobId}] ⬇️ Recibido: ${originalName}`);

  // Ayudante para el retardo artificial (UX)
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    // 0. Auto-limpieza y Configuración
    await initializeRegistry();
    await cleanupExpiredSchemas(); // Borra lo que tenga > 1 hora de antigüedad

    // 1. Preparación de Base de Datos
    console.log(`[Job ${jobId}] 🛠️ Preparando entorno de base de datos...`);
    await job.updateProgress({ step: 'Iniciando conexión con PostGIS...', percent: 5 });
    await delay(500);
    await createDynamicSchema(jobId);
    await registerSchema(jobId, originalName); // Registramos para que el sistema sepa cuándo borrarlo
    await job.updateProgress({ step: 'Entorno listo.', percent: 10 });

    // 2. Ingesta (10% - 60%)
    console.log(`[Job ${jobId}] Iniciando streaming de ${originalName} a Supabase...`);
    await ingestGtfsFromZip(jobId, filePath, async (meta) => {
        // Normalizamos el progreso de ingesta al rango 10-60%
        const normalizedPercent = 10 + Math.round((meta.percent / 100) * 50);
        await job.updateProgress({ ...meta, percent: normalizedPercent });
    });
    
    await delay(500);

    // 3. Validaciones 
    await job.updateProgress({ step: 'Verificando integridad referencial...', percent: 65 });
    await delay(800);
    
    await job.updateProgress({ step: 'Ejecutando algoritmos SQL/GIS especializados...', percent: 80 });
    const report = await runSqlValidations(jobId);
    await delay(800);

    // 4. Compilar Resultados
    await job.updateProgress({ step: 'Consolidando reporte final...', percent: 95 });
    await delay(500);
    await job.updateProgress({ step: 'Validación completada con éxito.', percent: 100 });
    await delay(300);
    
    return {
      success: true,
      message: 'Validación completada. Reporte y datos espaciales se encuentran disponibles en la Base de Datos.',
      summary: { 
         errors: report.errors, 
         warnings: report.warnings, 
         stats: report.stats 
      }
    };

  } catch (error) {
    console.error(`[Job ${jobId}] Error general:`, error);
    throw error;
  } finally {
    await job.updateProgress({ step: 'Finalizando proceso', percent: 100 });
    try { await fs.unlink(filePath); } catch (ignore) { }

    // Ya no borramos el schema aquí para permitir visualización en el mapa (Persistencia TTL)
    console.log(`[Job ${jobId}] 💾 El esquema se mantendrá disponible para exploración visual (TTL 1h).`);
    console.log(`==============================================\n`);
  }
}
