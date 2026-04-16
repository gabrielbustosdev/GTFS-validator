import { AlertTriangle, XCircle, Bus, Route, MapPin, Clock } from 'lucide-react';

const KPI_CONFIG = [
  {
    key: 'errors',
    label: 'Fatal Errors',
    icon: XCircle,
    color: 'oklch(0.637 0.237 25.331)',
    bg: 'oklch(0.396 0.141 25.768 / 15%)',
    border: 'oklch(0.396 0.141 25.768 / 30%)',
    getValue: (s) => s?.errors ?? 0,
  },
  {
    key: 'warnings',
    label: 'Warnings',
    icon: AlertTriangle,
    color: 'oklch(0.795 0.184 86.047)',
    bg: 'oklch(0.795 0.184 86.047 / 12%)',
    border: 'oklch(0.795 0.184 86.047 / 25%)',
    getValue: (s) => s?.warnings ?? 0,
  },
  {
    key: 'stops',
    label: 'Stops',
    icon: MapPin,
    color: 'oklch(0.623 0.214 259.815)',
    bg: 'oklch(0.623 0.214 259.815 / 12%)',
    border: 'oklch(0.623 0.214 259.815 / 25%)',
    getValue: (s) => s?.stats?.total_stops ?? 0,
  },
  {
    key: 'routes',
    label: 'Routes',
    icon: Route,
    color: 'oklch(0.7 0.19 310)',
    bg: 'oklch(0.7 0.19 310 / 12%)',
    border: 'oklch(0.7 0.19 310 / 25%)',
    getValue: (s) => s?.stats?.total_routes ?? 0,
  },
  {
    key: 'trips',
    label: 'Trips',
    icon: Bus,
    color: 'oklch(0.723 0.219 149.579)',
    bg: 'oklch(0.723 0.219 149.579 / 12%)',
    border: 'oklch(0.723 0.219 149.579 / 25%)',
    getValue: (s) => s?.stats?.total_trips ?? 0,
  },
  {
    key: 'shapes',
    label: 'Shapes',
    icon: Clock,
    color: 'oklch(0.77 0.15 195)',
    bg: 'oklch(0.77 0.15 195 / 12%)',
    border: 'oklch(0.77 0.15 195 / 25%)',
    getValue: (s) => s?.stats?.total_shapes ?? 0,
  },
];

export default function KPIStats({ summary }) {
  if (!summary) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '1rem',
    }}>
      {KPI_CONFIG.map((kpi) => {
        const Icon = kpi.icon;
        const value = kpi.getValue(summary);
        return (
          <div
            key={kpi.key}
            id={`kpi-${kpi.key}`}
            className="animate-fade-in-up"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              background: kpi.bg,
              border: `1px solid ${kpi.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${kpi.color}30`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <Icon size={20} style={{ color: kpi.color }} />
            <div>
              <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: kpi.color, lineHeight: 1 }}>
                {value.toLocaleString()}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                {kpi.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
