import type { TabId } from '../types';

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: 'overview', label: 'Overview', color: '#a0a0b0' },
  { id: 'rrls', label: 'RRLS', color: '#d32f2f' },
  { id: 'nts', label: '\u2622 NTS', color: '#fdd835' },
  { id: 'crls', label: 'CRLS', color: '#d62728' },
  { id: 'lrls', label: 'LRLS', color: '#ff7f0e' },
  { id: 'timeseries', label: 'Time Series', color: '#2ca02c' },
  { id: 'statements', label: 'Statement Browser', color: '#9467bd' },
  { id: 'analytics', label: 'Causal Analytics', color: '#4fc3f7' },
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
