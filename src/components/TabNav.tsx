import type { TabId } from '../types';

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: 'overview', label: 'Overview', color: '#a0a0b0' },
  { id: 'rrls', label: 'RRLS Explorer', color: '#1f77b4' },
  { id: 'nts', label: 'NTS Explorer', color: '#ff7f0e' },
  { id: 'crls', label: 'CRLS', color: '#d62728' },
  { id: 'timeseries', label: 'Time Series', color: '#2ca02c' },
  { id: 'statements', label: 'Statement Browser', color: '#9467bd' },
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
