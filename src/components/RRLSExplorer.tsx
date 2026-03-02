import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import { getColor } from '../colors';
import ChartInfo from './ChartInfo';
import type { TaxonomyRow, CrossTabRow } from '../types';

const DIM_LABELS: Record<string, string> = {
  theme: 'Theme', audience: 'Audience', level_of_escalation: 'Escalation Level',
  nature_of_threat: 'Nature of Threat', underlying_values_or_interests: 'Values/Interests',
  temporal_context: 'Temporal Context', reciprocity: 'Reciprocity', durability: 'Durability',
  line: 'Line Type', threat: 'Threat Type', specificity: 'Specificity',
  geopolitical_area_of_concern: 'Geopolitical Area', immediacy: 'Immediacy',
  unilateral_vs_multilateral: 'Unilateral/Multilateral', rhetorical_device: 'Rhetorical Device',
};

export default function RRLSExplorer() {
  const [taxonomy, setTaxonomy] = useState<Record<string, TaxonomyRow[]>>({});
  const [totals, setTotals] = useState<Record<string, TaxonomyRow[]>>({});
  const [crossTabs, setCrossTabs] = useState<Record<string, CrossTabRow[]>>({});
  const [taxTime, setTaxTime] = useState<Record<string, { month: string; value: string; count: number }[]>>({});
  const [selectedDim, setSelectedDim] = useState('theme');
  const [selectedCross, setSelectedCross] = useState('theme_x_audience');

  useEffect(() => {
    load<Record<string, TaxonomyRow[]>>('rrls_taxonomy.json').then(setTaxonomy);
    load<Record<string, TaxonomyRow[]>>('rrls_taxonomy_totals.json').then(setTotals);
    load<Record<string, CrossTabRow[]>>('rrls_cross_tabs.json').then(setCrossTabs);
    load<Record<string, { month: string; value: string; count: number }[]>>('rrls_taxonomy_time.json').then(setTaxTime);
  }, []);

  const dims = Object.keys(totals).sort((a, b) =>
    (DIM_LABELS[a] || a).localeCompare(DIM_LABELS[b] || b)
  );
  const rows = totals[selectedDim] || [];
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const crossKeys = Object.keys(crossTabs).sort((a, b) => {
    const fmt = (k: string) => k.replace(/_x_/g, ' \u00d7 ').replace(/_/g, ' ');
    return fmt(a).localeCompare(fmt(b));
  });
  const crossRows = crossTabs[selectedCross] || [];

  // Heatmap data from cross-tab
  const dim1Vals = [...new Set(crossRows.map(r => r.dim1))];
  const dim2Vals = [...new Set(crossRows.map(r => r.dim2))];
  const zMap: Record<string, Record<string, number>> = {};
  for (const r of crossRows) {
    if (!zMap[r.dim1]) zMap[r.dim1] = {};
    zMap[r.dim1][r.dim2] = r.count;
  }
  const z = dim1Vals.map(d1 => dim2Vals.map(d2 => zMap[d1]?.[d2] || 0));

  // Time series for selected dim
  const timeData = taxTime[selectedDim] || [];
  const timeValues = [...new Set(timeData.map(r => r.value))].slice(0, 8);
  const timeMonths = [...new Set(timeData.map(r => r.month))].sort();

  const dimLabel = DIM_LABELS[selectedDim] || selectedDim;

  return (
    <div className="tab-content">
      <h2 style={{ color: '#1f77b4' }}>RRLS Taxonomy Explorer</h2>

      <div className="filter-bar">
        <label>Dimension:</label>
        <select value={selectedDim} onChange={e => setSelectedDim(e.target.value)}>
          {dims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
        </select>
      </div>

      {/* Absolute counts */}
      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>{dimLabel} — Absolute Counts</h4>
            <ChartInfo
              title={`${dimLabel} — Absolute Counts`}
              description="Horizontal bar chart showing the absolute frequency of each value for the selected taxonomy dimension across all confirmed RRLS statements."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: rows.map(r => r.count),
              y: rows.map(r => r.value),
              orientation: 'h',
              marker: { color: '#1f77b4' },
              text: rows.map(r => r.count.toString()),
              textposition: 'outside',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 20, l: 200, r: 60 },
              height: Math.max(300, rows.length * 28),
              yaxis: { autorange: 'reversed' },
              xaxis: { title: 'Count' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>

        {/* Relative percentages */}
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>{dimLabel} — % of RRLS</h4>
            <ChartInfo
              title={`${dimLabel} — Relative Share`}
              description="Horizontal bar chart showing what percentage of all RRLS statements each value represents for the selected dimension."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: rows.map(r => totalCount > 0 ? (r.count / totalCount) * 100 : 0),
              y: rows.map(r => r.value),
              orientation: 'h',
              marker: { color: '#aec7e8' },
              text: rows.map(r => totalCount > 0 ? ((r.count / totalCount) * 100).toFixed(1) + '%' : '0%'),
              textposition: 'outside',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 20, l: 200, r: 60 },
              height: Math.max(300, rows.length * 28),
              yaxis: { autorange: 'reversed' },
              xaxis: { title: '% of RRLS Statements', ticksuffix: '%' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Source breakdown for selected dim */}
      {taxonomy[selectedDim] && (
        <div className="chart-row">
          <div className="chart-box">
            <div className="chart-title-bar">
              <h4>{dimLabel} by Source (Top 10)</h4>
              <ChartInfo
                title={`${dimLabel} by Source`}
                description="Stacked bar chart showing how each taxonomy value is distributed across the top 10 sources. Each color represents a different value of the selected dimension."
              />
            </div>
            <Plot
              data={(() => {
                const bySource: Record<string, Record<string, number>> = {};
                for (const r of taxonomy[selectedDim]) {
                  if (!bySource[r.source!]) bySource[r.source!] = {};
                  bySource[r.source!][r.value] = (bySource[r.source!][r.value] || 0) + r.count;
                }
                const topSources = Object.entries(bySource)
                  .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
                  .slice(0, 10)
                  .map(([s]) => s);
                const topVals = rows.slice(0, 8).map(r => r.value);
                return topVals.map((v, i) => ({
                  type: 'bar' as const,
                  name: v,
                  x: topSources,
                  y: topSources.map(s => bySource[s]?.[v] || 0),
                  marker: { color: getColor(v, i) },
                }));
              })()}
              layout={{
                barmode: 'stack',
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#e0e0e0', size: 11 },
                margin: { t: 10, b: 100, l: 60, r: 20 },
                height: 400,
                xaxis: { tickangle: -45 },
                yaxis: { title: 'Count' },
                legend: { orientation: 'h', y: 1.15, font: { size: 10 } },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Time series */}
      {timeData.length > 0 && (
        <div className="chart-row">
          <div className="chart-box">
            <div className="chart-title-bar">
              <h4>{dimLabel} Over Time</h4>
              <ChartInfo
                title={`${dimLabel} Over Time`}
                description="Line chart showing how the top values of the selected dimension trend over time, with each line representing a different category value."
              />
            </div>
            <Plot
              data={timeValues.map((v, i) => ({
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: v,
                x: timeMonths,
                y: timeMonths.map(m => {
                  const row = timeData.find(r => r.month === m && r.value === v);
                  return row ? row.count : 0;
                }),
                line: { color: getColor(v, i) },
              }))}
              layout={{
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#e0e0e0' },
                margin: { t: 10, b: 40, l: 60, r: 20 },
                height: 350,
                legend: { orientation: 'h', y: 1.15, font: { size: 10 } },
                xaxis: { title: 'Month' },
                yaxis: { title: 'Count' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Cross-tabulation heatmap */}
      {crossKeys.length > 0 && (
        <>
          <div className="filter-bar">
            <label>Cross-tabulation:</label>
            <select value={selectedCross} onChange={e => setSelectedCross(e.target.value)}>
              {crossKeys.map(k => <option key={k} value={k}>{k.replace(/_x_/g, ' \u00d7 ').replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="chart-row">
            <div className="chart-box">
              <div className="chart-title-bar">
                <h4>{selectedCross.replace(/_x_/g, ' \u00d7 ').replace(/_/g, ' ')}</h4>
                <ChartInfo
                  title="Cross-Tabulation Heatmap"
                  description="Heatmap showing the co-occurrence of two taxonomy dimensions. Darker cells indicate higher counts. Hover over cells to see exact values."
                />
              </div>
              <Plot
                data={[{
                  type: 'heatmap',
                  x: dim2Vals, y: dim1Vals, z,
                  colorscale: [[0, '#1a1a2e'], [0.5, '#1f77b4'], [1, '#4fc3f7']],
                  text: z.map(row => row.map(v => v.toString())),
                  texttemplate: '%{text}',
                  hovertemplate: '%{y} \u00d7 %{x}: %{z}<extra></extra>',
                }]}
                layout={{
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e0e0e0', size: 10 },
                  margin: { t: 10, b: 100, l: 200, r: 20 },
                  height: Math.max(350, dim1Vals.length * 30),
                  xaxis: { tickangle: -45 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
