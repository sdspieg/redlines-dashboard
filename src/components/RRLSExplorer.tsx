import { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import { RRLS_COLORS, RRLS_ORDINAL_SCORES, RRLS_ORDINAL_DIMS, RRLS_DIM_COLORS, getDimValueColor } from '../colors';
import ChartInfo from './ChartInfo';
import type { TaxonomyRow, RRLSStatement } from '../types';

const DIM_LABELS: Record<string, string> = {
  theme: 'Theme', audience: 'Audience', level_of_escalation: 'Escalation Level',
  nature_of_threat: 'Nature of Threat', underlying_values_or_interests: 'Values/Interests',
  temporal_context: 'Temporal Context', reciprocity: 'Reciprocity', durability: 'Durability',
  line: 'Line Type', threat: 'Threat Type', specificity: 'Specificity',
  geopolitical_area_of_concern: 'Geopolitical Area', immediacy: 'Immediacy',
  unilateral_vs_multilateral: 'Unilateral/Multilateral', rhetorical_device: 'Rhetorical Device',
  line_intensity: 'Line Intensity', threat_intensity: 'Threat Intensity',
  overall_confidence: 'Overall Confidence',
};

// Fields in statements that are taxonomy dimensions (string-valued)
const STMT_DIM_FIELDS = [
  'theme', 'audience', 'level_of_escalation', 'nature_of_threat',
  'underlying_values_or_interests', 'temporal_context', 'reciprocity', 'durability',
  'specificity', 'geopolitical_area_of_concern', 'immediacy',
  'unilateral_vs_multilateral', 'rhetorical_device',
  'line_type', 'threat_type', 'line_intensity', 'threat_intensity', 'overall_confidence',
];

// Map statement field names to dimension keys (for fields that differ)
const FIELD_TO_DIM: Record<string, string> = {
  line_type: 'line', threat_type: 'threat',
};

export default function RRLSExplorer() {
  const [taxonomy, setTaxonomy] = useState<Record<string, TaxonomyRow[]>>({});
  const [totals, setTotals] = useState<Record<string, TaxonomyRow[]>>({});
  const [taxTime, setTaxTime] = useState<Record<string, { month: string; value: string; count: number }[]>>({});
  const [statements, setStatements] = useState<RRLSStatement[]>([]);
  const [selectedDim, setSelectedDim] = useState('theme');
  const [crossDim1, setCrossDim1] = useState('theme');
  const [crossDim2, setCrossDim2] = useState('audience');
  const [showBreakdowns, setShowBreakdowns] = useState(false);

  useEffect(() => {
    load<Record<string, TaxonomyRow[]>>('rrls_taxonomy.json').then(setTaxonomy);
    load<Record<string, TaxonomyRow[]>>('rrls_taxonomy_totals.json').then(setTotals);
    load<Record<string, { month: string; value: string; count: number }[]>>('rrls_taxonomy_time.json').then(setTaxTime);
    load<RRLSStatement[]>('rrls_statements.json').then(setStatements);
  }, []);

  // Compute totals dynamically from raw statements for dims not in pre-computed file
  const dynamicTotals = useMemo(() => {
    if (!statements.length) return {};
    const result: Record<string, TaxonomyRow[]> = {};
    for (const field of STMT_DIM_FIELDS) {
      const dimKey = FIELD_TO_DIM[field] || field;
      if (totals[dimKey]) continue; // already have pre-computed data
      const counts: Record<string, number> = {};
      for (const s of statements) {
        const val = String((s as unknown as Record<string, unknown>)[field] ?? '');
        if (val) counts[val] = (counts[val] || 0) + 1;
      }
      result[dimKey] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }));
    }
    return result;
  }, [statements, totals]);

  const mergedTotals = useMemo(() => ({ ...totals, ...dynamicTotals }), [totals, dynamicTotals]);

  const dims = Object.keys(mergedTotals).sort((a, b) =>
    (DIM_LABELS[a] || a).localeCompare(DIM_LABELS[b] || b)
  );
  const allDims = Object.keys(DIM_LABELS).sort((a, b) =>
    (DIM_LABELS[a] || a).localeCompare(DIM_LABELS[b] || b)
  );
  const rows = mergedTotals[selectedDim] || [];
  const totalCount = rows.reduce((s, r) => s + r.count, 0);

  // Compute per-source taxonomy for dims not in pre-computed file
  const dynamicTaxonomy = useMemo(() => {
    if (!statements.length) return {};
    const result: Record<string, TaxonomyRow[]> = {};
    for (const field of STMT_DIM_FIELDS) {
      const dimKey = FIELD_TO_DIM[field] || field;
      if (taxonomy[dimKey]) continue;
      const counts: Record<string, Record<string, number>> = {};
      for (const s of statements) {
        const val = String((s as unknown as Record<string, unknown>)[field] ?? '');
        if (!val) continue;
        const src = s.source || '';
        if (!counts[src]) counts[src] = {};
        counts[src][val] = (counts[src][val] || 0) + 1;
      }
      const rows: TaxonomyRow[] = [];
      for (const [source, vals] of Object.entries(counts)) {
        for (const [value, count] of Object.entries(vals)) {
          rows.push({ value, count, source });
        }
      }
      result[dimKey] = rows;
    }
    return result;
  }, [statements, taxonomy]);

  const mergedTaxonomy = useMemo(() => ({ ...taxonomy, ...dynamicTaxonomy }), [taxonomy, dynamicTaxonomy]);

  // Compute time series for dims not in pre-computed file
  const dynamicTaxTime = useMemo(() => {
    if (!statements.length) return {};
    const result: Record<string, { month: string; value: string; count: number }[]> = {};
    for (const field of STMT_DIM_FIELDS) {
      const dimKey = FIELD_TO_DIM[field] || field;
      if (taxTime[dimKey]) continue;
      const counts: Record<string, Record<string, number>> = {};
      for (const s of statements) {
        if (!s.date) continue;
        const month = s.date.slice(0, 7);
        const val = String((s as unknown as Record<string, unknown>)[field] ?? '');
        if (!val) continue;
        const key = `${month}|${val}`;
        if (!counts[key]) counts[key] = { m: month, v: val, c: 0 } as unknown as Record<string, number>;
        counts[key] = { ...counts[key] };
      }
      // Simpler approach
      const agg: Record<string, number> = {};
      for (const s of statements) {
        if (!s.date) continue;
        const month = s.date.slice(0, 7);
        const val = String((s as unknown as Record<string, unknown>)[field] ?? '');
        if (!val) continue;
        const key = `${month}|${val}`;
        agg[key] = (agg[key] || 0) + 1;
      }
      result[dimKey] = Object.entries(agg).map(([key, count]) => {
        const [month, value] = key.split('|');
        return { month, value, count };
      });
    }
    return result;
  }, [statements, taxTime]);

  const mergedTaxTime = useMemo(() => ({ ...taxTime, ...dynamicTaxTime }), [taxTime, dynamicTaxTime]);

  // Dynamic cross-tabulation from raw statements
  const crossRows = useMemo(() => {
    if (!statements.length || crossDim1 === crossDim2) return [];
    const counts: Record<string, Record<string, number>> = {};
    for (const s of statements) {
      const v1 = (s as unknown as Record<string, unknown>)[crossDim1] as string;
      const v2 = (s as unknown as Record<string, unknown>)[crossDim2] as string;
      if (!v1 || !v2) continue;
      if (!counts[v1]) counts[v1] = {};
      counts[v1][v2] = (counts[v1][v2] || 0) + 1;
    }
    const result: { dim1: string; dim2: string; count: number }[] = [];
    for (const [d1, inner] of Object.entries(counts)) {
      for (const [d2, c] of Object.entries(inner)) {
        result.push({ dim1: d1, dim2: d2, count: c });
      }
    }
    return result;
  }, [statements, crossDim1, crossDim2]);

  // Heatmap data from cross-tab
  const dim1Vals = [...new Set(crossRows.map(r => r.dim1))].sort();
  const dim2Vals = [...new Set(crossRows.map(r => r.dim2))].sort();
  const zMap: Record<string, Record<string, number>> = {};
  for (const r of crossRows) {
    if (!zMap[r.dim1]) zMap[r.dim1] = {};
    zMap[r.dim1][r.dim2] = r.count;
  }
  const z = dim1Vals.map(d1 => dim2Vals.map(d2 => zMap[d1]?.[d2] || 0));

  // Time series for selected dim
  const timeData = mergedTaxTime[selectedDim] || [];
  const timeValues = [...new Set(timeData.map(r => r.value))].slice(0, 8);
  const timeMonths = [...new Set(timeData.map(r => r.month))].sort();

  // Compute RRLS ordinal severity over time from raw statements
  const ordinalMonthly = useMemo(() => {
    if (!statements.length) return {};
    const agg: Record<string, Record<string, { total: number; count: number }>> = {};
    for (const dim of RRLS_ORDINAL_DIMS) {
      agg[dim] = {};
      const scores = RRLS_ORDINAL_SCORES[dim];
      for (const s of statements) {
        if (!s.date) continue;
        const month = s.date.slice(0, 7);
        const val = (s as unknown as Record<string, unknown>)[dim] as string;
        if (!val || scores[val] === undefined) continue;
        if (!agg[dim][month]) agg[dim][month] = { total: 0, count: 0 };
        agg[dim][month].total += scores[val];
        agg[dim][month].count += 1;
      }
    }
    const result: Record<string, Record<string, number>> = {};
    for (const dim of RRLS_ORDINAL_DIMS) {
      result[dim] = {};
      for (const [m, v] of Object.entries(agg[dim])) {
        result[dim][m] = v.count > 0 ? v.total / v.count : 0;
      }
    }
    return result;
  }, [statements]);

  const ordinalMonths = useMemo(() => {
    const ms = new Set<string>();
    for (const dim of RRLS_ORDINAL_DIMS) {
      for (const m of Object.keys(ordinalMonthly[dim] || {})) ms.add(m);
    }
    return [...ms].sort();
  }, [ordinalMonthly]);

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
              marker: { color: rows.map((r, i) => getDimValueColor(RRLS_COLORS, selectedDim, r.value, i)) },
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
              marker: { color: rows.map((r, i) => getDimValueColor(RRLS_COLORS, selectedDim, r.value, i)) },
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
      {mergedTaxonomy[selectedDim] && (
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
                for (const r of mergedTaxonomy[selectedDim]) {
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
                  marker: { color: getDimValueColor(RRLS_COLORS, selectedDim, v, i) },
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
                line: { color: getDimValueColor(RRLS_COLORS, selectedDim, v, i) },
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

      {/* Average Severity (Ordinal Scores) Over Time */}
      {ordinalMonths.length > 0 && (
        <>
          <div className="chart-row">
            <div className="chart-box">
              <div className="chart-title-bar">
                <h4>Average Ordinal Severity Over Time</h4>
                <ChartInfo
                  title="Average Ordinal Severity Over Time"
                  description="Each line shows the weighted average ordinal score per month for RRLS dimensions that have natural ordering: Line Type (1-3), Threat Type (1-3), Specificity (1-3), Immediacy (1-3), Durability (1-7). Higher values indicate more explicit, immediate, and durable red line statements."
                />
              </div>
              <Plot
                data={RRLS_ORDINAL_DIMS.map(dim => ({
                  type: 'scatter' as const,
                  mode: 'lines+markers' as const,
                  name: DIM_LABELS[dim] || dim,
                  x: ordinalMonths,
                  y: ordinalMonths.map(m => ordinalMonthly[dim]?.[m] || null),
                  connectgaps: true,
                  line: { color: RRLS_DIM_COLORS[dim], width: 2 },
                  marker: { size: 4 },
                }))}
                layout={{
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e0e0e0' },
                  margin: { t: 10, b: 40, l: 60, r: 20 },
                  height: 400,
                  legend: { orientation: 'h', y: 1.15, font: { size: 11 } },
                  xaxis: { title: 'Month' },
                  yaxis: { title: 'Ordinal Score (higher = more severe)' },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Expandable ordinal breakdowns */}
          <button
            className="expandable-toggle"
            onClick={() => setShowBreakdowns(!showBreakdowns)}
          >
            {showBreakdowns ? '\u25bc Hide' : '\u25b6 Show'} ordinal dimension breakdowns
          </button>

          {showBreakdowns && RRLS_ORDINAL_DIMS.map(dim => {
            const scores = RRLS_ORDINAL_SCORES[dim];
            const vals = Object.keys(scores).sort((a, b) => scores[a] - scores[b]);
            // Aggregate from raw statements by month
            const agg: Record<string, Record<string, number>> = {};
            for (const s of statements) {
              if (!s.date) continue;
              const month = s.date.slice(0, 7);
              const val = (s as unknown as Record<string, unknown>)[dim] as string;
              if (!val || scores[val] === undefined) continue;
              if (!agg[month]) agg[month] = {};
              agg[month][val] = (agg[month][val] || 0) + 1;
            }
            const months = Object.keys(agg).sort();

            return (
              <div className="chart-row" key={dim}>
                <div className="chart-box">
                  <div className="chart-title-bar">
                    <h4>{DIM_LABELS[dim] || dim} — Monthly Breakdown</h4>
                    <ChartInfo
                      title={`${DIM_LABELS[dim] || dim} Monthly Breakdown`}
                      description={`Stacked bar chart showing the distribution of ${DIM_LABELS[dim] || dim} values per month. Colors follow the ordinal severity scale from green (low) to red (high).`}
                    />
                  </div>
                  <Plot
                    data={vals.map((v, i) => ({
                      type: 'bar' as const,
                      name: v,
                      x: months,
                      y: months.map(m => agg[m]?.[v] || 0),
                      marker: { color: getDimValueColor(RRLS_COLORS, dim, v, i) },
                    }))}
                    layout={{
                      barmode: 'stack',
                      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                      font: { color: '#e0e0e0', size: 11 },
                      margin: { t: 10, b: 40, l: 60, r: 20 },
                      height: 300,
                      legend: { orientation: 'h', y: 1.15, font: { size: 10 } },
                      xaxis: { title: 'Month' },
                      yaxis: { title: 'Count' },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Cross-tabulation with two dimension pickers */}
      <h3 style={{ marginTop: 24 }}>Cross-Tabulation</h3>
      <div className="filter-bar">
        <label>Rows:</label>
        <select value={crossDim1} onChange={e => setCrossDim1(e.target.value)}>
          {allDims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
        </select>
        <label>{'\u00d7'}</label>
        <label>Columns:</label>
        <select value={crossDim2} onChange={e => setCrossDim2(e.target.value)}>
          {allDims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
        </select>
        {crossDim1 === crossDim2 && (
          <span style={{ color: '#d62728', fontSize: 12 }}>Pick two different dimensions</span>
        )}
      </div>
      {crossRows.length > 0 && (
        <div className="chart-row">
          <div className="chart-box">
            <div className="chart-title-bar">
              <h4>{DIM_LABELS[crossDim1] || crossDim1} {'\u00d7'} {DIM_LABELS[crossDim2] || crossDim2}</h4>
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
                hovertemplate: `%{y} ${'\u00d7'} %{x}: %{z}<extra></extra>`,
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
      )}
    </div>
  );
}
