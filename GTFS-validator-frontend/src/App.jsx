import './index.css';
import { useState, useEffect, lazy, Suspense } from 'react';
import logo from './assets/gtfs-validator-logo.png';
import { GitBranch, Zap, Github, ExternalLink, ChevronRight, RotateCcw, Map } from 'lucide-react';
import DropZone from './components/DropZone';
import ValidationProgress from './components/ValidationProgress';
import KPIStats from './components/KPIStats';
import IssuesDataTable from './components/IssuesDataTable';
import FeedMetadata from './components/FeedMetadata';
import GTFSMapControls from './components/GTFSMapControls';
import { useValidationJob } from './hooks/useValidationJob';
import { fetchHistory, fetchStops, fetchShapes, fetchRoutes } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';

const GeoStopsMap = lazy(() => import('./components/GeoStopsMap'));

const TABS = ['Issues', 'Metadata', 'Map'];

export default function App() {
  const { status, progress, message, results, uploadFile, loadJob, reset } = useValidationJob();
  const [activeTab, setActiveTab] = useState('Issues');
  
  // Map filter states
  const [selectedAgency, setSelectedAgency] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('');
  const [mapStats, setMapStats] = useState({ visibleStops: 0, visibleShapes: 0 });

  const [mapOptions, setMapOptions] = useState({ showStops: false, showOnlyIssues: false });
  const [mapData, setMapData] = useState({ stops: null, shapes: null, routes: [], loading: false });
  const [showResults, setShowResults] = useState(false);

  const isIdle = status === 'idle';
  const isDone = status === 'completed' && showResults;
  const isActive = !isIdle && !isDone;
  const isError = status === 'error';

  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (isIdle) {
      fetchHistory().then(setHistory).catch(console.error);
    }
  }, [isIdle]);

  const handleFile = (file) => {
    setShowResults(false);
    uploadFile(file);
  };

  const handleReset = () => {
    reset();
    setShowResults(false);
    setActiveTab('Issues');
    setMapData({ stops: null, shapes: null, routes: [], loading: false });
    setMapOptions({ showStops: false, showOnlyIssues: false });
  };

  // 1. Cargar Rutas (ligero) cuando abren el mapa
  useEffect(() => {
    if (activeTab === 'Map' && results?.jobId && mapData.routes.length === 0) {
       fetchRoutes(results.jobId).then(routes => {
          setMapData(prev => ({ ...prev, routes }));
       }).catch(console.error);
    }
  }, [activeTab, results?.jobId]);

  // 2. Fetch de datos On-Demand cuando tocan filtros
  useEffect(() => {
    if (activeTab !== 'Map' || !results?.jobId) return;

    const loadData = async () => {
      setMapData(prev => ({ ...prev, loading: true }));
      try {
        // Inicialmente limpiar mapa
        let newShapes = null;
        let newStops = null;

        // Si hay una linea seleccionada, traer shapes
        if (selectedRouteId) {
           newShapes = await fetchShapes(results.jobId, selectedRouteId);
        }

        // Traer paradas SOLO si el switch está activado
        if (mapOptions.showStops && selectedRouteId) {
           newStops = await fetchStops(results.jobId, selectedRouteId, mapOptions.showOnlyIssues);
        } else if (mapOptions.showStops && !selectedRouteId) {
           // Traer todas las paradas (podria ser pesado, recomendamos selectRouteId)
           // newStops = await fetchStops(results.jobId, null, mapOptions.showOnlyIssues);
           // Mejor no cargar todo para evitar colapso. Solo cargar si filtran.
           newStops = null;
        }

        setMapData(prev => ({ ...prev, stops: newStops, shapes: newShapes, loading: false }));
      } catch (err) {
        console.error("Error fetching map data on demand:", err);
        setMapData(prev => ({ ...prev, loading: false }));
      }
    };

    loadData();
  }, [activeTab, results?.jobId, selectedRouteId, mapOptions]);



  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      
      {/* Ambient gradient backdrop */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 20% 10%, oklch(0.623 0.214 259.815 / 12%) 0%, transparent 60%), radial-gradient(ellipse at 80% 90%, oklch(0.7 0.19 310 / 10%) 0%, transparent 50%)',
      }} />

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 10,
        borderBottom: '1px solid oklch(1 0 0 / 8%)',
        padding: '0 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px',
        backdropFilter: 'blur(8px)',
        background: 'oklch(0 0 0 / 20%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img 
            src={logo} 
            alt="GTFS Validator Logo" 
            style={{ width: 32, height: 32, borderRadius: '8px', objectFit: 'contain' }} 
          />
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>GTFS Validator</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.83rem', color: 'var(--muted-foreground)' }}>
          <a
            href="https://github.com/gabrielbustosdev/GTFS-validator-backend"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--muted-foreground)', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-foreground)'}
          >
            <Github size={15} /> GitHub
          </a>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.3rem 0.7rem', borderRadius: '9999px',
            background: 'oklch(0.723 0.219 149.579 / 12%)',
            border: '1px solid oklch(0.723 0.219 149.579 / 25%)',
            color: 'oklch(0.723 0.219 149.579)',
            fontSize: '0.75rem', fontWeight: 600,
          }}>
            <Zap size={12} /> PostGIS · BullMQ
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{
        position: 'relative', zIndex: 1,
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}>

        {/* Hero title */}
        {isIdle && (
          <div className="animate-fade-in-up" style={{ textAlign: 'center', paddingBottom: '1rem' }}>
            <h1 style={{
              margin: 0, fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800, lineHeight: 1.1,
              background: 'linear-gradient(135deg, oklch(0.985 0 0) 30%, oklch(0.623 0.214 259.815))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              GTFS Feed Validator
            </h1>
            <p style={{
              marginTop: '0.85rem', color: 'var(--muted-foreground)', fontSize: '1.05rem', maxWidth: '540px', margin: '0.85rem auto 0',
            }}>
              Upload a GTFS ZIP feed and get a comprehensive quality report powered by PostGIS spatial analysis.
            </p>
            <div style={{
              display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem',
              flexWrap: 'wrap',
            }}>
              {['Schema validation', 'Referential integrity', 'Spatial analysis', 'Orphan detection'].map(tag => (
                <span key={tag} style={{
                  fontSize: '0.78rem', padding: '0.3rem 0.8rem', borderRadius: '9999px',
                  background: 'oklch(1 0 0 / 6%)', border: '1px solid oklch(1 0 0 / 12%)',
                  color: 'var(--muted-foreground)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Upload card */}
        {(isIdle || isError) && (
          <div className="glass animate-fade-in-up" style={{ borderRadius: 'var(--radius)', padding: '2rem' }}>
            {isError && (
              <div style={{
                marginBottom: '1.25rem', padding: '0.85rem 1rem', borderRadius: '0.5rem',
                background: 'oklch(0.396 0.141 25.768 / 15%)', border: '1px solid oklch(0.396 0.141 25.768 / 30%)',
                color: 'oklch(0.637 0.237 25.331)', fontSize: '0.875rem',
              }}>
                {message || 'An error occurred. Please try again.'}
              </div>
            )}
            <DropZone onFileSelected={handleFile} disabled={false} />
            
            {/* History List */}
            {isIdle && history && history.length > 0 && (
              <div className="animate-fade-in-up" style={{ marginTop: '2.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCcw size={14} /> Validaciones Anteriores (Archivadas)
                </h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {history.map(item => (
                    <button 
                      key={item.jobId}
                      onClick={() => { loadJob(item.jobId); setShowResults(true); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1rem', background: 'oklch(1 0 0 / 4%)', 
                        border: '1px solid oklch(1 0 0 / 10%)', borderRadius: '0.5rem',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        color: 'var(--foreground)'
                      }}
                      onMouseEnter={e => {
                         e.currentTarget.style.background = 'oklch(1 0 0 / 8%)';
                         e.currentTarget.style.borderColor = 'oklch(1 0 0 / 20%)';
                      }}
                      onMouseLeave={e => {
                         e.currentTarget.style.background = 'oklch(1 0 0 / 4%)';
                         e.currentTarget.style.borderColor = 'oklch(1 0 0 / 10%)';
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.originalName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                          Realizado a las {new Date(item.finishedOn).toLocaleTimeString()}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress card */}
        {isActive && (
          <div className="glass animate-fade-in-up" style={{ borderRadius: 'var(--radius)', padding: '2rem' }}>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
              {isError ? 'Oops, Validation Failed' : 'Validating GTFS Feed'}
            </h2>
            <ValidationProgress status={status} progress={progress} message={message} onViewResults={() => setShowResults(true)} />
          </div>
        )}

        {/* Results */}
        {isDone && results && (
          <ErrorBoundary>
            {/* Header results bar */}
            <div className="animate-fade-in-up" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Validation Report</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                  Job <code style={{ fontSize: '0.8rem', background: 'oklch(1 0 0 / 8%)', padding: '2px 6px', borderRadius: '4px' }}>{results.jobId}</code> completed successfully
                </p>
              </div>
              <button
                id="reset-btn"
                onClick={handleReset}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                  background: 'oklch(1 0 0 / 6%)', border: '1px solid oklch(1 0 0 / 15%)',
                  color: 'var(--muted-foreground)', fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / 10%)'}
                onMouseLeave={e => e.currentTarget.style.background = 'oklch(1 0 0 / 6%)'}
              >
                <RotateCcw size={14} /> Validate another feed
              </button>
            </div>
            
            {!results.result ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                 ⚠️ El historial de este reporte ya no se encuentra en memoria o expiró el caché de la base de datos. 
              </div>
            ) : (
              <>
                {/* KPIs */}
                <KPIStats summary={results.result.summary || results.result} />
    
                {/* Tabs */}
                <div>
                  <div style={{
                    display: 'flex', borderBottom: '1px solid oklch(1 0 0 / 10%)',
                    marginBottom: '1.5rem', gap: '0.25rem',
                  }}>
                {TABS.map(tab => (
                  <button
                    key={tab}
                    id={`tab-${tab.toLowerCase()}`}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '0.6rem 1.25rem',
                      background: 'transparent', border: 'none',
                      borderBottom: `2px solid ${activeTab === tab ? 'oklch(0.623 0.214 259.815)' : 'transparent'}`,
                      cursor: 'pointer',
                      color: activeTab === tab ? 'oklch(0.623 0.214 259.815)' : 'var(--muted-foreground)',
                      fontWeight: activeTab === tab ? 700 : 500,
                      fontSize: '0.9rem',
                      transition: 'all 0.2s ease',
                      marginBottom: '-1px',
                    }}
                  >
                    {tab}
                    {tab === 'Issues' && results.result.issues?.length > 0 && (
                      <span style={{
                        marginLeft: '0.4rem', fontSize: '0.72rem',
                        padding: '0.1rem 0.45rem', borderRadius: '9999px',
                        background: 'oklch(0.396 0.141 25.768 / 25%)',
                        color: 'oklch(0.637 0.237 25.331)',
                        fontWeight: 700,
                      }}>{results.result.issues.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'Issues' && (
                <div className="glass animate-fade-in-up" style={{ borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                  <IssuesDataTable issues={results.result.issues || []} />
                </div>
              )}

              {activeTab === 'Metadata' && (
                <div className="animate-fade-in-up">
                  <FeedMetadata agencies={results.result.agencies} validity={results.result.feed_validity} />
                </div>
              )}

              {activeTab === 'Map' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <GTFSMapControls 
                    agencies={results.result.agencies}
                    routes={mapData.routes || []}
                    selectedAgency={selectedAgency}
                    setSelectedAgency={setSelectedAgency}
                    selectedRouteId={selectedRouteId}
                    setSelectedRouteId={setSelectedRouteId}
                    selectedDirection={selectedDirection}
                    setSelectedDirection={setSelectedDirection}
                    stats={mapStats}
                    mapOptions={mapOptions}
                    setMapOptions={setMapOptions}
                  />

                  <div className="glass animate-fade-in-up" style={{ borderRadius: 'var(--radius)', overflow: 'hidden', padding: 0, position: 'relative' }}>
                    <Suspense fallback={
                      <div style={{ height: '580px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                        Loading map scripts...
                      </div>
                    }>
                      {mapData.loading && (
                        <div style={{ 
                          position: 'absolute', inset: 0, zIndex: 50, 
                          background: 'oklch(0 0 0 / 50%)', backdropFilter: 'blur(4px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600
                        }}>
                          Descargando paquete vector desde PostGIS...
                        </div>
                      )}
                      
                      {!selectedRouteId && !mapData.loading && (
                        <div style={{ 
                          position: 'absolute', inset: 0, zIndex: 40,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)'
                        }}>
                          <Map size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                          <p>Seleccione una línea en el panel superior para visualizar el mapa.</p>
                        </div>
                      )}

                      <GeoStopsMap 
                        geojson={mapData.stops} 
                        shapesGeojson={mapData.shapes} 
                        agencies={results.result.agencies}
                        routes={mapData.routes || []}
                        selectedAgency={selectedAgency}
                        selectedRouteId={selectedRouteId}
                        selectedDirection={selectedDirection}
                        onStatsChange={setMapStats}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </ErrorBoundary>
    )}
      </main>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid oklch(1 0 0 / 6%)',
        padding: '1.25rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.5rem',
        fontSize: '0.78rem', color: 'var(--muted-foreground)',
      }}>
        <span>GTFS Validator · Portfolio Project</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          Node.js · Express · BullMQ · PostGIS · React
        </span>
      </footer>
    </div>
  );
}
