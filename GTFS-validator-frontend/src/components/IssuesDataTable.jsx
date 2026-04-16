import { useState, useMemo } from 'react';
import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, Search } from 'lucide-react';

const SEVERITY_CONFIG = {
  error: {
    label: 'Error',
    icon: XCircle,
    color: 'oklch(0.637 0.237 25.331)',
    bg: 'oklch(0.396 0.141 25.768 / 10%)',
    badge: 'oklch(0.396 0.141 25.768 / 25%)',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'oklch(0.795 0.184 86.047)',
    bg: 'oklch(0.795 0.184 86.047 / 8%)',
    badge: 'oklch(0.795 0.184 86.047 / 20%)',
  },
  info: {
    label: 'Info',
    icon: Info,
    color: 'oklch(0.623 0.214 259.815)',
    bg: 'oklch(0.623 0.214 259.815 / 8%)',
    badge: 'oklch(0.623 0.214 259.815 / 20%)',
  },
};

const PAGE_SIZE = 15;

export default function IssuesDataTable({ issues }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortDir, setSortDir] = useState('desc');

  const filtered = useMemo(() => {
    if (!issues) return [];
    let list = issues;
    if (filter !== 'all') list = list.filter(i => i.severity === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.rule_id?.toLowerCase().includes(q) ||
        i.message?.toLowerCase().includes(q) ||
        i.entity_id?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      const diff = (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
      return sortDir === 'desc' ? diff : -diff;
    });
  }, [issues, filter, search, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!issues || issues.length === 0) return (
    <div style={{
      padding: '3rem', textAlign: 'center',
      color: 'var(--muted-foreground)', fontSize: '0.9rem'
    }}>
      No issues found — this GTFS feed looks clean! ✓
    </div>
  );

  const counts = {
    all: issues.length,
    error: issues.filter(i => i.severity === 'error').length,
    warning: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', 'error', 'warning', 'info'].map(f => {
            const cfg = f === 'all' ? null : SEVERITY_CONFIG[f];
            const isActive = filter === f;
            return (
              <button
                key={f}
                id={`filter-${f}`}
                onClick={() => { setFilter(f); setPage(0); }}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? (cfg?.color || 'oklch(1 0 0 / 30%)') : 'oklch(1 0 0 / 10%)'}`,
                  background: isActive ? (cfg?.badge || 'oklch(1 0 0 / 10%)') : 'transparent',
                  color: isActive ? (cfg?.color || 'var(--foreground)') : 'var(--muted-foreground)',
                  transition: 'all 0.15s ease',
                }}
              >
                {f === 'all' ? 'All' : cfg.label} ({counts[f]})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'oklch(1 0 0 / 5%)', border: '1px solid oklch(1 0 0 / 10%)',
          borderRadius: '0.5rem', padding: '0.35rem 0.75rem', flex: 1, minWidth: '200px',
        }}>
          <Search size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          <input
            id="issues-search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by rule, message, entity..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--foreground)', width: '100%', fontSize: '0.85rem',
            }}
          />
        </div>

        {/* Sort toggle */}
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.35rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
            background: 'oklch(1 0 0 / 5%)', border: '1px solid oklch(1 0 0 / 10%)',
            color: 'var(--muted-foreground)', fontSize: '0.8rem',
          }}
        >
          Severity {sortDir === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>}
        </button>
      </div>

      {/* Table */}
      <div style={{
        borderRadius: 'var(--radius)', overflow: 'hidden',
        border: '1px solid oklch(1 0 0 / 10%)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'oklch(1 0 0 / 5%)' }}>
              {['Severity', 'Rule ID', 'Message', 'Entity'].map(h => (
                <th key={h} style={{
                  padding: '0.65rem 1rem', textAlign: 'left',
                  fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em',
                  color: 'var(--muted-foreground)', textTransform: 'uppercase',
                  borderBottom: '1px solid oklch(1 0 0 / 10%)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((issue, i) => {
              const cfg = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <tr
                  key={i}
                  className="animate-slide-in"
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'oklch(1 0 0 / 2%)',
                    borderBottom: '1px solid oklch(1 0 0 / 6%)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = cfg.bg}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'oklch(1 0 0 / 2%)'}
                >
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.2rem 0.6rem', borderRadius: '9999px',
                      background: cfg.badge, fontSize: '0.75rem', fontWeight: 600,
                      color: cfg.color,
                    }}>
                      <Icon size={11}/> {cfg.label}
                    </div>
                  </td>
                  <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: cfg.color }}>
                    {issue.rule_id || '—'}
                  </td>
                  <td style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--foreground)' }}>
                    {issue.message || issue.description || '—'}
                  </td>
                  <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                    {issue.entity_id || issue.affected_ids?.join(', ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.8rem', color: 'var(--muted-foreground)',
        }}>
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              id="table-prev"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '0.4rem', cursor: page === 0 ? 'not-allowed' : 'pointer',
                background: 'oklch(1 0 0 / 5%)', border: '1px solid oklch(1 0 0 / 10%)',
                color: 'var(--foreground)', opacity: page === 0 ? 0.4 : 1,
              }}
            >←</button>
            <button
              id="table-next"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '0.4rem', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                background: 'oklch(1 0 0 / 5%)', border: '1px solid oklch(1 0 0 / 10%)',
                color: 'var(--foreground)', opacity: page >= totalPages - 1 ? 0.4 : 1,
              }}
            >→</button>
          </div>
        </div>
      )}
    </div>
  );
}
