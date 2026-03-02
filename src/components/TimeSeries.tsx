import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import { getColor } from '../colors';
import ChartInfo from './ChartInfo';
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
      <h2 style={{ color: '#2ca02c' }}>Time Series Analysis</h2>

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <ChartInfo
              title="All Statement Types Over Time"
              description="Line chart showing absolute monthly counts for all three statement types (RRLS, NTS, CRLS). Useful for identifying spikes in red line rhetoric correlated with geopolitical events."
            />
          </div>
          <Plot
            data={[
              { type: 'scatter', mode: 'lines', name: 'RRLS', x: allMonths, y: allMonths.map(m => rrlsM[m] || 0), line: { color: '#1f77b4', width: 2 } },
              { type: 'scatter', mode: 'lines', name: 'NTS', x: allMonths, y: allMonths.map(m => ntsM[m] || 0), line: { color: '#ff7f0e', width: 2 } },
              { type: 'scatter', mode: 'lines', name: 'CRLS', x: allMonths, y: allMonths.map(m => crlsM[m] || 0), line: { color: '#d62728', width: 2 } },
            ]}
            layout={{
              title: 'All Statement Types Over Time (Absolute)',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
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
          <div className="chart-title-bar">
            <ChartInfo
              title="Relative Rate"
              description="Shows the proportion of text chunks classified as RRLS or NTS per month. This normalizes for varying corpus size, revealing whether escalatory language is becoming more prevalent independent of how many documents are available."
            />
          </div>
          <Plot
            data={[
              { type: 'scatter', mode: 'lines', name: 'RRLS %', x: allMonths, y: rrlsRate, line: { color: '#1f77b4', width: 2 } },
              { type: 'scatter', mode: 'lines', name: 'NTS %', x: allMonths, y: ntsRate, line: { color: '#ff7f0e', width: 2 } },
            ]}
            layout={{
              title: 'Relative Rate (% of chunks classified as statement)',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
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
            <div className="chart-title-bar">
              <ChartInfo
                title="RRLS vs. Personnel Losses"
                description="Dual-axis chart comparing monthly RRLS counts (bars, left axis) with Russian personnel losses (line, right axis). Reveals potential correlation between battlefield losses and red line rhetoric."
              />
            </div>
            <Plot
              data={[
                { type: 'bar', name: 'RRLS', x: allMonths, y: allMonths.map(m => rrlsM[m] || 0), marker: { color: '#1f77b4', opacity: 0.7 }, yaxis: 'y' },
                { type: 'scatter', mode: 'lines', name: 'Personnel Losses', x: warPers.map(r => r.month), y: warPers.map(r => r.personnel_losses ?? 0), line: { color: '#d62728', width: 2 }, yaxis: 'y2' },
              ]}
              layout={{
                title: 'RRLS vs. Russian Personnel Losses',
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#e0e0e0' },
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
            <div className="chart-title-bar">
              <ChartInfo
                title="NTS vs. ACLED Events"
                description="Dual-axis chart comparing monthly NTS counts (bars, left axis) with ACLED conflict events (line, right axis). Shows whether nuclear threat rhetoric correlates with conflict intensity."
              />
            </div>
            <Plot
              data={[
                { type: 'bar', name: 'NTS', x: allMonths, y: allMonths.map(m => ntsM[m] || 0), marker: { color: '#ff7f0e', opacity: 0.7 }, yaxis: 'y' },
                { type: 'scatter', mode: 'lines', name: 'ACLED Events', x: warAcled.map(r => r.month), y: warAcled.map(r => r.events ?? 0), line: { color: '#d62728', width: 2 }, yaxis: 'y2' },
              ]}
              layout={{
                title: 'NTS vs. ACLED Conflict Events',
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#e0e0e0' },
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
          <div className="chart-title-bar">
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
              title: 'RRLS by Source Over Time (Top 6)',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
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
