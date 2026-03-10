import { useEffect, useState } from 'react';
import Plot from './Plot';
import { load } from '../data';
import ChartInfo from './ChartInfo';
import type {
  LRLSStats, LRLSLangRow, LRLSPhraseRow, LRLSSourceRow, LRLSMatch, MonthlyRow,
} from '../types';

const LANG_COLORS: Record<string, string> = { ru: '#e05c5c', en: '#4fc3f7', uk: '#fdd835' };
const LANG_LABELS: Record<string, string> = { ru: 'Russian', en: 'English', uk: 'Ukrainian' };

const PAGE_SIZE = 15;

export default function LRLSExplorer() {
  const [stats, setStats] = useState<LRLSStats | null>(null);
  const [byLang, setByLang] = useState<LRLSLangRow[]>([]);
  const [monthly, setMonthly] = useState<(MonthlyRow & { lang: string })[]>([]);
  const [bySource, setBySource] = useState<LRLSSourceRow[]>([]);
  const [topPhrases, setTopPhrases] = useState<LRLSPhraseRow[]>([]);
  const [matches, setMatches] = useState<LRLSMatch[]>([]);
  const [chunks, setChunks] = useState<{ month: string; total_chunks: number }[]>([]);

  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<'absolute' | 'relative'>('absolute');
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    load<LRLSStats>('lrls_stats.json').then(setStats);
    load<LRLSLangRow[]>('lrls_by_lang.json').then(setByLang);
    load<(MonthlyRow & { lang: string })[]>('lrls_monthly.json').then(setMonthly);
    load<LRLSSourceRow[]>('lrls_by_source.json').then(setBySource);
    load<LRLSPhraseRow[]>('lrls_top_phrases.json').then(setTopPhrases);
    load<LRLSMatch[]>('lrls_matches.json').then(setMatches);
    load<{ month: string; total_chunks: number }[]>('chunks_monthly.json').then(setChunks);
  }, []);

  // Filter matches by source for timeline
  const filteredMatches = sourceFilter === 'all' ? matches : matches.filter(m => {
    if (sourceFilter === 'kremlin') return m.source === 'kremlin.ru';
    if (sourceFilter === 'duma') return m.source === 'duma.gov.ru';
    if (sourceFilter === 'federation') return m.source === 'council.gov.ru';
    if (sourceFilter === 'telegram') return m.db === 'telegram_official';
    return true;
  });

  // Recompute monthly data based on filtered matches
  const monthlyFiltered: Record<string, Record<string, number>> = {};
  filteredMatches.forEach(m => {
    if (!m.date) return;
    const month = m.date.substring(0, 7); // YYYY-MM
    if (!monthlyFiltered[month]) monthlyFiltered[month] = {};
    if (!monthlyFiltered[month][m.lang]) monthlyFiltered[month][m.lang] = 0;
    monthlyFiltered[month][m.lang]++;
  });

  // Get langs and months from filtered data
  const langs = sourceFilter === 'all'
    ? [...new Set(monthly.map(r => r.lang))].sort()
    : [...new Set(filteredMatches.map(m => m.lang))].sort();

  const months = sourceFilter === 'all'
    ? [...new Set(monthly.map(r => r.month))].sort()
    : [...new Set(Object.keys(monthlyFiltered))].sort();

  // Create chunks map for easy lookup
  const chunksMap: Record<string, number> = {};
  chunks.forEach(c => { chunksMap[c.month] = c.total_chunks; });

  // Filter matches for browser
  const filtered = matches.filter(m => {
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      m.sentence?.toLowerCase().includes(term) ||
      m.matched_phrase?.toLowerCase().includes(term) ||
      m.source?.toLowerCase().includes(term);
    const matchesLang = langFilter === 'all' || m.lang === langFilter;
    return matchesSearch && matchesLang;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSearchChange(v: string) { setSearch(v); setPage(0); }
  function handleLangChange(v: string) { setLangFilter(v); setPage(0); }

  function highlight(text: string, phrase: string): string {
    if (!phrase || !text) return text;
    try {
      const re = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return text.replace(re, '<mark>$1</mark>');
    } catch {
      return text;
    }
  }

  return (
    <div className="tab-content">
      <h2 style={{ color: '#ff7f0e' }}>Literal Red Lines (LRLS)</h2>
      <p className="subtitle">
        Chunks where the phrase "red lines" (or equivalent) appears verbatim — regex-matched across
        Russian (<em>красная черта / линия / граница</em>), Ukrainian (<em>червона лінія / межа</em>),
        and English (<em>red line(s)</em>) source texts.
      </p>

      {/* Stat cards */}
      {stats && (
        <div className="stat-cards">
          <div className="stat-card">
            <div className="stat-value">{stats.total_matches}</div>
            <div className="stat-label">Total Matches</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.unique_chunks}</div>
            <div className="stat-label">Unique Chunks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: LANG_COLORS.ru }}>{stats.ru_matches}</div>
            <div className="stat-label">Russian Matches</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: LANG_COLORS.en }}>{stats.en_matches}</div>
            <div className="stat-label">English Matches</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.ru_chunks}</div>
            <div className="stat-label">RU Unique Chunks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.en_chunks}</div>
            <div className="stat-label">EN Unique Chunks</div>
          </div>
        </div>
      )}

      {/* Monthly trend with toggle */}
      <div className="chart-row">
        <div className="chart-box" style={{ minWidth: '100%' }}>
          <div className="chart-title-bar">
            <h4>LRLS Matches Over Time — {viewMode === 'absolute' ? 'Absolute Counts' : 'Relative Rate (%)'}</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                padding: '6px 12px',
                background: '#0a1929',
                border: '1px solid #3a5a8a',
                borderRadius: '4px',
                color: '#ff7f0e',
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                Total: {filteredMatches.length} {sourceFilter !== 'all' && `(${sourceFilter === 'kremlin' ? 'Kremlin' : sourceFilter === 'duma' ? 'Duma' : sourceFilter === 'federation' ? 'Fed. Council' : 'Telegram'})`}
              </div>
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                style={{
                  padding: '4px 10px',
                  background: '#1e2a45',
                  border: '1px solid #3a5a8a',
                  color: '#e0e0e0',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Sources</option>
                <option value="kremlin">Kremlin</option>
                <option value="duma">State Duma</option>
                <option value="federation">Federation Council</option>
                <option value="telegram">Official Telegram</option>
              </select>
              <button
                onClick={() => setViewMode('absolute')}
                style={{
                  padding: '4px 12px',
                  background: viewMode === 'absolute' ? '#2a5599' : '#1e2a45',
                  border: '1px solid #3a5a8a',
                  color: '#e0e0e0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Absolute
              </button>
              <button
                onClick={() => setViewMode('relative')}
                style={{
                  padding: '4px 12px',
                  background: viewMode === 'relative' ? '#2a5599' : '#1e2a45',
                  border: '1px solid #3a5a8a',
                  color: '#e0e0e0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Relative %
              </button>
              <ChartInfo
                title={viewMode === 'absolute' ? "Absolute LRLS Counts" : "Relative LRLS Rate"}
                description={viewMode === 'absolute'
                  ? "Monthly count of literal 'red lines' phrase mentions, split by language. Shows raw frequencies over time."
                  : "Percentage of chunks containing literal 'red lines' phrases per month. Normalizes for varying corpus size to reveal whether red lines rhetoric is becoming more prevalent."
                }
              />
            </div>
          </div>
          <Plot
            data={langs.map(lang => ({
              type: 'scatter' as const,
              mode: 'lines+markers' as const,
              name: LANG_LABELS[lang] ?? lang,
              x: months,
              y: months.map(m => {
                let count = 0;
                if (sourceFilter === 'all') {
                  const row = monthly.find(r => r.month === m && r.lang === lang);
                  count = row ? row.count : 0;
                } else {
                  count = (monthlyFiltered[m] && monthlyFiltered[m][lang]) || 0;
                }
                if (viewMode === 'absolute') {
                  return count;
                } else {
                  const totalChunks = chunksMap[m] || 1;
                  return (count / totalChunks) * 100;
                }
              }),
              line: { color: LANG_COLORS[lang] ?? '#aaa', width: 2 },
              marker: { color: LANG_COLORS[lang] ?? '#aaa', size: 4 },
            }))}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 40, l: 60, r: 20 },
              height: 350,
              xaxis: { title: 'Month' },
              yaxis: {
                title: viewMode === 'absolute' ? 'Matches' : '% of Chunks',
                ticksuffix: viewMode === 'relative' ? '%' : ''
              },
              legend: { orientation: 'h', y: 1.12 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Language breakdown */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: '0 0 320px' }}>
          <div className="chart-title-bar">
            <h4>Matches by Language</h4>
            <ChartInfo
              title="Matches by Language"
              description="Number of regex matches and unique chunks per language. Only Russian sources are currently in the pipeline, so English matches come from EN-language content within Russian outlets."
            />
          </div>
          <Plot
            data={[
              {
                type: 'bar',
                name: 'Matches',
                x: byLang.map(r => LANG_LABELS[r.lang] ?? r.lang),
                y: byLang.map(r => r.matches),
                marker: { color: byLang.map(r => LANG_COLORS[r.lang] ?? '#aaa') },
                text: byLang.map(r => r.matches.toString()),
                textposition: 'outside',
              },
            ]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 20, b: 40, l: 50, r: 20 },
              height: 280,
              yaxis: { title: 'Matches' },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Source breakdown */}
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>LRLS Matches by Source</h4>
            <ChartInfo
              title="LRLS Matches by Source"
              description="Total number of literal 'red lines' phrase matches per source, stacked by language."
            />
          </div>
          <Plot
            data={[
              {
                type: 'bar',
                name: 'Russian',
                x: bySource.slice(0, 15).map(r => r.source),
                y: bySource.slice(0, 15).map(r => r.ru_count),
                marker: { color: LANG_COLORS.ru },
              },
              {
                type: 'bar',
                name: 'English',
                x: bySource.slice(0, 15).map(r => r.source),
                y: bySource.slice(0, 15).map(r => r.en_count),
                marker: { color: LANG_COLORS.en },
              },
            ]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 120, l: 60, r: 20 },
              height: 380,
              barmode: 'stack',
              xaxis: { tickangle: -45 },
              yaxis: { title: 'Matches' },
              legend: { orientation: 'h', y: 1.08 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Match browser */}
      <div className="chart-row">
        <div className="chart-box" style={{ minWidth: '100%' }}>
          <div className="chart-title-bar">
            <h4>Match Browser</h4>
            <ChartInfo
              title="Match Browser"
              description="Browse all literal 'red lines' matches. Each row shows the sentence containing the matched phrase, the source, date, and language. Matched phrase is highlighted."
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search sentence, phrase, or source…"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                flex: 1, minWidth: '240px', padding: '6px 10px',
                background: '#0d1626', border: '1px solid #2a3a5a',
                color: '#e0e0e0', borderRadius: '4px', fontSize: '13px',
              }}
            />
            <select
              value={langFilter}
              onChange={e => handleLangChange(e.target.value)}
              style={{
                padding: '6px 10px', background: '#0d1626',
                border: '1px solid #2a3a5a', color: '#e0e0e0',
                borderRadius: '4px', fontSize: '13px',
              }}
            >
              <option value="all">All languages</option>
              <option value="ru">Russian</option>
              <option value="en">English</option>
              <option value="uk">Ukrainian</option>
            </select>
          </div>

          <div style={{ fontSize: '12px', color: '#8899aa', marginBottom: '8px' }}>
            {filtered.length} match{filtered.length !== 1 ? 'es' : ''} found
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a3a5a', color: '#8899aa', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', width: '90px' }}>Date</th>
                  <th style={{ padding: '6px 8px', width: '120px' }}>Source</th>
                  <th style={{ padding: '6px 8px', width: '60px' }}>Lang</th>
                  <th style={{ padding: '6px 8px', width: '140px' }}>Matched Phrase</th>
                  <th style={{ padding: '6px 8px' }}>Sentence</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((m, i) => (
                  <tr
                    key={`${m.chunk_id}-${i}`}
                    style={{
                      borderBottom: '1px solid #1a2a3a',
                      verticalAlign: 'top',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <td style={{ padding: '6px 8px', color: '#8899aa', whiteSpace: 'nowrap' }}>
                      {m.date ?? '—'}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#aabbcc', fontSize: '12px' }}>
                      {m.source}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        background: LANG_COLORS[m.lang] ?? '#555',
                        color: m.lang === 'en' ? '#000' : '#fff',
                        borderRadius: '3px', padding: '1px 5px', fontSize: '11px', fontWeight: 600,
                      }}>
                        {m.lang.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '12px', color: '#ff7f0e' }}>
                      {m.matched_phrase}
                    </td>
                    <td
                      style={{ padding: '6px 8px', lineHeight: 1.5 }}
                      dangerouslySetInnerHTML={{
                        __html: highlight(m.sentence ?? m.paragraph ?? '', m.matched_phrase),
                      }}
                    />
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#556' }}>
                      No matches found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', justifyContent: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ padding: '4px 12px', background: '#1e2a45', border: '1px solid #2a3a5a', color: '#e0e0e0', borderRadius: '4px', cursor: 'pointer' }}
              >
                ←
              </button>
              <span style={{ color: '#8899aa', fontSize: '13px' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{ padding: '4px 12px', background: '#1e2a45', border: '1px solid #2a3a5a', color: '#e0e0e0', borderRadius: '4px', cursor: 'pointer' }}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top phrases - moved to bottom */}
      <div className="chart-row">
        <div className="chart-box" style={{ minWidth: '100%' }}>
          <div className="chart-title-bar">
            <h4>Top Matched Phrases</h4>
            <ChartInfo
              title="Top Matched Phrases"
              description="Most frequently matched surface forms of 'red lines' across all languages. Russian inflected forms dominate due to grammatical case variation."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              orientation: 'h',
              x: topPhrases.slice(0, 20).map(r => r.count),
              y: topPhrases.slice(0, 20).map(r => r.matched_phrase),
              marker: { color: topPhrases.slice(0, 20).map(r => LANG_COLORS[r.lang] ?? '#aaa') },
              text: topPhrases.slice(0, 20).map(r => r.count.toString()),
              textposition: 'outside',
              hovertemplate: '%{y}: %{x} matches<extra></extra>',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 20, l: 220, r: 60 },
              height: 520,
              yaxis: { autorange: 'reversed' },
              xaxis: { title: 'Count' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}