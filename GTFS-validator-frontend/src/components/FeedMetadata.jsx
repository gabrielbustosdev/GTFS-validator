import { Building2, Calendar, Link as LinkIcon, Phone } from 'lucide-react';

export default function FeedMetadata({ agencies, validity }) {
  if (!agencies || agencies.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      {/* Validity Dates Card */}
      <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid oklch(1 0 0 / 10%)' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} /> Feed Validity Range
        </h3>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Start Date</p>
            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{validity?.start || 'N/A'}</p>
          </div>
          <div style={{ width: '1px', background: 'oklch(1 0 0 / 10%)' }} />
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>End Date</p>
            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: validity?.end < new Date().toISOString().slice(0, 10).replace(/-/g, '') ? 'oklch(0.637 0.237 25.331)' : 'inherit' }}>
              {validity?.end || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Agencies Card */}
      <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid oklch(1 0 0 / 10%)' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={16} /> Data Providers (Agencies)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {agencies.map((agency, i) => (
            <div key={i} style={{ 
              padding: '1rem', borderRadius: '0.75rem', background: 'oklch(1 0 0 / 4%)', 
              border: '1px solid oklch(1 0 0 / 8%)', display: 'flex', flexDirection: 'column', gap: '0.4rem' 
            }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{agency.agency_name}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                {agency.agency_url && (
                  <a href={agency.agency_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'oklch(0.623 0.214 259.815)', textDecoration: 'none' }}>
                    <LinkIcon size={12} /> {agency.agency_url}
                  </a>
                )}
                {agency.agency_phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Phone size={12} /> {agency.agency_phone}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
