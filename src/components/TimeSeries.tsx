import { useEffect, useState } from 'react';
import Plot from './Plot';
import { load } from '../data';
import { getColor } from '../colors';
import ChartInfo from './ChartInfo';
import StatementDrilldown from './StatementDrilldown';
import type { MonthlyRow, WarContextRow, RRLSStatement, NTSStatement } from '../types';

export default function TimeSeries() {
  const [rrls, setRrls] = useState<MonthlyRow[]>([]);
  const [nts, setNts] = useState<MonthlyRow[]>([]);
  const [crls, setCrls] = useState<MonthlyRow[]>([]);
  const [chunks, setChunks] = useState<{ month: string; total_chunks: number }[]>([]);
  const [warPers, setWarPers] = useState<WarContextRow[]>([]);
  const [warAcled, setWarAcled] = useState<WarContextRow[]>([]);
  const [rrlsStmts, setRrlsStmts] = useState<RRLSStatement[]>([]);
  const [ntsStmts, setNtsStmts] = useState<NTSStatement[]>([]);
  const [drilldown, setDrilldown] = useState<{ title: string; stmts: (RRLSStatement | NTSStatement)[]; mode: 'rrls' | 'nts' } | null>(null);
  const [viewMode, setViewMode] = useState<'absolute' | 'relative'>('absolute');
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    load<MonthlyRow[]>('rrls_monthly.json').then(setRrls);
    load<MonthlyRow[]>('nts_monthly.json').then(setNts);
    load<MonthlyRow[]>('crls_monthly.json').then(setCrls);
    load<{ month: string; total_chunks: number }[]>('chunks_monthly.json').then(setChunks);
    load<WarContextRow[]>('war_context_personnel.json').then(setWarPers);
    load<WarContextRow[]>('war_context_acled.json').then(setWarAcled);
    load<RRLSStatement[]>('rrls_statements.json').then(setRrlsStmts);
    load<NTSStatement[]>('nts_statements.json').then(setNtsStmts);
  }, []);

  const agg = (data: MonthlyRow[]) => {
    const m: Record<string, number> = {};
    const filtered = sourceFilter === 'all' ? data : data.filter(r => {
      if (sourceFilter === 'kremlin') return r.source === 'kremlin.ru';
      if (sourceFilter === 'duma') return r.source === 'duma.gov.ru';
      if (sourceFilter === 'federation') return r.source === 'council.gov.ru';
      if (sourceFilter === 'telegram') {
        // Check various Telegram sources
        return r.source?.includes('МИД') || r.source?.includes('Marina') ||
               r.source?.includes('Захарова') || r.source?.includes('Медин') ||
               r.source?.includes('Embassy') || r.source?.includes('Миноборон') ||
               r.source?.includes('Мэр') || r.source?.includes('Володин') ||
               r.source?.includes('Русский') || r.source?.includes('Минстрой');
      }
      return true;
    });
    for (const r of filtered) m[r.month] = (m[r.month] || 0) + r.count;
    return m;
  };
  const rrlsM = agg(rrls);
  const ntsM = agg(nts);
  const crlsM = agg(crls);
  const chunksM: Record<string, number> = {};
  for (const r of chunks) chunksM[r.month] = r.total_chunks;

  const allMonths = [...new Set([
    ...Object.keys(rrlsM), ...Object.keys(ntsM), ...Object.keys(crlsM),
  ])].sort();

  const rrlsRate = allMonths.map(m => chunksM[m] ? ((rrlsM[m] || 0) / chunksM[m]) * 100 : 0);
  const ntsRate = allMonths.map(m => chunksM[m] ? ((ntsM[m] || 0) / chunksM[m]) * 100 : 0);
  const crlsRate = allMonths.map(m => chunksM[m] ? ((crlsM[m] || 0) / chunksM[m]) * 100 : 0);

  // Consistent statement type colors
  const RRLS_COLOR = '#d32f2f';
  const NTS_COLOR = '#fdd835';
  const CRLS_COLOR = '#d62728';

  return (
    <div className="tab-content">
      <h2 style={{ color: '#2ca02c' }}>Time Series Analysis</h2>

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h4>All Statement Types Over Time</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  style={{
                    background: '#1a1a2e',
                    color: '#e0e0e0',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="all">All Sources</option>
                  <option value="kremlin">Kremlin</option>
                  <option value="duma">State Duma</option>
                  <option value="federation">Federation Council</option>
                  <option value="telegram">Official Telegram</option>
                </select>
                <button
                  onClick={() => setViewMode(viewMode === 'absolute' ? 'relative' : 'absolute')}
                  style={{
                    background: '#1a1a2e',
                    color: '#e0e0e0',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  {viewMode === 'absolute' ? 'Show Relative' : 'Show Absolute'}
                </button>
              </div>
              <ChartInfo
                title={viewMode === 'absolute' ? "Absolute Statement Counts" : "Relative Rate"}
                description={viewMode === 'absolute'
                  ? "Line chart showing absolute monthly counts for all three statement types (RRLS, NTS, CRLS). Useful for identifying spikes in red line rhetoric correlated with geopolitical events."
                  : "Shows the proportion of text chunks classified as RRLS, NTS, or CRLS per month. This normalizes for varying corpus size, revealing whether escalatory language is becoming more prevalent independent of how many documents are available."
                }
              />
            </div>
          </div>
          <Plot
            data={[
              {
                type: 'scatter',
                mode: 'lines',
                name: viewMode === 'absolute' ? 'RRLS' : 'RRLS %',
                x: allMonths,
                y: viewMode === 'absolute' ? allMonths.map(m => rrlsM[m] || 0) : rrlsRate,
                line: { color: RRLS_COLOR, width: 2 }
              },
              {
                type: 'scatter',
                mode: 'lines',
                name: viewMode === 'absolute' ? '\u2622 NTS' : '\u2622 NTS %',
                x: allMonths,
                y: viewMode === 'absolute' ? allMonths.map(m => ntsM[m] || 0) : ntsRate,
                line: { color: NTS_COLOR, width: 2 }
              },
              {
                type: 'scatter',
                mode: 'lines',
                name: viewMode === 'absolute' ? 'CRLS' : 'CRLS %',
                x: allMonths,
                y: viewMode === 'absolute' ? allMonths.map(m => crlsM[m] || 0) : crlsRate,
                line: { color: CRLS_COLOR, width: 2 }
              },
            ]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 40, l: 60, r: 20 },
              height: 350,
              legend: { orientation: 'h', y: 1.1 },
              xaxis: { title: 'Month' },
              yaxis: {
                title: viewMode === 'absolute' ? 'Count' : '% of Chunks',
                ticksuffix: viewMode === 'relative' ? '%' : ''
              },
            }}
            config={{ displayModeBar: false, responsive: true }}
            onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
              const pt = e.points?.[0];
              if (!pt) return;
              const month = pt.x;
              const name = pt.data.name;
              if (name.includes('CRLS')) return;
              const isNts = name.includes('NTS');
              const stmts = isNts ? ntsStmts : rrlsStmts;
              const matching = stmts.filter(s => s.date?.startsWith(month));
              setDrilldown({ title: `${name} (${month})`, stmts: matching, mode: isNts ? 'nts' : 'rrls' });
            }}
            style={{ width: '100%', cursor: 'pointer' }}
          />
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            background: 'rgba(42, 160, 44, 0.1)',
            border: '1px solid #2ca02c',
            borderRadius: '4px',
            color: '#e0e0e0',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            <strong>Total Statements: RRLS={Object.values(rrlsM).reduce((a,b) => a+b, 0)}, NTS={Object.values(ntsM).reduce((a,b) => a+b, 0)}, CRLS={Object.values(crlsM).reduce((a,b) => a+b, 0)}</strong>
            {sourceFilter !== 'all' && ` (${sourceFilter === 'kremlin' ? 'Kremlin' :
              sourceFilter === 'duma' ? 'State Duma' :
              sourceFilter === 'federation' ? 'Federation Council' :
              'Official Telegram'})`}
          </div>
        </div>
      </div>

      {warPers.length > 0 && (
        <div className="chart-row">
          <div className="chart-box">
            <div className="chart-title-bar">
              <h4>RRLS vs. Russian Personnel Losses</h4>
              <ChartInfo
                title="RRLS vs. Personnel Losses"
                description="Dual-axis chart comparing monthly RRLS counts (bars, left axis) with Russian personnel losses (line, right axis). Reveals potential correlation between battlefield losses and red line rhetoric."
              />
            </div>
            <Plot
              data={[
                { type: 'bar', name: 'RRLS', x: allMonths, y: allMonths.map(m => rrlsM[m] || 0), marker: { color: RRLS_COLOR, opacity: 0.7 }, yaxis: 'y' },
                { type: 'scatter', mode: 'lines', name: 'Personnel Losses', x: warPers.map(r => r.month), y: warPers.map(r => r.personnel_losses ?? 0), line: { color: CRLS_COLOR, width: 2 }, yaxis: 'y2' },
              ]}
              layout={{
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#e0e0e0' },
                margin: { t: 10, b: 40, l: 60, r: 60 },
                height: 350,
                legend: { orientation: 'h', y: 1.1 },
                yaxis: { title: 'RRLS Count', side: 'left' },
                yaxis2: { title: 'Personnel Losses', side: 'right', overlaying: 'y' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
                const pt = e.points?.[0];
                if (!pt) return;
                const month = pt.x;
                if (pt.data.name !== 'RRLS') return;
                const matching = rrlsStmts.filter(s => s.date?.startsWith(month));
                setDrilldown({ title: `RRLS (${month})`, stmts: matching, mode: 'rrls' });
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      {warAcled.length > 0 && (
        <div className="chart-row">
          <div className="chart-box">
            <div className="chart-title-bar">
              <h4>{'\u2622'} NTS vs. ACLED Conflict Events</h4>
              <ChartInfo
                title="NTS vs. ACLED Events"
                description="Dual-axis chart comparing monthly NTS counts (bars, left axis) with ACLED conflict events (line, right axis). Shows whether nuclear threat rhetoric correlates with conflict intensity."
              />
            </div>
            <Plot
              data={[
                { type: 'bar', name: '\u2622 NTS', x: allMonths, y: allMonths.map(m => ntsM[m] || 0), marker: { color: NTS_COLOR, opacity: 0.7 }, yaxis: 'y' },
                { type: 'scatter', mode: 'lines', name: 'ACLED Events', x: warAcled.map(r => r.month), y: warAcled.map(r => r.events ?? 0), line: { color: CRLS_COLOR, width: 2 }, yaxis: 'y2' },
              ]}
              layout={{
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#e0e0e0' },
                margin: { t: 10, b: 40, l: 60, r: 60 },
                height: 350,
                legend: { orientation: 'h', y: 1.1 },
                yaxis: { title: '\u2622 NTS Count', side: 'left' },
                yaxis2: { title: 'ACLED Events', side: 'right', overlaying: 'y' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
                const pt = e.points?.[0];
                if (!pt) return;
                const month = pt.x;
                if (!pt.data.name.includes('NTS')) return;
                const matching = ntsStmts.filter(s => s.date?.startsWith(month));
                setDrilldown({ title: `NTS (${month})`, stmts: matching, mode: 'nts' });
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>RRLS by Source Over Time (Top 6)</h4>
            <ChartInfo
              title="RRLS by Source Over Time"
              description="Multi-line chart showing RRLS statement counts per month for the top 6 sources. Reveals which media outlets and institutions drive red line rhetoric at different periods."
            />
          </div>
          <Plot
            data={(() => {
              const srcCounts: Record<string, number> = {};
              for (const r of rrls) srcCounts[r.source!] = (srcCounts[r.source!] || 0) + r.count;
              const topSrc = Object.entries(srcCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);
              return topSrc.map((src, i) => ({
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: src,
                x: allMonths,
                y: allMonths.map(m => {
                  const row = rrls.find(r => r.month === m && r.source === src);
                  return row ? row.count : 0;
                }),
                line: { color: getColor(`ts_${src}`, i) },
              }));
            })()}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 40, l: 60, r: 20 },
              height: 350,
              legend: { orientation: 'h', y: 1.15, font: { size: 10 } },
              xaxis: { title: 'Month' }, yaxis: { title: 'Count' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            onClick={(e: { points: { x: string; data: { name: string } }[] }) => {
              const pt = e.points?.[0];
              if (!pt) return;
              const month = pt.x;
              const source = pt.data.name;
              const matching = rrlsStmts.filter(s => s.date?.startsWith(month) && s.source === source);
              setDrilldown({ title: `RRLS: ${source} (${month})`, stmts: matching, mode: 'rrls' });
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
    </div>
  );
}
