import { useEffect, useState, useMemo, useCallback } from 'react';
import { load } from '../data';
import { RRLS_COLORS, NTS_COLORS, getDimValueColor } from '../colors';
import ChartInfo from './ChartInfo';
import type { RRLSStatement, NTSStatement } from '../types';

type Mode = 'rrls' | 'nts';

interface FilterDef {
  key: string;
  label: string;
}

const RRLS_FILTERS: FilterDef[] = [
  { key: 'theme', label: 'Theme' },
  { key: 'audience', label: 'Audience' },
  { key: 'nature_of_threat', label: 'Nature of Threat' },
  { key: 'level_of_escalation', label: 'Escalation' },
  { key: 'line_type', label: 'Line Type' },
  { key: 'threat_type', label: 'Threat Type' },
  { key: 'specificity', label: 'Specificity' },
  { key: 'immediacy', label: 'Immediacy' },
];

const NTS_FILTERS: FilterDef[] = [
  { key: 'nts_statement_type', label: 'Statement Type' },
  { key: 'nts_threat_type', label: 'Threat Type' },
  { key: 'capability', label: 'Capability' },
  { key: 'tone', label: 'Tone' },
  { key: 'consequences', label: 'Consequences' },
  { key: 'conditionality', label: 'Conditionality' },
  { key: 'specificity', label: 'Specificity' },
];

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="search-highlight">{part}</mark>
      : part
  );
}

