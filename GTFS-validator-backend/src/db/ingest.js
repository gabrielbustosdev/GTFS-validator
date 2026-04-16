import { from as copyFrom } from 'pg-copy-streams';
import unzipper from 'unzipper';
import { pipeline } from 'stream/promises';
import pool from './client.js';
import { getJobSchemaName } from './schemaManager.js';

const ALLOWED_FILES = [
  'agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 
  'stop_times.txt', 'calendar.txt', 'shapes.txt',
  'calendar_dates.txt', 'feed_info.txt', 'fare_attributes.txt', 'fare_rules.txt'
];

/**
 * Lee los primeros bytes de un stream transaccional para extraer los nombres de columna,
 * y luego devuelve los datos al stream (unshift) para que postgres copie la data de forma limpia.
 */
function extractHeaderAndUnshift(stream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    
    function cleanup() {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    }

    function parseHeader(text) {
      const line = text.split('\n')[0].trim();
      const clean = line.replace(/^\uFEFF/, '').replace(/\r/g, ''); // Limpiar Byte Order Mark
      return clean.split(',').map(c => `"${c.trim()}"`);
    }

    function onData(chunk) {
      buffer += chunk.toString('utf8');
      const newlineIdx = buffer.indexOf('\n');
      
      if (newlineIdx !== -1) {
        cleanup();
        stream.pause(); // Congelar el flujo
        stream.unshift(Buffer.from(buffer, 'utf8')); // Reinsertar lo consumido
        resolve(parseHeader(buffer));
      }
    }

    function onEnd() {
      cleanup();
      stream.unshift(Buffer.from(buffer, 'utf8'));
      resolve(parseHeader(buffer));
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}

export async function ingestGtfsFromZip(jobId, zipFilePath, updateProgressFn) {
  const schemaName = getJobSchemaName(jobId);
  const directory = await unzipper.Open.file(zipFilePath);
  
  const filesToProcess = directory.files.filter(f => ALLOWED_FILES.includes(f.path));
  if (filesToProcess.length === 0) {
    throw new Error('El ZIP no contiene archivos GTFS válidos esperados.');
  }

  console.log(`[Job ${jobId}] Iniciando COPY Dinámico de ${filesToProcess.length} archivos`);

  for (let i = 0; i < filesToProcess.length; i++) {
    const entry = filesToProcess[i];
    const fileName = entry.path;
    const tableName = fileName.replace('.txt', '');
    
    if (updateProgressFn) {
       const progress = 10 + Math.round((i / filesToProcess.length) * 50); 
       await updateProgressFn({ step: `Insertando ${fileName} (${i+1}/${filesToProcess.length})`, percent: progress });
    }

    const client = await pool.connect();
    
    try {
      const fileStream = entry.stream();
      
      // 1. Extraer dinámicamente las columnas de este archivo sin destruir el Stream
      const columns = await extractHeaderAndUnshift(fileStream);
      const columnsString = columns.join(',');
      
      // 2. Mapear las columnas directamente al comando COPY de Postgres
      const query = `COPY "${schemaName}".${tableName} (${columnsString}) FROM STDIN WITH (FORMAT CSV, HEADER true, ENCODING 'UTF8')`;
      
      const ingestStream = client.query(copyFrom(query));
      await pipeline(fileStream, ingestStream);
      
      console.log(`✅ [Job ${jobId}] Tabla ${tableName} completada (Mapeadas ${columns.length} cols)`);
    } catch (err) {
      console.error(`[Job ${jobId}] Error en ${fileName}:`, err?.message);
      throw err;
    } finally {
      client.release();
    }
  }

  if (filesToProcess.find(f => f.path === 'stops.txt')) {
     if (updateProgressFn) await updateProgressFn({ step: 'Optimizando PostGIS...', percent: 65 });
     await createGeometries(jobId);
  }
}

async function createGeometries(jobId) {
  const schema = getJobSchemaName(jobId);
  let client;
  try {
     client = await pool.connect();
     await client.query(`
        UPDATE "${schema}".stops 
        SET geom = ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
        WHERE stop_lon IS NOT NULL AND stop_lat IS NOT NULL;

        UPDATE "${schema}".shapes
        SET geom = ST_SetSRID(ST_MakePoint(shape_pt_lon, shape_pt_lat), 4326)
        WHERE shape_pt_lon IS NOT NULL AND shape_pt_lat IS NOT NULL;
     `);
     console.log(`🌍 [Job ${jobId}] Geometrías PostGIS procesadas.`);
  } catch(e) { 
  } finally {
     if (client) client.release();
  }
}
