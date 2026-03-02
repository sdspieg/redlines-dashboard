import type { TabId } from '../types';

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: 'overview', label: 'Overview', color: '#8b949e' },
  { id: 'rrls', label: 'RRLS Explorer', color: '#58a6ff' },
  { id: 'nts', label: 'NTS Explorer', color: '#f0883e' },
  { id: 'crls', label: 'CRLS', color: '#da3633' },
  { id: 'timeseries', label: 'Time Series', color: '#3fb950' },
  { id: 'statements', label: 'Statement Browser', color: '#bc8cff' },
];

export default function TabNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tab-nav">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab-btn ${active === t.id ? 'active' : ''}`}
          style={{ borderBottomColor: active === t.id ? t.color : 'transparent' }}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
