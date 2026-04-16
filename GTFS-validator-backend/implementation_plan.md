# [Migración de Datos de Informe a Base de Datos]

El objetivo de esta re-estructuración es solucionar el problema de bloqueo del 'Event Loop' en NodeJS provocado por pasar archivos muy largos (GeoJSON Shapes, Stops de hasta varios MBs) a través de propiedades en BullMQ.

La arquitectura pasará a:
1. Almacenar el reporte final en la base de datos (dentro del mismo esquema del job).
2. Generar el GeoJSON de `stops` y `shapes` de forma nativa desde la API (`Express`) solamente cuando se solicite, en lugar de hacerlo en tiempo de ejecución del Worker.
3. Adaptar el Frontend (React) para que le solicite de forma asíncrona a la API estos grandes volumenes de texto.

## Proposed Changes

### Backend - Database Schema
Añadiremos una tabla liviana para guardar el resumen de validación dentro del esquema creado para la sesión temporal del usuario.

#### [MODIFY] [schemaManager.js](file:///d:/Proyectos/GTFS-validator/GTFS-validator-backend/src/db/schemaManager.js)
- Agregar DDL para tabla `validation_report (id serial, data jsonb)` en `createDynamicSchema`.

### Backend - Worker & Validator
Retiraremos la carga pesada al Worker y se la pasaremos al momento de consulta de la API.

#### [MODIFY] [sqlValidator.js](file:///d:/Proyectos/GTFS-validator/GTFS-validator-backend/src/validators/sqlValidator.js)
- Eliminar los segmentos de generación pesada `stops_geojson`, `shapes_geojson` y `routes`.
- Insertar el resultado ligero (errores, advertencias, detalles) en la nueva tabla `validation_report` recién creada antes de devolver los resultados.

#### [MODIFY] [processor.js](file:///d:/Proyectos/GTFS-validator/GTFS-validator-backend/src/worker/processor.js)
- Reducir el retorno de `processJob` a un simple objeto `{ success: true, message: '...' }` con metadatos, evitando pasar arrays o JSON voluminosos al queue redis.

### Backend - API Endpoints
Añadiremos endpoints explícitos para cargar mapas y rutas solo cuando el usuario los necesite (Lazy loading).

#### [MODIFY] [routes.js](file:///d:/Proyectos/GTFS-validator/GTFS-validator-backend/src/api/routes.js)
- Modificar `GET /api/validate/:id` para que una vez que el estado de BullMQ sea `completed`, en vez de leer el `returnvalue`, vaya a la BD a leer el contenido de `validation_report`.
- Crear Endpoint `GET /api/gtfs/:jobId/stops` (Retorna Stops GeoJSON)
- Crear Endpoint `GET /api/gtfs/:jobId/shapes` (Retorna Shapes GeoJSON)
- Crear Endpoint `GET /api/gtfs/:jobId/routes` (Retorna la metadata de rutas)

### Frontend
Actualizaremos las conexiones de red para leer la data pesada de forma remota.

#### [MODIFY] [api.js](file:///d:/Proyectos/GTFS-validator/GTFS-validator-frontend/src/services/api.js)
- Modificar las llamadas para agregar endpoints: `fetchStops(jobId)`, `fetchShapes(jobId)`, `fetchRoutes(jobId)`.

#### [MODIFY] [App.jsx](file:///d:/Proyectos/GTFS-validator/GTFS-validator-frontend/src/App.jsx)
- Cuando el job finaliza, cargar en paralelo las agencias, y cuando abra la pestaña "Map", usar llamadas a nuestra API para ir a buscar los `stops` y `shapes`.

## Open Questions

> [!WARNING]
> La generación del GeoJSON en cada recarga de endpoint puede tardar algunos segundos (dependiendo del tamaño del ZIP). Puesto que los esquemas temporales se expiran tras 1 hora de todos modos, generarlo "on-the-fly" desde la API es apropiado. Si se prefiere, podemos guardar el GeoJSON también como strings largos ocultos en la tabla `validation_report` para no saturar al CPU del backend. ¿Prefieres generar el geojson en vivo con querys al consultar la URL o calculamos el geojson y lo inyectamos a las tablas JSONB del postgre al vuelo? Funcionalmente el resultado es idéntico, pero calcularlo en la Database e inyectar el JSON guarda memoria de forma estática, mientras en vivo usas CPU del motor PostGIS cada vez que accedes al mapa.
Recomendación: En vivo, al acceder al mapa.

## Verification Plan

### Automated Tests
- Arrancar API y Frontend
- Subir un dataset inusualmente largo y comprobar que BullMQ NO bloquee sus callbacks de redis previniendo el error `"Missing lock for job X"`.

### Manual Verification
- Validar las pestañas de UI, especialmente la visualización asíncrona de los shapes y las stops georefenciadas.
