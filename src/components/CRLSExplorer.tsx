import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import { TAB20, getColor } from '../colors';
import ChartInfo from './ChartInfo';
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

  const totalTerritory = territories.slice(0, 20).reduce((s, r) => s + r.count, 0);

  // Aggregate monthly by month
  const byMonth: Record<string, number> = {};
  for (const r of monthly) {
    byMonth[r.month] = (byMonth[r.month] || 0) + r.count;
  }
  const months = Object.keys(byMonth).sort();

  // Monthly by source (top 6)
  const srcCounts: Record<string, number> = {};
  for (const r of monthly) {
    srcCounts[r.source!] = (srcCounts[r.source!] || 0) + r.count;
  }
  const topSrc = Object.entries(srcCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);

  const totalBySource = bySource.reduce((s, r) => s + (r.crls ?? 0), 0);

  return (
    <div className="tab-content">
      <h2 style={{ color: '#d62728' }}>Civilizational Red Line Statements (CRLS)</h2>
      <p className="subtitle">RRLS that invoke civilizational framing — cultural identity, historical destiny, or civilizational conflict narratives.</p>

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>Civilizational Framing Types</h4>
            <ChartInfo
              title="Civilizational Framing Types"
              description="Donut chart showing the distribution of civilizational framing types across all CRLS statements. Each slice represents a distinct framing category with both count and percentage."
            />
          </div>
          <Plot
            data={[{
              type: 'pie',
              labels: framing.map(r => r.framing_type),
              values: framing.map(r => r.count),
              hole: 0.4,
              textinfo: 'label+percent',
              hovertemplate: '%{label}: %{value} (%{percent})<extra></extra>',
              marker: { colors: framing.map((_, i) => TAB20[i % TAB20.length]) },
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 20, l: 20, r: 20 },
              height: 400,
              showlegend: true,
              legend: { font: { size: 10 } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>Territories Mentioned (Top 20)</h4>
            <ChartInfo
              title="Territories Mentioned"
              description="Horizontal bar chart showing the most frequently mentioned territories in CRLS statements, indicating sphere-of-influence claims and geopolitical focal points."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: territories.slice(0, 20).map(r => r.count),
              y: territories.slice(0, 20).map(r => r.territory),
              orientation: 'h',
              marker: { color: '#d62728' },
              text: territories.slice(0, 20).map(r =>
                `${r.count} (${totalTerritory > 0 ? ((r.count / totalTerritory) * 100).toFixed(1) : 0}%)`
              ),
              textposition: 'outside',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 20, l: 160, r: 80 },
              height: 400,
              yaxis: { autorange: 'reversed' },
              xaxis: { title: 'Count' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>CRLS Over Time (Absolute)</h4>
            <ChartInfo
              title="CRLS Over Time"
              description="Area chart showing the total number of civilizational red line statements per month, revealing temporal trends in civilizational rhetoric."
            />
          </div>
          <Plot
            data={[{
              type: 'scatter', mode: 'lines+markers',
              x: months, y: months.map(m => byMonth[m]),
              fill: 'tozeroy',
              marker: { color: '#d62728' },
              line: { color: '#d62728' },
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 40, l: 60, r: 20 },
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
          <div className="chart-title-bar">
            <h4>CRLS by Source Over Time (Top 6)</h4>
            <ChartInfo
              title="CRLS by Source Over Time"
              description="Multi-line chart showing CRLS counts per month for the top 6 sources. Each line represents a different source, allowing comparison of civilizational rhetoric across outlets."
            />
          </div>
          <Plot
            data={topSrc.map((src, i) => ({
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: src,
              x: months,
              y: months.map(m => {
                const row = monthly.find(r => r.month === m && r.source === src);
                return row ? row.count : 0;
              }),
              line: { color: getColor(src, i) },
            }))}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 40, l: 60, r: 20 },
              height: 350,
              legend: { orientation: 'h', y: 1.15, font: { size: 10 } },
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
            <h4>CRLS Count by Source — Absolute</h4>
            <ChartInfo
              title="CRLS Count by Source"
              description="Bar chart showing the total number of civilizational red line statements per source."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: bySource.map(r => r.source),
              y: bySource.map(r => r.crls ?? 0),
              marker: { color: '#d62728' },
              text: bySource.map(r => (r.crls ?? 0).toString()),
              textposition: 'outside',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 100, l: 60, r: 20 },
              height: 350,
              xaxis: { tickangle: -45 }, yaxis: { title: 'Count' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>CRLS by Source — % of Total</h4>
            <ChartInfo
              title="CRLS by Source — Relative"
              description="Bar chart showing what percentage of all CRLS each source contributes."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: bySource.map(r => r.source),
              y: bySource.map(r => totalBySource > 0 ? ((r.crls ?? 0) / totalBySource) * 100 : 0),
              marker: { color: '#ff9896' },
              text: bySource.map(r => totalBySource > 0 ? (((r.crls ?? 0) / totalBySource) * 100).toFixed(1) + '%' : '0%'),
              textposition: 'outside',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 100, l: 60, r: 20 },
              height: 350,
              xaxis: { tickangle: -45 }, yaxis: { title: '% of CRLS', ticksuffix: '%' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
