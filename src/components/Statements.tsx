import { useEffect, useState, useMemo, useCallback } from 'react';
import { load } from '../data';
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

export default function Statements() {
  const [mode, setMode] = useState<Mode>('rrls');
  const [rrls, setRrls] = useState<RRLSStatement[]>([]);
  const [nts, setNts] = useState<NTSStatement[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dimFilters, setDimFilters] = useState<Record<string, string>>({});
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
    return d;
  }, [data, sourceFilter, search, dimFilters]);

  const PAGE_SIZE = 20;
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Reset page when any filter changes
  useEffect(() => setPage(0), [mode, sourceFilter, search, dimFilters]);

  // Reset dimension filters when mode changes
  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode);
    setDimFilters({});
    setSourceFilter('');
    setSearch('');
  }, []);

  const setDimFilter = useCallback((key: string, value: string) => {
    setDimFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const activeFilterCount = Object.values(dimFilters).filter(Boolean).length +
    (sourceFilter ? 1 : 0) + (search ? 1 : 0);

  const clearAll = useCallback(() => {
    setDimFilters({});
    setSourceFilter('');
    setSearch('');
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
          NTS ({nts.length.toLocaleString()})
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
              {stmt.speaker && <span className="stmt-speaker">Speaker: {stmt.speaker}</span>}
              {stmt.target && <span className="stmt-target">Target: {stmt.target}</span>}
            </div>
            <div className="stmt-text">{stmt.context_text_span || '(no text)'}</div>
            {mode === 'rrls' && (
              <div className="stmt-tags">
                {(stmt as RRLSStatement).theme && <span className="tag tag-blue">{(stmt as RRLSStatement).theme}</span>}
                {(stmt as RRLSStatement).audience && <span className="tag tag-green">{(stmt as RRLSStatement).audience}</span>}
                {(stmt as RRLSStatement).nature_of_threat && <span className="tag tag-orange">{(stmt as RRLSStatement).nature_of_threat}</span>}
                {(stmt as RRLSStatement).level_of_escalation && <span className="tag tag-red">{(stmt as RRLSStatement).level_of_escalation}</span>}
                {(stmt as RRLSStatement).line_type && <span className="tag tag-purple">Line: {(stmt as RRLSStatement).line_type}</span>}
                {(stmt as RRLSStatement).threat_type && <span className="tag tag-purple">Threat: {(stmt as RRLSStatement).threat_type}</span>}
              </div>
            )}
            {mode === 'nts' && (
              <div className="stmt-tags">
                {(stmt as NTSStatement).nts_statement_type && <span className="tag tag-orange">{(stmt as NTSStatement).nts_statement_type}</span>}
                {(stmt as NTSStatement).nts_threat_type && <span className="tag tag-red">{(stmt as NTSStatement).nts_threat_type}</span>}
                {(stmt as NTSStatement).capability && <span className="tag tag-blue">{(stmt as NTSStatement).capability}</span>}
                {(stmt as NTSStatement).tone && <span className="tag tag-purple">Tone: {(stmt as NTSStatement).tone}</span>}
                {(stmt as NTSStatement).consequences && <span className="tag tag-red">Consequences: {(stmt as NTSStatement).consequences}</span>}
              </div>
            )}
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
