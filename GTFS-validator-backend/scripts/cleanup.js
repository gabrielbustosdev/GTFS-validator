import pool from '../src/db/client.js';

/**
 * Script de utilidad para limpiar manualmente todos los esquemas temporales
 * creados por el validador (job_*) y vaciar el registro de schemas.
 */
async function nukeSchemas() {
  console.log('🚀 Iniciando limpieza manual de base de datos...');
  
  const client = await pool.connect();
  try {
    // 1. Buscar todos los esquemas que empiecen con job_
    const res = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'job_%'
    `);

    const schemas = res.rows.map(r => r.schema_name);

    if (schemas.length === 0) {
      console.log('✨ No se encontraron esquemas temporales que limpiar.');
    } else {
      for (const schema of schemas) {
        console.log(`🗑️ Eliminando esquema: ${schema}...`);
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      }
      console.log(`✅ Se eliminaron ${schemas.length} esquemas.`);
    }

    // 2. Limpiar la tabla de registro
    console.log('🧹 Vaciando registro de schemas...');
    await client.query('TRUNCATE TABLE public.gtfs_schema_registry RESTART IDENTITY');
    console.log('✅ Registro limpiado.');

  } catch (err) {
    console.error('❌ Error durante la limpieza:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

nukeSchemas();
