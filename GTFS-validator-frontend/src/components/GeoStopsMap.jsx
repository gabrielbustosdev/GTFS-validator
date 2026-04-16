import { useState, useEffect, useRef } from 'react';
import { Map, NavigationControl, Popup } from 'maplibre-gl';
import GTFSMapLegend from './GTFSMapLegend';
import 'maplibre-gl/dist/maplibre-gl.css';

const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function GeoStopsMap({ 
  geojson, 
  shapesGeojson, 
  agencies,
  routes,
  selectedAgency,
  selectedRouteId,
  selectedDirection,
  onStatsChange // callback to update visible metrics
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [visibleStops, setVisibleStops] = useState(0);
  const [visibleShapes, setVisibleShapes] = useState([]);

  // Mount map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new Map({
      container: containerRef.current,
      style: CARTO_DARK,
      center: [-65, -34],
      zoom: 4,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Sync Layers & Filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Constantes de capas
    const SHAPES_SOURCE = 'gtfs-shapes';
    const SHAPES_LAYER = 'shapes-lines';
    const SHAPES_HOVER_LAYER = 'shapes-lines-hover';
    
    const STOPS_SOURCE = 'gtfs-stops';
    const STOPS_LAYER = 'stops-circles';

    // 1. Añadir/Actualizar SOURCE de Shapes (Líneas)
    if (shapesGeojson) {
       if (map.getSource(SHAPES_SOURCE)) {
         map.getSource(SHAPES_SOURCE).setData(shapesGeojson);
       } else {
         map.addSource(SHAPES_SOURCE, { type: 'geojson', data: shapesGeojson, generateId: true });
         
         // Capa base de líneas
         map.addLayer({
           id: SHAPES_LAYER,
           type: 'line',
           source: SHAPES_SOURCE,
           layout: { 'line-join': 'round', 'line-cap': 'round' },
           paint: {
             'line-color': ['coalesce', ['get', 'route_color'], '#3b82f6'],
             'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 14, 5],
             'line-opacity': 0.7
           }
         });

         // Capa hover (highlight)
         map.addLayer({
           id: SHAPES_HOVER_LAYER,
           type: 'line',
           source: SHAPES_SOURCE,
           layout: { 'line-join': 'round', 'line-cap': 'round' },
           paint: {
             'line-color': ['coalesce', ['get', 'route_color'], '#3b82f6'],
             'line-width': 8,
             'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
           }
         });
       }
    } else if (map.getSource(SHAPES_SOURCE)) {
       map.getSource(SHAPES_SOURCE).setData({ type: 'FeatureCollection', features: [] });
    }

    // 2. Añadir/Actualizar SOURCE de Paradas (Puntos)
    if (geojson) {
      if (map.getSource(STOPS_SOURCE)) {
        map.getSource(STOPS_SOURCE).setData(geojson);
      } else {
        map.addSource(STOPS_SOURCE, { type: 'geojson', data: geojson, generateId: true });
        map.addLayer({
          id: STOPS_LAYER,
          type: 'circle',
          source: STOPS_SOURCE,
          // Para no sobrecargar hasta hacer zoom
          minzoom: 5,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6],
            'circle-color': [
              'case',
              ['==', ['get', 'has_issue'], true], '#ef4444',
              '#3b82f6',
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#000000',
          },
        });
      }
    } else if (map.getSource(STOPS_SOURCE)) {
       map.getSource(STOPS_SOURCE).setData({ type: 'FeatureCollection', features: [] });
    }

    // 3. Aplicar Filtros (Cascada: Agencia -> Línea -> Dirección)
    
    // Primero, encontrar todas las routes que coinciden con la agenda (si se seleccionó una)
    let validRouteIdsFromAgency = null;
    if (selectedAgency) {
       validRouteIdsFromAgency = routes.filter(r => r.agency_id === selectedAgency).map(r => r.route_id);
    }

    // Filing Shapes
    let shapeFilter = ['all'];
    if (selectedRouteId) {
      shapeFilter.push(['==', ['get', 'route_id'], selectedRouteId]);
      if (selectedDirection !== '') {
         shapeFilter.push(['==', ['get', 'direction_id'], parseInt(selectedDirection)]);
      }
    } else if (validRouteIdsFromAgency) {
      // Filtrar por agencia
      if (validRouteIdsFromAgency.length > 0) {
        shapeFilter.push(['in', ['get', 'route_id'], ...validRouteIdsFromAgency]);
      } else {
        shapeFilter.push(['==', 'route_id', 'none']); // Nothing matches
      }
    }
    
    if (shapeFilter.length === 1) shapeFilter = null; // No filters

    if (map.getLayer(SHAPES_LAYER)) {
       map.setFilter(SHAPES_LAYER, shapeFilter);
    }
    if (map.getLayer(SHAPES_HOVER_LAYER)) {
       map.setFilter(SHAPES_HOVER_LAYER, shapeFilter);
    }

    // Filing Stops
    let stopFilter = ['all'];
    if (selectedRouteId) {
       if (selectedDirection !== '') {
          // Filtrar paradas por ruta Y dirección
          stopFilter = ['in', `${selectedRouteId}:${selectedDirection}`, ['get', 'route_directions']];
       } else {
          // Filtrar paradas solo por ruta (ambas direcciones)
          stopFilter = ['in', selectedRouteId, ['get', 'route_ids']];
       }
    } else if (validRouteIdsFromAgency && validRouteIdsFromAgency.length > 0) {
       stopFilter = ['any', ...validRouteIdsFromAgency.map(id => ['in', id, ['get', 'route_ids']])];
    } else if (validRouteIdsFromAgency && validRouteIdsFromAgency.length === 0) {
       stopFilter = ['==', 'stop_id', 'none'];
    }

    if (stopFilter && stopFilter.length === 1 && typeof stopFilter[0] === 'string' && stopFilter[0] === 'all') stopFilter = null;

    if (map.getLayer(STOPS_LAYER)) {
       try {
         map.setFilter(STOPS_LAYER, stopFilter);
       } catch (e) {
         console.warn("Could not apply stop filter", e);
       }
    }

    // 4. Update Stats when idle
    const updateStats = () => {
       const renderedStops = map.queryRenderedFeatures({ layers: [STOPS_LAYER] });
       const renderedShapes = map.queryRenderedFeatures({ layers: [SHAPES_LAYER] });
       
       const uniqueStops = new Set(renderedStops.map(f => f.properties.stop_id)).size;
       const uniqueShapes = new Set(renderedShapes.map(f => f.properties.route_id)).size;
       
       setVisibleStops(uniqueStops);
       setVisibleShapes(renderedShapes);

       if (onStatsChange) {
         onStatsChange({ visibleStops: uniqueStops, visibleShapes: uniqueShapes });
       }
    };
    
    map.once('idle', updateStats);
    map.on('moveend', updateStats);

    // 5. Centrar Mapa en la selección
    let featuresToFit = [];
    
    // Fallback: the whole dataset
    let sourceGeo = null;
    
    if (selectedRouteId) {
       sourceGeo = shapesGeojson?.features?.filter(f => f.properties.route_id === selectedRouteId);
       if (selectedDirection !== '') {
          sourceGeo = sourceGeo?.filter(f => f.properties.direction_id === parseInt(selectedDirection));
       }
       if (!sourceGeo || sourceGeo.length === 0) {
          // Fallback a stops
          sourceGeo = geojson?.features?.filter(f => f.properties.route_ids?.includes(selectedRouteId));
       }
       featuresToFit = sourceGeo || [];
    } else {
       featuresToFit = (geojson?.features || []).concat(shapesGeojson?.features || []);
    }

    if (featuresToFit.length > 0) {
      const allCoords = [];
      featuresToFit.forEach(f => {
        if (!f.geometry) return;
        if (f.geometry.type === 'Point') {
          allCoords.push(f.geometry.coordinates);
        } else if (f.geometry.type === 'LineString') {
          f.geometry.coordinates.forEach(c => allCoords.push(c));
        } else if (f.geometry.type === 'MultiLineString') {
          f.geometry.coordinates.forEach(line => line.forEach(c => allCoords.push(c)));
        }
      });

      if (allCoords.length > 0) {
        const lngs = allCoords.map(c => c[0]);
        const lats = allCoords.map(c => c[1]);
        const bounds = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ];
        
        // Evitar bounding boxes colapsados
        if (bounds[0][0] !== bounds[1][0] && bounds[0][1] !== bounds[1][1]) {
           map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1200 });
        } else {
           map.flyTo({ center: bounds[0], zoom: 15, duration: 1200 });
        }
      }
    }

    // 6. Configurar Interacción de Shapes y Popups
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    let hoveredShapeId = null;

    const onShapeHover = (e) => {
       if (e.features.length > 0) {
          map.getCanvas().style.cursor = 'pointer';
          if (hoveredShapeId !== null) {
            map.setFeatureState({ source: SHAPES_SOURCE, id: hoveredShapeId }, { hover: false });
          }
          hoveredShapeId = e.features[0].id;
          map.setFeatureState({ source: SHAPES_SOURCE, id: hoveredShapeId }, { hover: true });

          const props = e.features[0].properties;
          popup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family: sans-serif; font-size: 0.8rem; line-height: 1.4; color: #111; min-width: 140px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <div style="width: 12px; height: 12px; border-radius: 2px; background: ${props.route_color || '#3b82f6'}; border: 1px solid rgba(0,0,0,0.1);"></div>
                <strong style="font-size: 0.9rem; color: #000;">Línea ${props.route_name.split(' (')[0]}</strong>
              </div>
              <div style="color: #444; font-size: 0.75rem;">Trayecto: ${props.direction_id === 0 ? 'Ida' : 'Vuelta'}</div>
            </div>
          `).addTo(map);
       }
    };

    const onShapeLeave = () => {
       map.getCanvas().style.cursor = '';
       if (hoveredShapeId !== null) {
          map.setFeatureState({ source: SHAPES_SOURCE, id: hoveredShapeId }, { hover: false });
       }
       hoveredShapeId = null;
       popup.remove();
    };

    const onStopHover = (e) => {
      map.getCanvas().style.cursor = 'crosshair';
      const props = e.features[0].properties;
      
      const routesStr = props.route_names && props.route_names !== 'null' ? props.route_names : 'N/A';
      
      popup.setLngLat(e.lngLat).setHTML(`
        <div style="font-family: sans-serif; font-size: 0.85rem; line-height: 1.4; min-width: 180px; color: #222;">
          <strong style="font-size: 0.9rem; border-bottom: 1px solid #ddd; padding-bottom: 4px; display: block; margin-bottom: 4px; color: #000;">
             ${props.stop_name || 'Parada Sin Nombre'}
          </strong>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; color: #555; margin-bottom: 4px;">
             <span>ID:</span> <span style="color: #111;">${props.stop_id}</span>
             <span>Líneas:</span> <span style="color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${routesStr}</span>
          </div>
          ${props.stop_desc ? `<div style="font-size: 0.75rem; color: #666; margin-top: 4px; font-style: italic;">${props.stop_desc}</div>` : ''}
          ${props.has_issue ? '<div style="margin-top: 6px; padding: 4px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; font-size: 0.7rem; font-weight: bold; border-radius: 4px;">⚠ Posible Error Espacial</div>' : ''}
        </div>
      `).addTo(map);
    };

    const onStopLeave = () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    };

    if (map.getLayer(STOPS_LAYER)) {
       map.on('mouseenter', STOPS_LAYER, onStopHover);
       map.on('mouseleave', STOPS_LAYER, onStopLeave);
    }
    if (map.getLayer(SHAPES_LAYER)) {
       map.on('mouseenter', SHAPES_LAYER, onShapeHover);
       map.on('mouseleave', SHAPES_LAYER, onShapeLeave);
       // Ensure hover layer is above shapes layer
       if (map.getLayer(SHAPES_HOVER_LAYER)) {
         map.on('mouseenter', SHAPES_HOVER_LAYER, onShapeHover);
         map.on('mouseleave', SHAPES_HOVER_LAYER, onShapeLeave);
       }
    }

    return () => {
      map.off('idle', updateStats);
      map.off('moveend', updateStats);
      
      try {
        if (map.style && map.style._loaded) {
          if (map.getLayer(STOPS_LAYER)) {
             map.off('mouseenter', STOPS_LAYER, onStopHover);
             map.off('mouseleave', STOPS_LAYER, onStopLeave);
          }
          if (map.getLayer(SHAPES_HOVER_LAYER)) {
             map.off('mouseenter', SHAPES_HOVER_LAYER, onShapeHover);
             map.off('mouseleave', SHAPES_HOVER_LAYER, onShapeLeave);
          }
        }
      } catch (e) {
        // Ignorar errores durante el desmontaje si las capas o estilos ya no existen
      }
      popup.remove();
    };
  }, [mapLoaded, geojson, shapesGeojson, selectedAgency, selectedRouteId, selectedDirection]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '580px', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Legend Component */}
      {geojson && mapLoaded && (
        <GTFSMapLegend 
          visibleShapes={visibleShapes}
          visibleStops={visibleStops}
          totalStops={geojson.features?.length || 0}
        />
      )}

      {/* Attribution */}
      <div style={{
        position: 'absolute', bottom: 4, right: 8,
        fontSize: '0.65rem', color: 'oklch(0.5 0 0)',
        zIndex: 5, pointerEvents: 'none'
      }}>
        © CARTO · © OpenStreetMap
      </div>
    </div>
  );
}
