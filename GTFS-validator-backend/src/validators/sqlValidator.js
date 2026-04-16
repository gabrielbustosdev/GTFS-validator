import pool from '../db/client.js';
import { getJobSchemaName } from '../db/schemaManager.js';
import { runDataIntegrityValidations } from './dataIntegrityValidations.js';

/**
 * Se conecta a la base temporal y realiza todas las validaciones de negocio GTFS nativamente.
 */
export async function runSqlValidations(jobId) {
  const schema = getJobSchemaName(jobId);
  const client = await pool.connect();
  
  let results = {
     errors: 0,
     warnings: 0,
     details: [],
     agencies: [],
     feed_validity: { start: null, end: null },
     stats: {
        total_stops: 0,
        total_trips: 0,
        total_routes: 0,
        total_shapes: 0,
        total_agencies: 0
     }
  };

  try {
     console.log(`[Job ${jobId}] Ejecutando Validaciones de Negocio Profundas...`);

     // --- 1. METADATOS: Agencias ---
     const agencyRes = await client.query(`SELECT agency_id, agency_name, agency_url, agency_phone FROM "${schema}".agency`);
     results.agencies = agencyRes.rows;
     results.stats.total_agencies = agencyRes.rows.length;

     // --- 2. METADATOS: Validez del Feed (Rango de fechas) ---
     const dateBounds = await client.query(`
        SELECT 
          MIN(min_date) as start_date, 
          MAX(max_date) as end_date
        FROM (
          SELECT MIN(start_date) as min_date, MAX(end_date) as max_date FROM "${schema}".calendar
          UNION ALL
          SELECT MIN(date) as min_date, MAX(date) as max_date FROM "${schema}".calendar_dates
        ) as combined
     `);
     results.feed_validity.start = dateBounds.rows[0].start_date;
     results.feed_validity.end = dateBounds.rows[0].end_date;

     // --- 3. VALIDACIÓN: Calendario Expirado ---
     if (results.feed_validity.end) {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        if (results.feed_validity.end < today) {
           results.warnings++;
           results.details.push({
              rule_id: 'expired_calendar',
              severity: 'warning',
              message: `El feed GTFS parece haber expirado. La última fecha de servicio detectada es ${results.feed_validity.end}.`
           });
        }
     }

     // --- 4. VALIDACIÓN: Integridad Estructural y Calidad (Nueva importación) ---
     const integrityResults = await runDataIntegrityValidations(client, schema);
     results.errors += integrityResults.errors;
     results.warnings += integrityResults.warnings;
     results.details.push(...integrityResults.details);

     // --- 5. VALIDACIÓN: GIS (Coordenadas 0,0) ---
     const zeroCoords = await client.query(`SELECT COUNT(*) as count FROM "${schema}".stops WHERE stop_lat = 0 OR stop_lon = 0 OR stop_lat IS NULL`);
     const zero_coords = parseInt(zeroCoords.rows[0].count, 10);
     if (zero_coords > 0) {
        results.warnings++;
        results.details.push({
           rule_id: 'gis_error',
           severity: 'warning',
           message: `GIS: Se encontraron ${zero_coords} paradas con coordenadas nulas o en (0,0).`
        });
     }

     // --- 6. VALIDACIÓN: Enums inválidos ---
     const invalidEnums = await client.query(`
        SELECT COUNT(*) as count FROM "${schema}".stops WHERE location_type NOT IN (0, 1, 2, 3, 4)
     `);
     const inv_enums = parseInt(invalidEnums.rows[0].count, 10);
     if (inv_enums > 0) {
        results.warnings++;
        results.details.push({
           rule_id: 'invalid_enum',
           severity: 'warning',
           message: `SCHEMA: Hay ${inv_enums} registros en stops.txt con un location_type fuera de rango.`
        });
     }

     // --- 7. ESTADISTICAS: Conteos finales ---
     const counts = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM "${schema}".stops) as stops,
          (SELECT COUNT(*) FROM "${schema}".trips) as trips,
          (SELECT COUNT(*) FROM "${schema}".routes) as routes,
          (SELECT COUNT(DISTINCT shape_id) FROM "${schema}".shapes) as shapes
     `);
     
     results.stats.total_stops = parseInt(counts.rows[0].stops, 10);
     results.stats.total_trips = parseInt(counts.rows[0].trips, 10);
     results.stats.total_routes = parseInt(counts.rows[0].routes, 10);
     results.stats.total_shapes = parseInt(counts.rows[0].shapes, 10);

     // --- 8. GUARDADO: Almacenar los resultados en la Base de Datos  ---
     await client.query(`
       CREATE TABLE IF NOT EXISTS "${schema}".validation_report (
         id serial PRIMARY KEY,
         created_at timestamp DEFAULT now(),
         report_data jsonb
       )
     `);

     await client.query(
       `INSERT INTO "${schema}".validation_report (report_data) VALUES ($1)`,
       [JSON.stringify(results)]
     );

     return results;
  } catch (err) {
     console.error(`[Job ${jobId}] Fallo ejecutando SQL GIS:`, err);
     throw err;
  } finally {
     client.release();
  }
}

export async function getMapStops(schema, routeId = null, onlyIssues = false) {
  const client = await pool.connect();
  try {
     let queryParams = [];
     let routeJoin = `LEFT JOIN "${schema}".stop_times st ON s.stop_id = st.stop_id LEFT JOIN "${schema}".trips t ON st.trip_id = t.trip_id LEFT JOIN "${schema}".routes r ON t.route_id = r.route_id`;
     let routeFilter = '';
     
     if (routeId) {
       queryParams.push(routeId);
       routeFilter = `AND t.route_id = $${queryParams.length}`;
       // If filtering by route, we need an INNER JOIN to drop stops not on this route
       routeJoin = `JOIN "${schema}".stop_times st ON s.stop_id = st.stop_id JOIN "${schema}".trips t ON st.trip_id = t.trip_id JOIN "${schema}".routes r ON t.route_id = r.route_id`;
     }

     const geoRes = await client.query(`
         SELECT 
           s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
           COALESCE(s.stop_desc, '') as stop_desc,
           COALESCE(s.stop_url, '') as stop_url,
           s.location_type,
           STRING_AGG(DISTINCT t.route_id, ',') as route_ids,
           STRING_AGG(DISTINCT r.route_short_name, ',') as route_names,
           STRING_AGG(DISTINCT t.route_id || ':' || t.direction_id, ',') as route_directions,
           COUNT(DISTINCT t.route_id) as route_count,
           CASE 
             WHEN (s.stop_lat = 0 OR s.stop_lon = 0 OR s.stop_lat IS NULL OR s.location_type NOT IN (0,1,2,3,4)) THEN true 
             ELSE false 
           END as has_issue
         FROM "${schema}".stops s
         ${routeJoin}
         WHERE s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
         ${routeFilter}
         GROUP BY s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.stop_desc, s.stop_url, s.location_type
         ${onlyIssues ? `HAVING BOOL_OR(CASE WHEN (s.stop_lat = 0 OR s.stop_lon = 0 OR s.stop_lat IS NULL OR s.location_type NOT IN (0,1,2,3,4)) THEN true ELSE false END)` : ''}
      `, queryParams);

     return {
        type: 'FeatureCollection',
        features: geoRes.rows.map(r => ({
           type: 'Feature',
           geometry: {
              type: 'Point',
              coordinates: [parseFloat(r.stop_lon), parseFloat(r.stop_lat)]
           },
           properties: {
              stop_id: r.stop_id,
              stop_name: r.stop_name,
              stop_desc: r.stop_desc,
              stop_url: r.stop_url,
              location_type: parseInt(r.location_type || 0, 10),
              route_ids: r.route_ids ? r.route_ids.split(',') : [],
              route_names: r.route_names ? r.route_names.split(',') : [],
              route_directions: r.route_directions ? r.route_directions.split(',') : [],
              route_count: parseInt(r.route_count || 0, 10),
              has_issue: r.has_issue
           }
        }))
     };
  } finally {
     client.release();
  }
}

export async function getMapShapes(schema, routeId = null) {
  const client = await pool.connect();
  try {
     let queryParams = [];
     let routeFilter = '';
     
     if (routeId) {
       queryParams.push(routeId);
       routeFilter = `WHERE t.route_id = $${queryParams.length}`;
     }

     const shapeRes = await client.query(`
        WITH route_direction_shapes AS (
           SELECT DISTINCT ON (t.route_id, t.direction_id, t.shape_id)
             t.route_id,
             t.direction_id,
             r.route_short_name,
             r.route_color,
             s.shape_id
           FROM "${schema}".shapes s
           JOIN "${schema}".trips t ON s.shape_id = t.shape_id
           JOIN "${schema}".routes r ON t.route_id = r.route_id
           ${routeFilter}
        )
        SELECT 
          rs.*,
          ST_AsGeoJSON(ST_MakeLine(s.geom ORDER BY s.shape_pt_sequence)) as geojson
        FROM route_direction_shapes rs
        JOIN "${schema}".shapes s ON rs.shape_id = s.shape_id
        GROUP BY rs.route_id, rs.direction_id, rs.route_short_name, rs.route_color, rs.shape_id
     `, queryParams);

     return {
        type: 'FeatureCollection',
        features: shapeRes.rows.map(r => ({
           type: 'Feature',
           geometry: JSON.parse(r.geojson),
           properties: {
              shape_id: r.shape_id,
              route_id: r.route_id,
              direction_id: r.direction_id,
              route_name: `${r.route_short_name || 'Ruta'} (${r.direction_id === 0 ? 'Ida' : 'Vuelta'})`,
              route_color: r.route_color ? `#${r.route_color}` : '#3b82f6',
              filter_id: `${r.route_id}:${r.direction_id}`
           }
        }))
     };
  } finally {
     client.release();
  }
}

export async function getGtfsRoutes(schema) {
  const client = await pool.connect();
  try {
     const routesRes = await client.query(`
         SELECT DISTINCT 
           t.route_id, 
           r.route_short_name, 
           r.route_long_name, 
           r.route_color,
           r.route_type,
           COALESCE(r.agency_id, 'default') as agency_id,
           t.direction_id
         FROM "${schema}".routes r
         JOIN "${schema}".trips t ON r.route_id = t.route_id
         ORDER BY agency_id ASC, r.route_short_name ASC, t.direction_id ASC
      `);
     
     return routesRes.rows.map(r => {
        const name = r.route_short_name || r.route_long_name || r.route_id;
        const direction = r.direction_id === 0 ? 'Ida' : 'Vuelta';
        return {
           id: `${r.route_id}:${r.direction_id}`,
           name: `${name} - ${direction}`,
           short_name: r.route_short_name || r.route_id,
           long_name: r.route_long_name || '',
           route_id: r.route_id,
           direction_id: r.direction_id,
           agency_id: r.agency_id,
           route_type: parseInt(r.route_type || 3, 10),
           color: r.route_color ? `#${r.route_color}` : null
        };
     });
  } finally {
     client.release();
  }
}
