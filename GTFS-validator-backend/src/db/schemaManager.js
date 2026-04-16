import pool from './client.js';

/**
 * Normaliza el jobId para que sea un nombre de schema PostgreSQL válido
 * (minúsculas, guiones bajos, sin espacios)
 * @param {string} jobId 
 * @returns {string} nombre del esquema
 */
export function getJobSchemaName(jobId) {
  const sanitized = jobId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `job_${sanitized}`;
}

export async function createDynamicSchema(jobId) {
  const schemaName = getJobSchemaName(jobId);
  const client = await pool.connect();

  try {
    // 1. Crear schema dinámico
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    console.log(`[DB] Creado schema "${schemaName}"`);

    // 2. Crear las tablas principales de GTFS dentro de ese schema
    // NOTA: No declaramos Foreign Keys para permitir la ingesta rapida con COPY.
    // La validez de las relaciones (integridad) se probará lógicamente después con queries SQL.
    
    await client.query(`
      CREATE TABLE "${schemaName}".agency (
        agency_id text,
        agency_name text,
        agency_url text,
        agency_timezone text,
        agency_lang text,
        agency_phone text,
        agency_fare_url text,
        agency_email text
      );

      CREATE TABLE "${schemaName}".stops (
        stop_id text,
        stop_code text,
        stop_name text,
        stop_desc text,
        stop_lat double precision,
        stop_lon double precision,
        zone_id text,
        stop_url text,
        location_type int,
        parent_station text,
        stop_timezone text,
        wheelchair_boarding int,
        geom GEOMETRY(Point, 4326) -- Columna espacial PostGIS para validaciones avanzadas
      );

      CREATE TABLE "${schemaName}".routes (
        route_id text,
        agency_id text,
        route_short_name text,
        route_long_name text,
        route_desc text,
        route_type int,
        route_url text,
        route_color text,
        route_text_color text,
        route_sort_order int
      );

      CREATE TABLE "${schemaName}".trips (
        route_id text,
        service_id text,
        trip_id text,
        trip_headsign text,
        trip_short_name text,
        direction_id int,
        block_id text,
        shape_id text,
        wheelchair_accessible int,
        bikes_allowed int
      );

      CREATE TABLE "${schemaName}".stop_times (
        trip_id text,
        arrival_time text,
        departure_time text,
        stop_id text,
        stop_sequence int,
        stop_headsign text,
        pickup_type int,
        drop_off_type int,
        shape_dist_traveled double precision,
        timepoint int
      );

      CREATE TABLE "${schemaName}".calendar (
        service_id text,
        monday int,
        tuesday int,
        wednesday int,
        thursday int,
        friday int,
        saturday int,
        sunday int,
        start_date text,
        end_date text
      );

      CREATE TABLE "${schemaName}".calendar_dates (
        service_id text,
        date text,
        exception_type int
      );

      CREATE TABLE "${schemaName}".shapes (
        shape_id text,
        shape_pt_lat double precision,
        shape_pt_lon double precision,
        shape_pt_sequence int,
        shape_dist_traveled double precision,
        geom GEOMETRY(Point, 4326) -- Punto del trayecto
      );

      CREATE TABLE "${schemaName}".feed_info (
        feed_publisher_name text,
        feed_publisher_url text,
        feed_lang text,
        feed_start_date text,
        feed_end_date text,
        feed_version text,
        feed_contact_email text,
        feed_contact_url text
      );

      CREATE TABLE "${schemaName}".fare_attributes (
        fare_id text,
        price double precision,
        currency_type text,
        payment_method int,
        transfers int,
        agency_id text,
        transfer_duration int
      );

      CREATE TABLE "${schemaName}".fare_rules (
        fare_id text,
        route_id text,
        origin_id text,
        destination_id text,
        contains_id text
      );

      CREATE TABLE "${schemaName}".validation_report (
        id serial PRIMARY KEY,
        created_at timestamp DEFAULT now(),
        report_data jsonb
      );
    `);
    
    console.log(`[DB] Tablas GTFS creadas en "${schemaName}"`);

  } catch (error) {
    console.error(`[DB] Error al construir el Schema ${schemaName}:`, error);
    // Intentar limpiar en caso de fallo parcial
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } catch(e) {}
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeRegistry() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.gtfs_schema_registry (
        schema_name text PRIMARY KEY,
        created_at timestamp with time zone DEFAULT now()
      );
    `);
    
    // Ensure original_name exists for backward compatibility
    await pool.query(`
      ALTER TABLE public.gtfs_schema_registry 
      ADD COLUMN IF NOT EXISTS original_name text;
    `);
  } catch (err) {
    console.error('[DB] Error inicializando registro de schemas:', err);
  }
}

export async function registerSchema(jobId, originalName = 'Unknown Dataset') {
  const schemaName = getJobSchemaName(jobId);
  try {
    await pool.query(
      `INSERT INTO public.gtfs_schema_registry (schema_name, original_name) 
       VALUES ($1, $2) 
       ON CONFLICT (schema_name) DO UPDATE SET 
        created_at = now(),
        original_name = $2`,
      [schemaName, originalName]
    );
  } catch (err) {
    console.error(`[DB] Fallo al registrar schema ${schemaName}:`, err);
  }
}

export async function cleanupExpiredSchemas(maxAgeMs = 3600000) { // 1 hora por defecto
  try {
    const res = await pool.query(
      `SELECT schema_name FROM public.gtfs_schema_registry WHERE created_at < now() - interval '1 millisecond' * $1`,
      [maxAgeMs]
    );

    for (const row of res.rows) {
      const s = row.schema_name;
      console.log(`[DB] 🧹 Limpiando schema expirado: ${s}...`);
      await pool.query(`DROP SCHEMA IF EXISTS "${s}" CASCADE`);
      await pool.query(`DELETE FROM public.gtfs_schema_registry WHERE schema_name = $1`, [s]);
    }
  } catch (err) {
    console.error('[DB] Error en la limpieza de schemas:', err);
  }
}

export async function dropDynamicSchema(jobId) {
  const schemaName = getJobSchemaName(jobId);
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`DELETE FROM public.gtfs_schema_registry WHERE schema_name = $1`, [schemaName]);
    console.log(`[DB] Eliminado schema temporal "${schemaName}"`);
  } catch (err) {
    console.error(`[DB] Error limpiando el Schema ${schemaName}:`, err);
  }
}
