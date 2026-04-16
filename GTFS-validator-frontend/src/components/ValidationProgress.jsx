import { useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, Clock } from 'lucide-react';

const STEPS = [
  { key: 'queued',      label: 'Job queued',           desc: 'Waiting in processing queue...' },
  { key: 'processing',  label: 'Ingesting data',        desc: 'Loading GTFS files into PostGIS...' },
  { key: 'validating',  label: 'Running validations',   desc: 'Executing SQL & spatial checks...' },
  { key: 'completed',   label: 'Validation complete',   desc: 'Report is ready.' },
];

function StepIcon({ state }) {
  if (state === 'done')    return <CheckCircle2 size={18} style={{ color: 'oklch(0.723 0.219 149.579)' }} />;
  if (state === 'active')  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ 
        position: 'absolute', width: '24px', height: '24px', borderRadius: '50%', 
        background: 'oklch(0.623 0.214 259.815 / 20%)', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' 
      }} />
      <Loader2 size={18} style={{ color: 'oklch(0.623 0.214 259.815)', animation: 'spin 1s linear infinite' }} />
    </div>
  );
  if (state === 'error')   return <XCircle size={18} style={{ color: 'oklch(0.637 0.237 25.331)' }} />;
  return <Circle size={18} style={{ color: 'oklch(1 0 0 / 20%)' }} />;
}

export default function ValidationProgress({ status, progress, message, onViewResults }) {
  const progressObj = typeof progress === 'object' ? progress : { percent: progress || 0, step: message };
  const progressPct = status === 'completed' ? 100 : (progressObj.percent || 0);
  const currentStepMessage = status === 'completed' ? 'Validation finished successfully' : (progressObj.step || message || 'Processing...');

  const getStepState = (stepKey) => {
    const statusOrder = ['queued', 'processing', 'validating', 'completed'];
    
    let current = status === 'error' ? 'error' : status;
    
    // Inferencia de estado para BullMQ (ya que bullMQ no tiene state 'validating' nativo)
    if (current === 'processing' && progressPct >= 60) {
      current = 'validating';
    }

    const currentIdx = statusOrder.indexOf(current);
    const stepIdx = statusOrder.indexOf(stepKey);
    
    if (status === 'error' && stepIdx === currentIdx) return 'error';
    if (current === 'completed') return 'done';
    if (stepIdx < currentIdx) return 'done';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Progress bar and Current Status */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Current Status
            </span>
            <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
              {currentStepMessage}
            </p>
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'oklch(0.623 0.214 259.815)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(progressPct)}%
          </span>
        </div>
        <div style={{
          height: '8px', borderRadius: '4px',
          background: 'oklch(1 0 0 / 8%)', position: 'relative', overflow: 'hidden',
          border: '1px solid oklch(1 0 0 / 5%)',
        }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, oklch(0.623 0.214 259.815), oklch(0.7 0.19 280))',
            transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 0 20px oklch(0.623 0.214 259.815 / 40%)',
          }} />
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {STEPS.map((step, i) => {
          const state = getStepState(step.key);
          const isActive = state === 'active';
          const isDone = state === 'done';
          
          return (
            <div key={step.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: '1rem',
              opacity: state === 'pending' ? 0.3 : 1,
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              padding: isActive ? '0.75rem' : '0rem',
              background: isActive ? 'oklch(1 0 0 / 3%)' : 'transparent',
              borderRadius: '0.75rem',
              border: isActive ? '1px solid oklch(1 0 0 / 8%)' : '1px solid transparent',
              marginLeft: isActive ? '-0.75rem' : '0',
            }}>
              <div style={{ marginTop: '2px', flexShrink: 0 }}>
                <StepIcon state={state} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <p style={{ 
                  margin: 0, fontWeight: 700, fontSize: '0.9rem', 
                  color: isActive ? 'oklch(0.623 0.214 259.815)' : isDone ? 'var(--foreground)' : 'var(--muted-foreground)' 
                }}>
                  {step.label}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--muted-foreground)', opacity: 0.8 }}>
                  {isActive ? currentStepMessage : step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Results Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        {status === 'completed' && (
          <button
            onClick={onViewResults}
            className="animate-fade-in-up"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: 700,
              background: 'oklch(0.623 0.214 259.815)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px 0 oklch(0.623 0.214 259.815 / 39%)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.58 0.2 260)'}
            onMouseLeave={e => e.currentTarget.style.background = 'oklch(0.623 0.214 259.815)'}
          >
            Ver Resultados
          </button>
        )}
      </div>
    </div>
  );
}
