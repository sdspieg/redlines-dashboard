import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
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

export default function NTSExplorer() {
  const [taxonomy, setTaxonomy] = useState<Record<string, TaxonomyRow[]>>({});
  const [severity, setSeverity] = useState<NTSSeverityRow[]>([]);
  const [selectedDim, setSelectedDim] = useState('nts_statement_type');

  useEffect(() => {
    load<Record<string, TaxonomyRow[]>>('nts_taxonomy.json').then(setTaxonomy);
    load<NTSSeverityRow[]>('nts_severity_monthly.json').then(setSeverity);
  }, []);

  const dims = Object.keys(taxonomy);
  const rows = taxonomy[selectedDim] || [];

  // Severity heatmap: aggregate by month × dim
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
      <h2 style={{ color: '#f0883e' }}>Nuclear Threat Statements (NTS) Explorer</h2>

      <div className="filter-bar">
        <label>Dimension:</label>
        <select value={selectedDim} onChange={e => setSelectedDim(e.target.value)}>
          {dims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
        </select>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={[{
              type: 'bar',
              x: rows.map(r => r.count),
              y: rows.map(r => r.value),
              orientation: 'h',
              marker: { color: '#f0883e' },
              text: rows.map(r => r.count.toString()),
              textposition: 'outside',
            }]}
            layout={{
              title: DIM_LABELS[selectedDim] || selectedDim,
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
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

      {/* Severity over time for ordinal dimensions */}
      <h3 style={{ color: '#f0883e', marginTop: 30 }}>Severity Trends Over Time</h3>
      {ORDINAL_DIMS.map(dim => {
        const agg = severityByMonth(dim);
        const months = Object.keys(agg).sort();
        const vals = [...new Set(severity.map(r => (r as unknown as Record<string, unknown>)[dim] as string).filter(Boolean))];
        if (vals.length === 0) return null;

        return (
          <div className="chart-row" key={dim}>
            <div className="chart-box">
              <Plot
                data={vals.map(v => ({
                  type: 'bar' as const,
                  name: v,
                  x: months,
                  y: months.map(m => agg[m]?.[v] || 0),
                }))}
                layout={{
                  title: DIM_LABELS[dim] || dim,
                  barmode: 'stack',
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#c9d1d9', size: 11 },
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
    </div>
  );
}
