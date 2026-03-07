import { useEffect, useState } from 'react';
import Plot from './Plot';
import { load } from '../data';
import ChartInfo from './ChartInfo';
import type { OverviewStats, SourceRow, ComparativeRow, RRLSStatement, NTSStatement } from '../types';
import StatementDrilldown from './StatementDrilldown';

export default function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [chunks, setChunks] = useState<SourceRow[]>([]);
  const [rrls, setRrls] = useState<SourceRow[]>([]);
  const [nts, setNts] = useState<SourceRow[]>([]);
  const [comp, setComp] = useState<ComparativeRow[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [rrlsStmts, setRrlsStmts] = useState<RRLSStatement[]>([]);
  const [ntsStmts, setNtsStmts] = useState<NTSStatement[]>([]);
  const [drilldown, setDrilldown] = useState<{ title: string; stmts: (RRLSStatement | NTSStatement)[]; mode: 'rrls' | 'nts' } | null>(null);

  useEffect(() => {
    load<OverviewStats>('overview_stats.json').then(setStats);
    load<SourceRow[]>('chunks_by_source.json').then(setChunks);
    load<SourceRow[]>('rrls_by_source.json').then(setRrls);
    load<SourceRow[]>('nts_by_source.json').then(setNts);
    load<ComparativeRow[]>('comparative_by_db.json').then(setComp);
    load<RRLSStatement[]>('rrls_statements.json').then(setRrlsStmts);
    load<NTSStatement[]>('nts_statements.json').then(setNtsStmts);
  }, []);

  if (!stats) return <div className="loading">Loading...</div>;

  const funnelLabels = ['Total Chunks', '1st Pass RLS', '2nd Pass RRLS', '3rd Pass', 'CRLS'];
  const funnelVals = [stats.total_chunks, stats.fpa_rls_relevant, stats.rls2_confirmed, stats.rls3_confirmed, stats.crls_count];

  const ntsFunnel = ['Total Chunks', '\u2622 1st Pass NTS', '\u2622 2nd Pass NTS'];
  const ntsVals = [stats.total_chunks, stats.fpa_nts_relevant, stats.nts2_confirmed];

  const top = rrls.slice(0, 15);

  // Build lookup: source -> total_chunks from chunks_by_source data
  const chunksBySource: Record<string, number> = {};
  for (const r of chunks) chunksBySource[r.source] = r.total_chunks ?? 0;

  return (
    <div className="tab-content">
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-val">{stats.total_docs.toLocaleString()}</div>
          <div className="stat-label">Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.total_chunks.toLocaleString()}</div>
          <div className="stat-label">Chunks</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#d32f2f' }}>
          <div className="stat-val">{stats.rls2_confirmed.toLocaleString()}</div>
          <div className="stat-label">RRLS ({((stats.rls2_confirmed / stats.total_chunks) * 100).toFixed(1)}% of chunks)</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#fdd835' }}>
          <div className="stat-val">{stats.nts2_confirmed.toLocaleString()}</div>
          <div className="stat-label">{'\u2622'} NTS ({((stats.nts2_confirmed / stats.total_chunks) * 100).toFixed(1)}% of chunks)</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#d62728' }}>
          <div className="stat-val">{stats.crls_count.toLocaleString()}</div>
          <div className="stat-label">CRLS ({((stats.crls_count / stats.total_chunks) * 100).toFixed(1)}% of chunks)</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.total_sources}</div>
          <div className="stat-label">Sources</div>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>{'RLS \u2192 RRLS \u2192 CRLS Pipeline'}</h4>
            <ChartInfo
              title="RLS Pipeline Funnel"
              description="Funnel chart showing how text chunks are progressively filtered through the multi-pass annotation pipeline from raw chunks to confirmed RRLS and CRLS statements. Percentages show retention at each stage."
            />
          </div>
          <Plot
            data={[{
              type: 'funnel',
              y: funnelLabels,
              x: funnelVals,
              textinfo: 'value+percent initial',
              textfont: { weight: 700, size: 14 },
              marker: { color: ['#a0a0b0', '#d32f2f', '#c62828', '#b71c1c', '#d62728'] },
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' }, margin: { t: 10, b: 20, l: 120, r: 20 },
              height: 300,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>{'\u2622'} NTS Pipeline</h4>
            <ChartInfo
              title="NTS Pipeline Funnel"
              description="Funnel chart showing the nuclear threat statement annotation pipeline, from initial text chunks through first-pass screening to confirmed NTS statements. Percentages show retention at each stage."
            />
          </div>
          <Plot
            data={[{
              type: 'funnel',
              y: ntsFunnel,
              x: ntsVals,
              textinfo: 'value+percent initial',
              textfont: { weight: 700, size: 14 },
              marker: { color: ['#a0a0b0', '#fdd835', '#f9a825'] },
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' }, margin: { t: 10, b: 20, l: 120, r: 20 },
              height: 300,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>Confirmed Statements by Source — Absolute (Top 15)</h4>
            <ChartInfo
              title="Confirmed Statements by Source — Absolute"
              description="Grouped bar chart comparing RRLS and NTS confirmed statement counts across the top 15 sources. Shows which sources generate the most red line and nuclear threat rhetoric."
            />
          </div>
          <Plot
            data={[
              {
                type: 'bar', name: 'RRLS', x: top.map(r => r.source), y: top.map(r => r.confirmed ?? 0),
                marker: { color: '#d32f2f' },
              },
              {
                type: 'bar', name: '\u2622 NTS',
                x: nts.slice(0, 15).map(r => r.source),
                y: nts.slice(0, 15).map(r => r.confirmed ?? 0),
                marker: { color: '#fdd835' },
              },
            ]}
            layout={{
              barmode: 'group',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              xaxis: { tickangle: -45 },
              margin: { t: 10, b: 120, l: 60, r: 20 },
              height: 400,
              yaxis: { title: 'Count' },
              legend: { orientation: 'h', y: 1.1 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
              const pt = e.points?.[0];
              if (!pt) return;
              const source = pt.x;
              const isNts = pt.data.name.includes('NTS');
              const stmts = isNts ? ntsStmts : rrlsStmts;
              const matching = stmts.filter(s => s.source === source);
              setDrilldown({ title: `${pt.data.name} — ${source}`, stmts: matching, mode: isNts ? 'nts' : 'rrls' });
            }}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>Confirmed Statements by Source — % of Chunks (Top 15)</h4>
            <ChartInfo
              title="Confirmed Statements by Source — % of Chunks"
              description="What percentage of each source's text chunks are classified as RRLS or NTS. Normalizes for source size, revealing which sources have the densest red line or nuclear threat content."
            />
          </div>
          <Plot
            data={[
              {
                type: 'bar', name: 'RRLS %',
                x: top.map(r => r.source),
                y: top.map(r => { const tc = chunksBySource[r.source] || 0; return tc > 0 ? ((r.confirmed ?? 0) / tc) * 100 : 0; }),
                marker: { color: '#d32f2f' },
                text: top.map(r => { const tc = chunksBySource[r.source] || 0; return tc > 0 ? (((r.confirmed ?? 0) / tc) * 100).toFixed(1) + '%' : '0%'; }),
                textposition: 'outside',
              },
              {
                type: 'bar', name: '\u2622 NTS %',
                x: nts.slice(0, 15).map(r => r.source),
                y: nts.slice(0, 15).map(r => { const tc = chunksBySource[r.source] || 0; return tc > 0 ? ((r.confirmed ?? 0) / tc) * 100 : 0; }),
                marker: { color: '#fdd835' },
                text: nts.slice(0, 15).map(r => { const tc = chunksBySource[r.source] || 0; return tc > 0 ? (((r.confirmed ?? 0) / tc) * 100).toFixed(1) + '%' : '0%'; }),
                textposition: 'outside',
              },
            ]}
            layout={{
              barmode: 'group',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              xaxis: { tickangle: -45 },
              margin: { t: 10, b: 120, l: 60, r: 20 },
              height: 400,
              yaxis: { title: '% of Chunks', ticksuffix: '%' },
              legend: { orientation: 'h', y: 1.1 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
              const pt = e.points?.[0];
              if (!pt) return;
              const source = pt.x;
              const isNts = pt.data.name.includes('NTS');
              const stmts = isNts ? ntsStmts : rrlsStmts;
              const matching = stmts.filter(s => s.source === source);
              setDrilldown({ title: `${pt.data.name} — ${source}`, stmts: matching, mode: isNts ? 'nts' : 'rrls' });
            }}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Slope chart: RRLS rank vs NTS rank */}
      {rrls.length > 0 && nts.length > 0 && (() => {
        const shortName = (s: string) =>
          s.includes('Посольство России в США') ? 'Посольство России в США' :
          s.length > 30 ? s.slice(0, 28) + '...' : s;

        const rrlsRanked = rrls.slice(0, 20).map((r, i) => ({ source: r.source, rank: i + 1, confirmed: r.confirmed ?? 0 }));
        const ntsRanked = nts.slice(0, 20).map((r, i) => ({ source: r.source, rank: i + 1, confirmed: r.confirmed ?? 0 }));
        const ntsRankMap: Record<string, number> = {};
        for (const r of ntsRanked) ntsRankMap[r.source] = r.rank;
        const rrlsRankMap: Record<string, number> = {};
        for (const r of rrlsRanked) rrlsRankMap[r.source] = r.rank;
        const rrlsConfMap: Record<string, number> = {};
        for (const r of rrlsRanked) rrlsConfMap[r.source] = r.confirmed;
        const ntsConfMap: Record<string, number> = {};
        for (const r of ntsRanked) ntsConfMap[r.source] = r.confirmed;

        const allSources = [...new Set([...rrlsRanked.map(r => r.source), ...ntsRanked.map(r => r.source)])];
        const maxRank = 21;

        // Faint horizontal rank-reference lines (same rank left↔right)
        const rankLines: Partial<Plotly.Shape>[] = [];
        for (let rank = 1; rank <= maxRank; rank++) {
          rankLines.push({
            type: 'line', layer: 'below',
            x0: 0.15, x1: 0.85, y0: rank, y1: rank,
            line: { color: 'rgba(255,255,255,0.07)', width: 1 },
          });
        }

        // Color helper based on rank difference
        const diffColor = (diff: number) =>
          diff >= 8 ? '#d62728' : diff >= 4 ? '#ff7f0e' : '#a0a0b0';

        // Legend traces (invisible points, just for the legend)
        const legendTraces = [
          { name: 'Large change (8+)', color: '#d62728' },
          { name: 'Moderate change (4-7)', color: '#ff7f0e' },
          { name: 'Small change (0-3)', color: '#a0a0b0' },
        ].map(({ name, color }) => ({
          type: 'scatter' as const,
          mode: 'lines' as const,
          x: [null], y: [null],
          line: { color, width: 2 },
          name,
          showlegend: true,
        }));

        // Source connector traces: 3 points (left dot, midpoint for hover, right dot)
        const sel = selectedSource;
        const slopeTraces = allSources.map(src => {
          const rRank = rrlsRankMap[src] ?? maxRank;
          const nRank = ntsRankMap[src] ?? maxRank;
          const diff = Math.abs(rRank - nRank);
          const isSelected = sel === src;
          const isDimmed = sel !== null && !isSelected;

          const baseColor = diffColor(diff);
          let color: string;
          let width: number;
          if (isSelected) {
            color = baseColor; width = 3.5;
          } else if (isDimmed) {
            color = 'rgba(160,160,176,0.12)'; width = 1;
          } else {
            color = diff >= 4 ? baseColor : 'rgba(160,160,176,0.35)';
            width = diff >= 8 ? 2 : diff >= 4 ? 1.8 : 1;
          }

          const markerColor = isDimmed ? 'rgba(160,160,176,0.15)' : baseColor;

          const midY = (rRank + nRank) / 2;
          const rConf = rrlsConfMap[src] ?? 0;
          const nConf = ntsConfMap[src] ?? 0;
          const name = shortName(src);

          return {
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            x: [0.15, 0.5, 0.85],
            y: [rRank, midY, nRank],
            line: { color, width, shape: 'linear' as const },
            marker: { size: [6, 0.1, 6], color: markerColor },
            customdata: [src, src, src],
            hovertemplate: `<b>${name}</b><br>RRLS: rank ${rRank}${rRank <= 20 ? ` (${rConf} confirmed)` : ' (not in top 20)'}<br>\u2622 NTS: rank ${nRank}${nRank <= 20 ? ` (${nConf} confirmed)` : ' (not in top 20)'}<br>Rank change: ${diff === 0 ? 'same' : (nRank < rRank ? '\u25b2' : '\u25bc') + Math.abs(rRank - nRank)}<extra></extra>`,
            hoveron: 'points+fills' as const,
            showlegend: false,
          };
        });

        // Labels with highlight support
        const annotations = allSources.flatMap(src => {
          const rRank = rrlsRankMap[src] ?? maxRank;
          const nRank = ntsRankMap[src] ?? maxRank;
          const diff = Math.abs(rRank - nRank);
          const name = shortName(src);
          const isSelected = sel === src;
          const isDimmed = sel !== null && !isSelected;
          const fontColor = isSelected ? diffColor(diff) : isDimmed ? 'rgba(160,160,176,0.25)' : '#e0e0e0';
          const fontWeight = isSelected ? 700 : 400;
          return [
            { x: 0.14, y: rRank, text: `${rRank}. ${name}`, xanchor: 'right' as const },
            { x: 0.86, y: nRank, text: `${nRank}. ${name}`, xanchor: 'left' as const },
          ].map(a => ({
            ...a,
            showarrow: false,
            font: { size: isSelected ? 11 : 10, color: fontColor, weight: fontWeight },
            yanchor: 'middle' as const,
            captureevents: true,
          }));
        });

        return (
          <div className="chart-row">
            <div className="chart-box">
              <div className="chart-title-bar">
                <h4>RRLS vs {'\u2622'} NTS Rank Comparison (Slope Chart)</h4>
                <ChartInfo
                  title="RRLS vs NTS Rank Comparison"
                  description="Slope chart comparing how sources rank for RRLS (left) vs NTS (right). Click a source name or line to highlight it. Red lines = large rank change (8+), orange = moderate (4-7), grey = similar. Hover over lines for details."
                />
              </div>
              <Plot
                data={[...legendTraces, ...slopeTraces] as unknown as React.ComponentProps<typeof Plot>['data']}
                layout={{
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e0e0e0' },
                  margin: { t: 10, b: 30, l: 220, r: 220 },
                  height: Math.max(550, allSources.length * 26),
                  xaxis: {
                    range: [0, 1],
                    tickvals: [0.15, 0.85],
                    ticktext: ['RRLS Rank', '\u2622 NTS Rank'],
                    fixedrange: true,
                    showgrid: false,
                    zeroline: false,
                  },
                  yaxis: {
                    autorange: 'reversed',
                    range: [0.5, maxRank + 0.5],
                    showticklabels: false,
                    showgrid: false,
                    zeroline: false,
                    fixedrange: true,
                  },
                  shapes: rankLines as Plotly.Layout['shapes'],
                  showlegend: true,
                  legend: { orientation: 'h', y: 1.05, font: { size: 11 } },
                  hovermode: 'closest',
                  annotations,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
                onClick={(e: { points: { curveNumber: number; customdata?: string }[] }) => {
                  const src = e.points?.[0]?.customdata;
                  if (src) setSelectedSource(prev => prev === src ? null : src);
                }}
                onInitialized={(_: unknown, graphDiv: HTMLElement) => {
                  (graphDiv as HTMLDivElement & { on: (evt: string, cb: (e: { annotation: { text: string } }) => void) => void }).on('plotly_clickannotation', (e) => {
                    const text = e.annotation?.text || '';
                    const match = text.match(/^\d+\.\s+(.+)$/);
                    if (match) {
                      const clickedName = match[1];
                      const src = allSources.find(s => shortName(s) === clickedName);
                      if (src) setSelectedSource(prev => prev === src ? null : src);
                    }
                  });
                }}
              />
              {selectedSource && (() => {
                const d = Math.abs((rrlsRankMap[selectedSource] ?? maxRank) - (ntsRankMap[selectedSource] ?? maxRank));
                return (
                  <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, color: diffColor(d), cursor: 'pointer' }}
                    onClick={() => setSelectedSource(null)}>
                    Showing: <strong>{shortName(selectedSource)}</strong> — click to deselect
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>Statements by Database — Absolute</h4>
            <ChartInfo
              title="By Database — Absolute"
              description="Grouped bar chart comparing RRLS and NTS confirmed statement counts across source databases."
            />
          </div>
          <Plot
            data={[
              { type: 'bar', name: 'RRLS', x: comp.map(r => r.db), y: comp.map(r => r.rrls), marker: { color: '#d32f2f' } },
              { type: 'bar', name: '\u2622 NTS', x: comp.map(r => r.db), y: comp.map(r => r.nts), marker: { color: '#fdd835' } },
            ]}
            layout={{
              barmode: 'group',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 60, l: 60, r: 20 },
              height: 350,
              yaxis: { title: 'Count' },
              legend: { orientation: 'h', y: 1.1 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
              const pt = e.points?.[0];
              if (!pt) return;
              const db = pt.x;
              const isNts = pt.data.name.includes('NTS');
              const stmts = isNts ? ntsStmts : rrlsStmts;
              const matching = stmts.filter(s => s.db === db);
              setDrilldown({ title: `${pt.data.name} — ${db}`, stmts: matching, mode: isNts ? 'nts' : 'rrls' });
            }}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>Statements by Database — % of Chunks</h4>
            <ChartInfo
              title="Statements by Database — % of Chunks"
              description="What percentage of each database's chunks are classified as RRLS or NTS. Higher rates indicate databases with denser red line or nuclear threat content."
            />
          </div>
          <Plot
            data={[
              {
                type: 'bar', name: 'RRLS %',
                x: comp.map(r => r.db),
                y: comp.map(r => r.total_chunks > 0 ? (r.rrls / r.total_chunks) * 100 : 0),
                marker: { color: '#d32f2f' },
                text: comp.map(r => r.total_chunks > 0 ? ((r.rrls / r.total_chunks) * 100).toFixed(1) + '%' : '0%'),
                textposition: 'outside',
              },
              {
                type: 'bar', name: '\u2622 NTS %',
                x: comp.map(r => r.db),
                y: comp.map(r => r.total_chunks > 0 ? (r.nts / r.total_chunks) * 100 : 0),
                marker: { color: '#fdd835' },
                text: comp.map(r => r.total_chunks > 0 ? ((r.nts / r.total_chunks) * 100).toFixed(1) + '%' : '0%'),
                textposition: 'outside',
              },
            ]}
            layout={{
              barmode: 'group',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 60, l: 60, r: 20 },
              height: 350,
              yaxis: { title: '% of Chunks', ticksuffix: '%' },
              legend: { orientation: 'h', y: 1.1 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
              const pt = e.points?.[0];
              if (!pt) return;
              const db = pt.x;
              const isNts = pt.data.name.includes('NTS');
              const stmts = isNts ? ntsStmts : rrlsStmts;
              const matching = stmts.filter(s => s.db === db);
              setDrilldown({ title: `${pt.data.name} — ${db}`, stmts: matching, mode: isNts ? 'nts' : 'rrls' });
            }}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {drilldown && (
        <StatementDrilldown
          mode={drilldown.mode}
          title={drilldown.title}
          statements={drilldown.stmts}
          onClose={() => setDrilldown(null)}
        />
      )}

      <div className="info-box">
        <p>Date range: <strong>{stats.date_min}</strong> to <strong>{stats.date_max}</strong> | {chunks.length} unique sources across {stats.total_sources} institutions</p>
        <p>{'Pipeline: 1st pass (GPT-4o screening) \u2192 2nd pass (GPT-5 mini taxonomy) \u2192 3rd pass (civilizational framing)'}</p>
      </div>
    </div>
  );
}
