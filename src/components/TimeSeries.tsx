import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import type { MonthlyRow, WarContextRow } from '../types';

export default function TimeSeries() {
  const [rrls, setRrls] = useState<MonthlyRow[]>([]);
  const [nts, setNts] = useState<MonthlyRow[]>([]);
  const [crls, setCrls] = useState<MonthlyRow[]>([]);
  const [chunks, setChunks] = useState<{ month: string; total_chunks: number }[]>([]);
  const [warPers, setWarPers] = useState<WarContextRow[]>([]);
  const [warAcled, setWarAcled] = useState<WarContextRow[]>([]);

  useEffect(() => {
    load<MonthlyRow[]>('rrls_monthly.json').then(setRrls);
    load<MonthlyRow[]>('nts_monthly.json').then(setNts);
    load<MonthlyRow[]>('crls_monthly.json').then(setCrls);
    load<{ month: string; total_chunks: number }[]>('chunks_monthly.json').then(setChunks);
    load<WarContextRow[]>('war_context_personnel.json').then(setWarPers);
    load<WarContextRow[]>('war_context_acled.json').then(setWarAcled);
  }, []);

  // Aggregate monthly by month
  const agg = (data: MonthlyRow[]) => {
    const m: Record<string, number> = {};
    for (const r of data) m[r.month] = (m[r.month] || 0) + r.count;
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

  // Relative rates
  const rrlsRate = allMonths.map(m => chunksM[m] ? ((rrlsM[m] || 0) / chunksM[m]) * 100 : 0);
  const ntsRate = allMonths.map(m => chunksM[m] ? ((ntsM[m] || 0) / chunksM[m]) * 100 : 0);

  return (
    <div className="tab-content">
      <h2 style={{ color: '#3fb950' }}>Time Series Analysis</h2>

      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={[
              { type: 'scatter', mode: 'lines', name: 'RRLS', x: allMonths, y: allMonths.map(m => rrlsM[m] || 0), line: { color: '#58a6ff', width: 2 } },
              { type: 'scatter', mode: 'lines', name: 'NTS', x: allMonths, y: allMonths.map(m => ntsM[m] || 0), line: { color: '#f0883e', width: 2 } },
              { type: 'scatter', mode: 'lines', name: 'CRLS', x: allMonths, y: allMonths.map(m => crlsM[m] || 0), line: { color: '#da3633', width: 2 } },
            ]}
            layout={{
              title: 'All Statement Types Over Time (Absolute)',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
              margin: { t: 40, b: 40, l: 60, r: 20 },
              height: 350,
              legend: { orientation: 'h', y: 1.1 },
              xaxis: { title: 'Month' }, yaxis: { title: 'Count' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={[
              { type: 'scatter', mode: 'lines', name: 'RRLS %', x: allMonths, y: rrlsRate, line: { color: '#58a6ff', width: 2 } },
              { type: 'scatter', mode: 'lines', name: 'NTS %', x: allMonths, y: ntsRate, line: { color: '#f0883e', width: 2 } },
            ]}
            layout={{
              title: 'Relative Rate (% of chunks classified as statement)',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
              margin: { t: 40, b: 40, l: 60, r: 20 },
              height: 300,
              legend: { orientation: 'h', y: 1.1 },
              xaxis: { title: 'Month' }, yaxis: { title: '% of Chunks', ticksuffix: '%' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* War context overlay */}
      {warPers.length > 0 && (
        <div className="chart-row">
          <div className="chart-box">
            <Plot
              data={[
                { type: 'bar', name: 'RRLS', x: allMonths, y: allMonths.map(m => rrlsM[m] || 0), marker: { color: '#58a6ff', opacity: 0.7 }, yaxis: 'y' },
                { type: 'scatter', mode: 'lines', name: 'Personnel Losses', x: warPers.map(r => r.month), y: warPers.map(r => r.personnel_losses ?? 0), line: { color: '#f85149', width: 2 }, yaxis: 'y2' },
              ]}
              layout={{
                title: 'RRLS vs. Russian Personnel Losses',
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#c9d1d9' },
                margin: { t: 40, b: 40, l: 60, r: 60 },
                height: 350,
                legend: { orientation: 'h', y: 1.1 },
                yaxis: { title: 'RRLS Count', side: 'left' },
                yaxis2: { title: 'Personnel Losses', side: 'right', overlaying: 'y' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {warAcled.length > 0 && (
        <div className="chart-row">
          <div className="chart-box">
            <Plot
              data={[
                { type: 'bar', name: 'NTS', x: allMonths, y: allMonths.map(m => ntsM[m] || 0), marker: { color: '#f0883e', opacity: 0.7 }, yaxis: 'y' },
                { type: 'scatter', mode: 'lines', name: 'ACLED Events', x: warAcled.map(r => r.month), y: warAcled.map(r => r.events ?? 0), line: { color: '#f85149', width: 2 }, yaxis: 'y2' },
              ]}
              layout={{
                title: 'NTS vs. ACLED Conflict Events',
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#c9d1d9' },
                margin: { t: 40, b: 40, l: 60, r: 60 },
                height: 350,
                legend: { orientation: 'h', y: 1.1 },
                yaxis: { title: 'NTS Count', side: 'left' },
                yaxis2: { title: 'ACLED Events', side: 'right', overlaying: 'y' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* By source (top 6) */}
      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={(() => {
              const srcCounts: Record<string, number> = {};
              for (const r of rrls) srcCounts[r.source!] = (srcCounts[r.source!] || 0) + r.count;
              const topSrc = Object.entries(srcCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);
              return topSrc.map(src => ({
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: src,
                x: allMonths,
                y: allMonths.map(m => {
                  const row = rrls.find(r => r.month === m && r.source === src);
                  return row ? row.count : 0;
                }),
              }));
            })()}
            layout={{
              title: 'RRLS by Source Over Time (Top 6)',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
              margin: { t: 40, b: 40, l: 60, r: 20 },
              height: 350,
              legend: { orientation: 'h', y: 1.15, font: { size: 10 } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