export default function Statements() {
  const [mode, setMode] = useState<Mode>('rrls');
  const [rrls, setRrls] = useState<RRLSStatement[]>([]);
  const [nts, setNts] = useState<NTSStatement[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dimFilters, setDimFilters] = useState<Record<string, string>>({});
  const [minConfidence, setMinConfidence] = useState(7);
  const [page, setPage] = useState(0);

  useEffect(() => {
    load<RRLSStatement[]>('rrls_statements.json').then(setRrls);
    load<NTSStatement[]>('nts_statements.json').then(setNts);
  }, []);

  const data: (RRLSStatement | NTSStatement)[] = mode === 'rrls' ? rrls : nts;
  const sources = useMemo(() => [...new Set(data.map(r => r.source))].sort(), [data]);
  const filterDefs = mode === 'rrls' ? RRLS_FILTERS : NTS_FILTERS;

  // Extract unique values for each dimension filter
  const dimOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const f of filterDefs) {
      const vals = new Set<string>();
      for (const r of data) {
        const v = (r as unknown as Record<string, unknown>)[f.key] as string;
        if (v) vals.add(v);
      }
      opts[f.key] = [...vals].sort();
    }
    return opts;
  }, [data, filterDefs]);

  const filtered = useMemo(() => {
    let d = data;
    if (sourceFilter) d = d.filter(r => r.source === sourceFilter);
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(r =>
        (r.context_text_span || '').toLowerCase().includes(s) ||
        (r.speaker || '').toLowerCase().includes(s) ||
        (r.target || '').toLowerCase().includes(s)
      );
    }
    // Apply dimension filters
    for (const [key, val] of Object.entries(dimFilters)) {
      if (val) {
        d = d.filter(r => (r as unknown as Record<string, unknown>)[key] === val);
      }
    }
    // Apply confidence filter
    if (minConfidence > 7) {
      d = d.filter(r => (r.overall_confidence ?? 0) >= minConfidence);
    }
    return d;
  }, [data, sourceFilter, search, dimFilters, minConfidence]);

  const PAGE_SIZE = 20;
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Reset page when any filter changes
  useEffect(() => setPage(0), [mode, sourceFilter, search, dimFilters, minConfidence]);

  // Reset dimension filters when mode changes
  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode);
    setDimFilters({});
    setSourceFilter('');
    setSearch('');
    setMinConfidence(7);
  }, []);

  const setDimFilter = useCallback((key: string, value: string) => {
    setDimFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const activeFilterCount = Object.values(dimFilters).filter(Boolean).length +
    (sourceFilter ? 1 : 0) + (search ? 1 : 0) + (minConfidence > 7 ? 1 : 0);

  const clearAll = useCallback(() => {
    setDimFilters({});
    setSourceFilter('');
    setSearch('');
    setMinConfidence(7);
  }, []);

  return (
    <div className="tab-content">
      <h2 style={{ color: '#9467bd' }}>
        Statement Browser
        <ChartInfo
          title="Statement Browser"
          description="Browse and search individual RRLS and NTS statements. Use the dropdown filters to narrow by taxonomy dimensions, source, or free-text search. Each card shows the statement context, metadata tags, and classification labels."
        />
      </h2>

      <div className="filter-bar">
        <button className={`mode-btn ${mode === 'rrls' ? 'active-rrls' : ''}`} onClick={() => handleModeChange('rrls')}>
          RRLS ({rrls.length.toLocaleString()})
        </button>
        <button className={`mode-btn ${mode === 'nts' ? 'active-nts' : ''}`} onClick={() => handleModeChange('nts')}>
          {'\u2622'} NTS ({nts.length.toLocaleString()})
        </button>

        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          type="text" placeholder="Search text, speaker, target..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="search-input"
        />

        <div className="confidence-slider">
          <label>Confidence {'\u2265'}</label>
          <input
            type="range" min={7} max={10} step={1}
            value={minConfidence}
            onChange={e => setMinConfidence(Number(e.target.value))}
          />
          <span className="conf-value">{minConfidence}</span>
        </div>

        <span className="result-count">{filtered.length.toLocaleString()} results</span>
      </div>

      {/* Taxonomy dimension filter dropdowns */}
      <div className="filter-bar dim-filters">
        {filterDefs.map(f => (
          <select
            key={f.key}
            value={dimFilters[f.key] || ''}
            onChange={e => setDimFilter(f.key, e.target.value)}
            title={f.label}
          >
            <option value="">{f.label}</option>
            {(dimOptions[f.key] || []).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
        {activeFilterCount > 0 && (
          <button className="mode-btn" onClick={clearAll} style={{ fontSize: 12 }}>
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      <div className="stmt-list">
        {pageData.map((stmt, i) => (
          <div key={`${stmt.chunk_id}-${i}`} className="stmt-card">
            <div className="stmt-meta">
              <span className="stmt-date">{stmt.date || 'No date'}</span>
              <span className="stmt-source">{stmt.source}</span>
              <span className="stmt-db">{stmt.db}</span>
              {stmt.overall_confidence && <span className="stmt-db">Conf: {stmt.overall_confidence}/10</span>}
              {stmt.speaker && <span className="stmt-speaker">Speaker: {highlightText(stmt.speaker, search)}</span>}
              {stmt.target && <span className="stmt-target">Target: {highlightText(stmt.target, search)}</span>}
            </div>
            <div className="stmt-text">{stmt.context_text_span ? highlightText(stmt.context_text_span, search) : '(no text)'}</div>
            {mode === 'rrls' && (() => {
              const s = stmt as RRLSStatement;
              const tag = (dim: string, val: string | undefined, label?: string) => {
                if (!val) return null;
                const c = getDimValueColor(RRLS_COLORS, dim, val, 0);
                return <span key={dim} className="tag" style={{ background: `${c}33`, color: c }}>{label ? `${label}: ${val}` : val}</span>;
              };
              return (
                <div className="stmt-tags">
                  {tag('theme', s.theme)}
                  {tag('audience', s.audience)}
                  {tag('nature_of_threat', s.nature_of_threat)}
                  {tag('level_of_escalation', s.level_of_escalation)}
                  {tag('line', s.line_type, 'Line')}
                  {tag('threat', s.threat_type, 'Threat')}
                  {tag('specificity', s.specificity)}
                  {tag('immediacy', s.immediacy)}
                </div>
              );
            })()}
            {mode === 'nts' && (() => {
              const s = stmt as NTSStatement;
              const tag = (dim: string, val: string | undefined, label?: string) => {
                if (!val) return null;
                const c = getDimValueColor(NTS_COLORS, dim, val, 0);
                return <span key={dim} className="tag" style={{ background: `${c}33`, color: c }}>{label ? `${label}: ${val}` : val}</span>;
              };
              return (
                <div className="stmt-tags">
                  {tag('nts_statement_type', s.nts_statement_type)}
                  {tag('nts_threat_type', s.nts_threat_type)}
                  {tag('capability', s.capability)}
                  {tag('tone', s.tone, 'Tone')}
                  {tag('consequences', s.consequences, 'Consequences')}
                  {tag('specificity', s.specificity)}
                  {tag('conditionality', s.conditionality)}
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
