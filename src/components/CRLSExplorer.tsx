import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import type { SourceRow, MonthlyRow } from '../types';

interface FramingRow { framing_type: string; count: number; }
interface TerritoryRow { territory: string; count: number; }

export default function CRLSExplorer() {
  const [bySource, setBySource] = useState<SourceRow[]>([]);
  const [framing, setFraming] = useState<FramingRow[]>([]);
  const [territories, setTerritories] = useState<TerritoryRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);

  useEffect(() => {
    load<SourceRow[]>('crls_by_source.json').then(setBySource);
    load<FramingRow[]>('crls_framing_types.json').then(setFraming);
    load<TerritoryRow[]>('crls_territories.json').then(setTerritories);
    load<MonthlyRow[]>('crls_monthly.json').then(setMonthly);
  }, []);

  // Aggregate monthly by month
  const byMonth: Record<string, number> = {};
  for (const r of monthly) {
    byMonth[r.month] = (byMonth[r.month] || 0) + r.count;
  }
  const months = Object.keys(byMonth).sort();

  // Monthly by source (top 5)
  const srcCounts: Record<string, number> = {};
  for (const r of monthly) {
    srcCounts[r.source!] = (srcCounts[r.source!] || 0) + r.count;
  }
  const topSrc = Object.entries(srcCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);

  return (
    <div className="tab-content">
      <h2 style={{ color: '#da3633' }}>Civilizational Red Line Statements (CRLS)</h2>
      <p className="subtitle">RRLS that invoke civilizational framing — cultural identity, historical destiny, or civilizational conflict narratives.</p>

      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={[{
              type: 'pie',
              labels: framing.map(r => r.framing_type),
              values: framing.map(r => r.count),
              hole: 0.4,
              textinfo: 'label+percent',
              marker: { colors: ['#da3633', '#f0883e', '#e3b341', '#3fb950', '#58a6ff', '#bc8cff', '#8b949e'] },
            }]}
            layout={{
              title: 'Civilizational Framing Types',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
              margin: { t: 40, b: 20, l: 20, r: 20 },
              height: 400,
              showlegend: true,
              legend: { font: { size: 10 } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
        <div className="chart-box">
          <Plot
            data={[{
              type: 'bar',
              x: territories.slice(0, 20).map(r => r.count),
              y: territories.slice(0, 20).map(r => r.territory),
              orientation: 'h',
              marker: { color: '#da3633' },
            }]}
            layout={{
              title: 'Territories Mentioned (Sphere of Influence Claims)',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
              margin: { t: 40, b: 20, l: 160, r: 20 },
              height: 400,
              yaxis: { autorange: 'reversed' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={[{
              type: 'scatter', mode: 'lines+markers',
              x: months, y: months.map(m => byMonth[m]),
              fill: 'tozeroy',
              marker: { color: '#da3633' },
              line: { color: '#da3633' },
            }]}
            layout={{
              title: 'CRLS Over Time',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
              margin: { t: 40, b: 40, l: 60, r: 20 },
              height: 300,
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
            data={topSrc.map(src => ({
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: src,
              x: months,
              y: months.map(m => {
                const row = monthly.find(r => r.month === m && r.source === src);
                return row ? row.count : 0;
              }),
            }))}
            layout={{
              title: 'CRLS by Source Over Time',
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

      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={[{
              type: 'bar',
              x: bySource.map(r => r.source),
              y: bySource.map(r => r.crls ?? 0),
              marker: { color: '#da3633' },
            }]}
            layout={{
              title: 'CRLS Count by Source',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
              margin: { t: 40, b: 100, l: 60, r: 20 },
              height: 350,
              xaxis: { tickangle: -45 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
