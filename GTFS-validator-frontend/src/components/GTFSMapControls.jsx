import { useMemo } from 'react';
import { Filter, X, ChevronRight, Bus } from 'lucide-react';

export default function GTFSMapControls({ 
  agencies = [], 
  routes = [], 
  selectedAgency, 
  setSelectedAgency,
  selectedRouteId, 
  setSelectedRouteId,
  selectedDirection,
  setSelectedDirection,
  stats,
  mapOptions,
  setMapOptions
}) {

  // 1. Opciones de Agencia
  const agencyOptions = useMemo(() => {
    // Para simplificar, asumimos que todas las agencias con rutas están en `agencies`
    return agencies.map(a => ({
      id: a.agency_id || 'default',
      name: a.agency_name || 'Agencia sin nombre'
    }));
  }, [agencies]);

  // 2. Opciones de Rutas (filtradas por Agencia)
  const routeOptions = useMemo(() => {
    let filteredRoutes = routes;
    if (selectedAgency) {
      filteredRoutes = routes.filter(r => r.agency_id === selectedAgency);
    }
    
    // Extraer unique routes (ignorando dirección id para no repetir)
    const uniqueRoutes = new Map();
    filteredRoutes.forEach(r => {
      if (!uniqueRoutes.has(r.route_id)) {
        uniqueRoutes.set(r.route_id, {
          route_id: r.route_id,
          name: r.short_name || 'Sin línea',
          long_name: r.long_name || '',
          color: r.color || '#3b82f6'
        });
      }
    });

    return Array.from(uniqueRoutes.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [routes, selectedAgency]);

  // 3. Opciones de Dirección (filtradas por Ruta)
  const directionOptions = useMemo(() => {
    if (!selectedRouteId) return [];
    
    // Típicamente solo hay Ida (0) y Vuelta (1)
    return routes
      .filter(r => r.route_id === selectedRouteId)
      .map(r => ({
        id: r.direction_id,
        name: r.direction_id === 0 ? 'Ida' : 'Vuelta'
      }))
      .sort((a, b) => a.id - b.id);
  }, [routes, selectedRouteId]);

  // Manejadores
  const handleAgencyChange = (val) => {
    setSelectedAgency(val);
    setSelectedRouteId('');
    setSelectedDirection('');
  };

  const handleRouteChange = (val) => {
    setSelectedRouteId(val);
    setSelectedDirection('');
  };

  const clearAll = () => {
    setSelectedAgency('');
    setSelectedRouteId('');
    setSelectedDirection('');
  };

  const isActive = selectedAgency || selectedRouteId || selectedDirection !== '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
      padding: '1rem', background: 'oklch(0.2 0 0)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      boxShadow: '0 4px 12px oklch(0 0 0 / 20%)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', fontWeight: 600, fontSize: '0.9rem' }}>
          <Filter size={16} style={{ color: 'var(--info-color)' }} />
          Filtros de Exploración
        </div>
        
        {isActive && (
          <button 
            onClick={clearAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.2rem',
              background: 'transparent', border: 'none', 
              color: 'var(--muted-foreground)', fontSize: '0.75rem', 
              cursor: 'pointer', transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-foreground)'}
          >
            <X size={14} /> Limpiar todo
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        
        {/* Dropdown: Agencia */}
        {agencyOptions.length > 1 && (
          <select 
            value={selectedAgency}
            onChange={(e) => handleAgencyChange(e.target.value)}
            style={{
              background: 'oklch(0.15 0 0)', color: 'var(--foreground)',
              border: '1px solid oklch(1 0 0 / 15%)', borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none',
              cursor: 'pointer', minWidth: '180px'
            }}
          >
            <option value="">Todas las Agencias</option>
            {agencyOptions.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {/* Separador */}
        {agencyOptions.length > 1 && <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />}

        {/* Dropdown: Línea */}
        <select 
          value={selectedRouteId}
          onChange={(e) => handleRouteChange(e.target.value)}
          disabled={!selectedAgency && agencyOptions.length > 1} // Obligar a elegir agencia primero si hay varias
          style={{
            background: 'oklch(0.15 0 0)', color: 'var(--foreground)',
            border: '1px solid oklch(1 0 0 / 15%)', borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none',
            cursor: 'not-allowed', minWidth: '180px', flex: 1,
            opacity: (!selectedAgency && agencyOptions.length > 1) ? 0.5 : 1
          }}
        >
          <option value="">Todas las Líneas</option>
          {routeOptions.map(r => (
            <option key={r.route_id} value={r.route_id}>
              Línea {r.name} {r.long_name ? `- ${r.long_name}` : ''}
            </option>
          ))}
        </select>

        {/* Separador */}
        <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />

        {/* Dropdown: Dirección */}
        <select 
          value={selectedDirection}
          onChange={(e) => setSelectedDirection(e.target.value)}
          disabled={!selectedRouteId}
          style={{
            background: 'oklch(0.15 0 0)', color: 'var(--foreground)',
            border: '1px solid oklch(1 0 0 / 15%)', borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none',
            cursor: 'not-allowed', minWidth: '140px',
            opacity: !selectedRouteId ? 0.5 : 1
          }}
        >
          <option value="">Trayectos (Ambos)</option>
          {directionOptions.map(d => (
            <option key={d.id} value={d.id}>Trayecto: {d.name}</option>
          ))}
        </select>
        
        {/* Toggle Paradas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--foreground)', cursor: !selectedRouteId ? 'not-allowed' : 'pointer', opacity: !selectedRouteId ? 0.5 : 1 }}>
            <input 
              type="checkbox" 
              disabled={!selectedRouteId}
              checked={mapOptions.showStops}
              onChange={(e) => setMapOptions(prev => ({ ...prev, showStops: e.target.checked }))}
              style={{
                 accentColor: 'oklch(0.623 0.214 259.815)'
              }}
            />
            Cargar Paradas
          </label>

          {mapOptions.showStops && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--foreground)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={mapOptions.showOnlyIssues}
                onChange={(e) => setMapOptions(prev => ({ ...prev, showOnlyIssues: e.target.checked }))}
                style={{
                   accentColor: '#ef4444'
                }}
              />
              <span style={{ color: mapOptions.showOnlyIssues ? '#ef4444' : 'inherit' }}>Solo con errores espaciales</span>
            </label>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
           <Bus size={12} /> {Array.isArray(stats.visibleShapes) ? stats.visibleShapes.length : (stats.visibleShapes || 0)} Trayectos visibles
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
           <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.7 0 0)'}}></div>
           {stats.visibleStops || 0} Paradas visibles
        </div>
      </div>

    </div>
  );
}
