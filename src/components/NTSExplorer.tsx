import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import { getColor } from '../colors';
import ChartInfo from './ChartInfo';
import type { TaxonomyRow, NTSSeverityRow } from '../types';

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

const ORDINAL_DIMS = ['tone', 'conditionality', 'consequences', 'specificity'];

const SEVERITY_SCORES: Record<string, Record<string, number>> = {
  tone: { measured: 1, cautious: 2, firm: 3, threatening: 4, aggressive: 5 },
  conditionality: { unconditional: 1, conditional: 2, implied: 3 },
  consequences: { unspecified: 1, diplomatic: 2, economic: 3, military: 4, existential: 5 },
  specificity: { vague: 1, general: 2, specific: 3, explicit: 4 },
};

const DIM_COLORS: Record<string, string> = {
  tone: '#1f77b4',
  conditionality: '#ff7f0e',
  consequences: '#d62728',
  specificity: '#2ca02c',
};

export default function NTSExplorer() {
  const [taxonomy, setTaxonomy] = useState<Record<string, TaxonomyRow[]>>({});
  const [severity, setSeverity] = useState<NTSSeverityRow[]>([]);
  const [selectedDim, setSelectedDim] = useState('nts_statement_type');
  const [showBreakdowns, setShowBreakdowns] = useState(false);

  useEffect(() => {
    load<Record<string, TaxonomyRow[]>>('nts_taxonomy.json').then(setTaxonomy);
    load<NTSSeverityRow[]>('nts_severity_monthly.json').then(setSeverity);
  }, []);

  const dims = Object.keys(taxonomy).sort((a, b) =>
    (DIM_LABELS[a] || a).localeCompare(DIM_LABELS[b] || b)
  );
  const rows = taxonomy[selectedDim] || [];

  // Compute average severity per month per dimension
  const computeAvgSeverity = (dim: string) => {
    const scores = SEVERITY_SCORES[dim];
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

  // Severity breakdown by month × dim
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

  return (
    <div className="tab-content">
      <h2 style={{ color: '#ff7f0e' }}>Nuclear Threat Statements (NTS) Explorer</h2>

      <div className="filter-bar">
        <label>Dimension:</label>
        <select value={selectedDim} onChange={e => setSelectedDim(e.target.value)}>
          {dims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
        </select>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-title-bar">
            <ChartInfo
              title={DIM_LABELS[selectedDim] || selectedDim}
              description="Horizontal bar chart showing the frequency of each value for the selected NTS taxonomy dimension across all confirmed nuclear threat statements."
            />
          </div>
          <Plot
            data={[{
              type: 'bar',
              x: rows.map(r => r.count),
              y: rows.map(r => r.value),
              orientation: 'h',
              marker: { color: '#ff7f0e' },
              text: rows.map(r => r.count.toString()),
              textposition: 'outside',
            }]}
            layout={{
              title: DIM_LABELS[selectedDim] || selectedDim,
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 40, b: 20, l: 220, r: 60 },
              height: Math.max(300, rows.length * 30),
              yaxis: { autorange: 'reversed' },
              xaxis: { title: 'Count' },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Average Severity by Dimension Over Time */}
      {severity.length > 0 && (
        <>
          <h3 style={{ color: '#ff7f0e', marginTop: 30 }}>Average Severity by Dimension Over Time</h3>
          <div className="chart-row">
            <div className="chart-box">
              <div className="chart-title-bar">
                <ChartInfo
                  title="Average Severity by Dimension Over Time"
                  description="Each line shows the weighted average severity score per month for one ordinal dimension (Tone, Conditionality, Consequences, Specificity). Higher scores indicate more severe/escalatory language. Scores are derived by mapping each ordinal value to a numeric scale."
                />
              </div>
              <Plot
                data={ORDINAL_DIMS.map(dim => {
                  const avgByMonth = computeAvgSeverity(dim);
                  return {
                    type: 'scatter' as const,
                    mode: 'lines+markers' as const,
                    name: DIM_LABELS[dim] || dim,
                    x: allMonths,
                    y: allMonths.map(m => avgByMonth[m] || null),
                    connectgaps: true,
                    line: { color: DIM_COLORS[dim], width: 2 },
                    marker: { size: 4 },
                  };
                })}
                layout={{
                  title: 'Average Severity by Dimension Over Time',
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e0e0e0' },
                  margin: { t: 40, b: 40, l: 60, r: 20 },
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

          {showBreakdowns && ORDINAL_DIMS.map(dim => {
            const agg = severityByMonth(dim);
            const months = Object.keys(agg).sort();
            const vals = [...new Set(severity.map(r => (r as unknown as Record<string, unknown>)[dim] as string).filter(Boolean))];
            if (vals.length === 0) return null;

            return (
              <div className="chart-row" key={dim}>
                <div className="chart-box">
                  <div className="chart-title-bar">
                    <ChartInfo
                      title={`${DIM_LABELS[dim] || dim} Monthly Breakdown`}
                      description={`Stacked bar chart showing the distribution of ${DIM_LABELS[dim] || dim} values per month. Each color represents a different ordinal level.`}
                    />
                  </div>
                  <Plot
                    data={vals.map((v, i) => ({
                      type: 'bar' as const,
                      name: v,
                      x: months,
                      y: months.map(m => agg[m]?.[v] || 0),
                      marker: { color: getColor(`${dim}_${v}`, i) },
                    }))}
                    layout={{
                      title: DIM_LABELS[dim] || dim,
                      barmode: 'stack',
                      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                      font: { color: '#e0e0e0', size: 11 },
                      margin: { t: 40, b: 40, l: 60, r: 20 },
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
    </div>
  );
}
