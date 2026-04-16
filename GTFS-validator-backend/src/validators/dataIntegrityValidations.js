/**
 * Módulo que contiene las validaciones de negocio y calidad de datos para GTFS.
 * Estas validaciones buscan asegurar la integridad referencial y advertir sobre
 * anomalías estructurales (datos sin uso o mal vinculados) que afectan el análisis.
 */

export async function runDataIntegrityValidations(client, schema) {
  let errors = 0;
  let warnings = 0;
  let details = [];

  // =========================================================================
  // 1. stop_times sin stop asociado (Paradas Huérfanas Ocultas)
  // =========================================================================
  // [CRÍTICO] Todo horario de parada debe apuntar a una parada real que exista
  // en stops.txt. Si este registro no existe, el sistema no sabrá las coordenadas 
  // ni la ubicación de donde ocurrió la acción del pasajero.
  const stopOrphans = await client.query(`
    SELECT COUNT(*) as count 
    FROM "${schema}".stop_times st
    LEFT JOIN "${schema}".stops s ON st.stop_id = s.stop_id
    WHERE s.stop_id IS NULL;
  `);
  const s_orphans_count = parseInt(stopOrphans.rows[0].count, 10);
  if (s_orphans_count > 0) {
    errors++;
    details.push({
      rule_id: 'referential_integrity_stoptimes_stops',
      severity: 'error',
      message: `CRÍTICO: Hay ${s_orphans_count} registros en stop_times que hacen referencia a un 'stop_id' que no existe en stops.txt.`
    });
  }

  // =========================================================================
  // 2. stops sin stop_times (Paradas abandonadas o sin servicio)
  // =========================================================================
  // [ADVERTENCIA] Paradas declaradas en el archivo stops.txt que ningún viaje 
  // visita (no figuran en stop_times.txt). Es útil para limpiar datos inactivos, 
  // antiguas paradas, o detectar errores logísticos donde no se le asignó ruta.
  const stopsWithoutTimes = await client.query(`
    SELECT COUNT(*) as count 
    FROM "${schema}".stops s
    LEFT JOIN "${schema}".stop_times st ON s.stop_id = st.stop_id
    WHERE st.trip_id IS NULL;
  `);
  const stops_no_times_count = parseInt(stopsWithoutTimes.rows[0].count, 10);
  if (stops_no_times_count > 0) {
    warnings++;
    details.push({
      rule_id: 'unused_stops',
      severity: 'warning',
      message: `AISLAMIENTO: Se encontraron ${stops_no_times_count} paradas (stops) sin horarios (stop_times). Estas paradas no tienen servicio activo.`
    });
  }

  // =========================================================================
  // 3. trips sin shapes (Viajes sin geometría/dibujo trazado)
  // =========================================================================
  // [ADVERTENCIA/INFO] En GTFS, los shapes son opcionales, pero son vitales para 
  // el análisis espacial preciso, ruteo en mapa, e interfaces de usuario visuales.
  // Averigua si el publicador de datos se saltó subir la geometría real del camino.
  const tripsWithoutShapes = await client.query(`
    SELECT COUNT(*) as count 
    FROM "${schema}".trips t
    WHERE t.shape_id IS NULL OR t.shape_id = '';
  `);
  const trips_no_shape_count = parseInt(tripsWithoutShapes.rows[0].count, 10);
  if (trips_no_shape_count > 0) {
    warnings++;
    details.push({
      rule_id: 'trips_without_shapes',
      severity: 'warning',
      message: `CALIDAD GIS: Hay ${trips_no_shape_count} viajes (trips) sin geometría ('shape_id'). Esto impedirá dibujar una línea exacta de trayecto en el mapa limitandose a unir puntos de parada.`
    });
  }

  // =========================================================================
  // 3b. trips con shape_id fantasma/huérfano (Integridad referencial)
  // =========================================================================
  // [ERROR] Viajes que declaran tener un 'shape_id', pero ese ID no existe en 
  // el archivo shapes.txt. Esto causa que el mapa no pueda dibujar absolutamente 
  // ninguna línea para este trayecto aunque el viaje asegure tenerla.
  const orphanShapes = await client.query(`
    SELECT COUNT(DISTINCT t.trip_id) as count 
    FROM "${schema}".trips t
    LEFT JOIN "${schema}".shapes s ON t.shape_id = s.shape_id
    WHERE t.shape_id IS NOT NULL AND t.shape_id <> '' AND s.shape_id IS NULL;
  `);
  const orphan_shapes_count = parseInt(orphanShapes.rows[0].count, 10);
  if (orphan_shapes_count > 0) {
    errors++;
    details.push({
      rule_id: 'orphan_shape_id',
      severity: 'error',
      message: `CRÍTICO: Existen ${orphan_shapes_count} viajes que declaran un 'shape_id' que no existe en el archivo shapes.txt. El trayecto vectorial del mapa será invisible.`
    });
  }

  // =========================================================================
  // 4. trips sin stop_times (Viajes fantasma o vacíos)
  // =========================================================================
  // [CRÍTICO] Todo registro en trips.txt debe contar con registros de sus 
  // tiempos de pasada en stop_times.txt para que indique a qué paradas va a
  // parar; sin esto un viaje simplemente "existe en el vacío".
  const tripsWithoutStopTimes = await client.query(`
    SELECT COUNT(*) as count 
    FROM "${schema}".trips t
    WHERE NOT EXISTS (
      SELECT 1 FROM "${schema}".stop_times st WHERE st.trip_id = t.trip_id
    );
  `);
  const trips_no_times_count = parseInt(tripsWithoutStopTimes.rows[0].count, 10);
  if (trips_no_times_count > 0) {
    errors++;
    details.push({
      rule_id: 'trips_without_stop_times',
      severity: 'error',
      message: `CRÍTICO: Existen ${trips_no_times_count} viajes (trips) listados sin horarios programados en stop_times.txt, son viajes que no transportan pasajeros a ningún lado.`
    });
  }

  // =========================================================================
  // 5. routes sin trips (Rutas sin salidas mapeadas)
  // =========================================================================
  // [ADVERTENCIA] Rutas que se declararon de manera administrativa pero no 
  // se generó ninguna iteración/operación (trip) sobre las mismas. 
  const routesWithoutTrips = await client.query(`
    SELECT COUNT(*) as count 
    FROM "${schema}".routes r
    WHERE NOT EXISTS (
      SELECT 1 FROM "${schema}".trips t WHERE t.route_id = r.route_id
    );
  `);
  const routes_no_trips_count = parseInt(routesWithoutTrips.rows[0].count, 10);
  if (routes_no_trips_count > 0) {
    warnings++;
    details.push({
      rule_id: 'routes_without_trips',
      severity: 'warning',
      message: `AISLAMIENTO: Se encontraron ${routes_no_trips_count} rutas (routes) declaradas que actualmente no operan viajes (trips).`
    });
  }

  // =========================================================================
  // 6. agency sin routes operadas (Agencia inactiva)
  // =========================================================================
  // [ADVERTENCIA] Múltiples agencias pueden subir un paquete GTFS conjunto, pero
  // si alguna de ellas no opera ninguna ruta entonces contribuye ruido al análisis.
  const agenciesWithoutRoutes = await client.query(`
    SELECT COUNT(*) as count 
    FROM "${schema}".agency a
    WHERE NOT EXISTS (
      SELECT 1 FROM "${schema}".routes r WHERE (r.agency_id = a.agency_id OR (a.agency_id IS NULL AND r.agency_id IS NULL))
    );
  `);
  const agencies_no_routes_count = parseInt(agenciesWithoutRoutes.rows[0].count, 10);
  if (agencies_no_routes_count > 0) {
    warnings++;
    details.push({
      rule_id: 'agency_without_routes',
      severity: 'warning',
      message: `AISLAMIENTO: Hay ${agencies_no_routes_count} agencias en metadata (agency.txt) que no tienen rutas asignadas para operar.`
    });
  }

  return { errors, warnings, details };
}
