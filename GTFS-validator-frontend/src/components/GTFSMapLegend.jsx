import { useMemo } from 'react';

export default function GTFSMapLegend({ visibleShapes, visibleStops, totalStops }) {

  // Recolectar colores únicos y nombres de las rutas actualmente visibles
  const activeRoutes = useMemo(() => {
    const routeMap = new Map();
    
    visibleShapes?.forEach(feature => {
      const p = feature.properties;
      const key = p.route_id;
      if (!routeMap.has(key)) {
        routeMap.set(key, {
          id: p.route_id,
          name: p.route_name?.split(' (')[0] || p.route_id, // Remover el "(Ida)" para la varita
          color: p.route_color || '#3b82f6'
        });
      }
    });

    const routes = Array.from(routeMap.values());
    return {
      top: routes.slice(0, 4),
      remaining: Math.max(0, routes.length - 4)
    };
  }, [visibleShapes]);

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: 16, zIndex: 10,
      background: 'oklch(0 0 0 / 75%)', backdropFilter: 'blur(8px)',
      border: '1px solid oklch(1 0 0 / 15%)',
      borderRadius: '0.75rem', padding: '0.75rem 1rem',
      fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
      boxShadow: '0 4px 12px oklch(0 0 0 / 30%)', minWidth: '150px'
    }}>
      <strong style={{ color: 'white', borderBottom: '1px solid oklch(1 0 0 / 10%)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
        Leyenda GTFS
      </strong>

      {/* Markers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', border: '1px solid white' }} />
          <span style={{ color: 'var(--muted-foreground)' }}>Parada Normal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', border: '1px solid white' }} />
          <span style={{ color: 'var(--muted-foreground)' }}>Parada con Error Geo</span>
        </div>
      </div>

      {/* Trayectos */}
      {activeRoutes.top.length > 0 && (
        <div style={{ marginTop: '0.25rem', borderTop: '1px solid oklch(1 0 0 / 10%)', paddingTop: '0.5rem' }}>
          <span style={{ display: 'block', color: 'white', marginBottom: '0.35rem', fontWeight: 600 }}>Trayectos Visibles:</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {activeRoutes.top.map(r => (
               <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 14, height: 4, borderRadius: '2px', background: r.color }} />
                  <span style={{ color: 'var(--muted-foreground)' }}>Línea {r.name}</span>
               </div>
            ))}
            {activeRoutes.remaining > 0 && (
              <span style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', marginLeft: '1.4rem' }}>
                y {activeRoutes.remaining} rutas más...
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
