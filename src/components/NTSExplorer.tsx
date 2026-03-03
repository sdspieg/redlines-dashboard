import { useEffect, useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import { NTS_COLORS, NTS_ORDINAL_SCORES, NTS_ORDINAL_DIMS, NTS_DIM_COLORS, getDimValueColor } from '../colors';
import ChartInfo from './ChartInfo';
import type { TaxonomyRow, NTSSeverityRow, NTSStatement } from '../types';

const DIM_LABELS: Record<string, string> = {
  nts_statement_type: 'Statement Type', nts_threat_type: 'Threat Type',
  capability: 'Capability', delivery_system: 'Delivery System',
  conditionality: 'Conditionality', purpose: 'Purpose', tone: 'Tone',
  context: 'Context', geographical_reach: 'Geographical Reach',
  consequences: 'Consequences', timeline: 'Timeline',
  arms_control_and_testing: 'Arms Control & Testing',
  audience: 'Audience', specificity: 'Specificity',
  rhetorical_device: 'Rhetorical Device',
};

export default function NTSExplorer() {
  const [taxonomy, setTaxonomy] = useState<Record<string, TaxonomyRow[]>>({});
  const [severity, setSeverity] = useState<NTSSeverityRow[]>([]);
  const [statements, setStatements] = useState<NTSStatement[]>([]);
  const [selectedDim, setSelectedDim] = useState('nts_statement_type');
  const [showBreakdowns, setShowBreakdowns] = useState(false);
  const [crossDim1, setCrossDim1] = useState('nts_threat_type');
  const [crossDim2, setCrossDim2] = useState('tone');
  const [minConfidence, setMinConfidence] = useState(7);

  useEffect(() => {
    load<Record<string, TaxonomyRow[]>>('nts_taxonomy.json').then(setTaxonomy);
    load<NTSSeverityRow[]>('nts_severity_monthly.json').then(setSeverity);
    load<NTSStatement[]>('nts_statements.json').then(setStatements);
  }, []);

  // Filter statements by confidence
  const filteredStatements = useMemo(() =>
    minConfidence > 7 ? statements.filter(s => (s.overall_confidence ?? 0) >= minConfidence) : statements
  , [statements, minConfidence]);

  const dims = Object.keys(taxonomy).sort((a, b) =>
    (DIM_LABELS[a] || a).localeCompare(DIM_LABELS[b] || b)
  );
  const allDims = Object.keys(DIM_LABELS).sort((a, b) =>
    (DIM_LABELS[a] || a).localeCompare(DIM_LABELS[b] || b)
  );
  const rows = taxonomy[selectedDim] || [];
  const totalCount = rows.reduce((s, r) => s + r.count, 0);

  // Compute average severity per month per dimension
  const computeAvgSeverity = (dim: string) => {
    const scores = NTS_ORDINAL_SCORES[dim];
    if (!scores) return {};
    const monthAgg: Record<string, { total: number; count: number }> = {};
    for (const r of severity) {
      const val = (r as unknown as Record<string, unknown>)[dim] as string;
      if (!val || scores[val] === undefined) continue;
      if (!monthAgg[r.month]) monthAgg[r.month] = { total: 0, count: 0 };
      monthAgg[r.month].total += scores[val] * r.count;
      monthAgg[r.month].count += r.count;
    }
    const result: Record<string, number> = {};
    for (const [m, agg] of Object.entries(monthAgg)) {
      result[m] = agg.count > 0 ? agg.total / agg.count : 0;
    }
    return result;
  };

  const allMonths = [...new Set(severity.map(r => r.month))].sort();

  // Severity breakdown by month x dim
  const severityByMonth = (dim: string) => {
    const agg: Record<string, Record<string, number>> = {};
    for (const r of severity) {
      const val = (r as unknown as Record<string, unknown>)[dim] as string;
      if (!val) continue;
      if (!agg[r.month]) agg[r.month] = {};
      agg[r.month][val] = (agg[r.month][val] || 0) + r.count;
    }
    return agg;
  };

  // Dynamic cross-tabulation
  const crossRows = useMemo(() => {
    if (!filteredStatements.length || crossDim1 === crossDim2) return [];
    const counts: Record<string, Record<string, number>> = {};
    for (const s of filteredStatements) {
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
  }, [filteredStatements, crossDim1, crossDim2]);

  const ct1Vals = [...new Set(crossRows.map(r => r.dim1))].sort();
  const ct2Vals = [...new Set(crossRows.map(r => r.dim2))].sort();
  const ctMap: Record<string, Record<string, number>> = {};
  for (const r of crossRows) {
    if (!ctMap[r.dim1]) ctMap[r.dim1] = {};
    ctMap[r.dim1][r.dim2] = r.count;
  }
  const ctZ = ct1Vals.map(d1 => ct2Vals.map(d2 => ctMap[d1]?.[d2] || 0));

  const dimLabel = DIM_LABELS[selectedDim] || selectedDim;
  // Prefix ☢ on bar value labels
  const ntsLabel = (v: string) => `\u2622 ${v}`;

  return (
    <div className="tab-content">
      <h2 style={{ color: '#fdd835' }}>{'\u2622'} Nuclear Threat Statements (NTS) Explorer</h2>

      <div className="filter-bar">
        <label>Dimension:</label>
        <select value={selectedDim} onChange={e => setSelectedDim(e.target.value)}>
          {dims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
        </select>
        <div className="confidence-slider">
          <label>Confidence {'\u2265'}</label>
          <input
            type="range" min={7} max={10} step={1}
            value={minConfidence}
            onChange={e => setMinConfidence(Number(e.target.value))}
          />
          <span className="conf-value">{minConfidence}</span>
        </div>
        <span className="result-count">{filteredStatements.length.toLocaleString()} statements</span>
      </div>

      <div className="chart-row">
        {/* Absolute counts */}
        <div className="chart-box">
          <div className="chart-title-bar">
            <h4>{dimLabel} — Absolute Counts</h4>
            <ChartInfo
              title={`${dimLabel} — Absolute Counts`}
              description="Horizontal bar chart showing the absolute frequency of each value for the selected NTS taxonomy dimension across all confirmed nuclear threat statements."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: rows.map(r => r.count),
              y: rows.map(r => ntsLabel(r.value)),
              orientation: 'h',
              marker: { color: rows.map((r, i) => getDimValueColor(NTS_COLORS, selectedDim, r.value, i)) },
              text: rows.map(r => r.count.toString()),
              textposition: 'outside',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 20, l: 240, r: 60 },
              height: Math.max(300, rows.length * 30),
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
            <h4>{dimLabel} — % of {'\u2622'} NTS</h4>
            <ChartInfo
              title={`${dimLabel} — Relative Share`}
              description="Horizontal bar chart showing what percentage of all NTS statements each value represents for the selected dimension."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: rows.map(r => totalCount > 0 ? (r.count / totalCount) * 100 : 0),
              y: rows.map(r => ntsLabel(r.value)),
              orientation: 'h',
              marker: { color: rows.map((r, i) => getDimValueColor(NTS_COLORS, selectedDim, r.value, i)) },
              text: rows.map(r => totalCount > 0 ? ((r.count / totalCount) * 100).toFixed(1) + '%' : '0%'),
              textposition: 'outside',
            }]}
            layout={{
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 10, b: 20, l: 220, r: 60 },
              height: Math.max(300, rows.length * 30),
              yaxis: { autorange: 'reversed' },
              xaxis: { title: '% of \u2622 NTS Statements', ticksuffix: '%' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Average Severity by Dimension Over Time */}
      {severity.length > 0 && (
        <>
          <div className="chart-row">
            <div className="chart-box">
              <div className="chart-title-bar">
                <h4>Average Severity by Dimension Over Time</h4>
                <ChartInfo
                  title="Average Severity by Dimension Over Time"
                  description="Each line shows the weighted average severity score per month for one ordinal dimension (Tone, Conditionality, Consequences, Specificity). Higher scores indicate more severe/escalatory language. Scores are derived by mapping each ordinal value to a numeric scale."
                />
              </div>
              <Plot
                data={NTS_ORDINAL_DIMS.map(dim => {
                  const avgByMonth = computeAvgSeverity(dim);
                  return {
                    type: 'scatter' as const,
                    mode: 'lines+markers' as const,
                    name: DIM_LABELS[dim] || dim,
                    x: allMonths,
                    y: allMonths.map(m => avgByMonth[m] || null),
                    connectgaps: true,
                    line: { color: NTS_DIM_COLORS[dim], width: 2 },
                    marker: { size: 4 },
                  };
                })}
                layout={{
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e0e0e0' },
                  margin: { t: 10, b: 40, l: 60, r: 20 },
                  height: 400,
                  legend: { orientation: 'h', y: 1.15, font: { size: 11 } },
                  xaxis: { title: 'Month' },
                  yaxis: { title: 'Severity Score (higher = more severe)' },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Expandable monthly breakdowns */}
          <button
            className="expandable-toggle"
            onClick={() => setShowBreakdowns(!showBreakdowns)}
          >
            {showBreakdowns ? '\u25bc Hide' : '\u25b6 Show'} monthly breakdowns
          </button>

          {showBreakdowns && NTS_ORDINAL_DIMS.map(dim => {
            const agg = severityByMonth(dim);
            const months = Object.keys(agg).sort();
            const scores = NTS_ORDINAL_SCORES[dim];
            const vals = Object.keys(scores).sort((a, b) => scores[a] - scores[b]);
            if (vals.length === 0) return null;

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
                      name: ntsLabel(v),
                      x: months,
                      y: months.map(m => agg[m]?.[v] || 0),
                      marker: { color: getDimValueColor(NTS_COLORS, dim, v, i) },
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
                x: ct2Vals.map(ntsLabel), y: ct1Vals.map(ntsLabel), z: ctZ,
                colorscale: [[0, '#1a1a2e'], [0.5, '#fdd835'], [1, '#fff9c4']],
                text: ctZ.map(row => row.map(v => v.toString())),
                texttemplate: '%{text}',
                hovertemplate: `%{y} ${'\u00d7'} %{x}: %{z}<extra></extra>`,
              }]}
              layout={{
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#e0e0e0', size: 10 },
                margin: { t: 10, b: 100, l: 220, r: 20 },
                height: Math.max(350, ct1Vals.length * 30),
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
