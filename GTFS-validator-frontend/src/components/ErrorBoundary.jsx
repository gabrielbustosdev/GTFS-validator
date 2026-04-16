import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary atrapó un fallo crítico en la app:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem', background: 'oklch(0.2 0 0)', 
          color: 'var(--foreground)', borderRadius: 'var(--radius)',
          border: '1px solid oklch(0.396 0.141 25.768 / 50%)',
          margin: '2rem auto', maxWidth: '800px'
        }}>
          <h2 style={{ color: 'var(--destructive)', marginTop: 0 }}>🚨 Crash de la Interfaz</h2>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Un componente interno falló al renderizar el estado actual. Esto suele suceder por variables 'cacheadas' del modo de desarrollo (HMR) 
            tratando de dibujar un mapa con datos viejos. 
          </p>
          <pre style={{
            background: 'oklch(0 0 0 / 50%)', padding: '1rem', 
            borderRadius: '0.5rem', overflowX: 'auto',
            color: 'oklch(0.795 0.184 86.047)', fontSize: '0.8rem'
          }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem', padding: '0.5rem 1rem', 
              background: 'var(--primary)', color: 'var(--primary-foreground)',
              border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Refrescar la Vista (F5)
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}
