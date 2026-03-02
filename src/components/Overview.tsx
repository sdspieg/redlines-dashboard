import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import type { OverviewStats, SourceRow, ComparativeRow } from '../types';

export default function Overview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [chunks, setChunks] = useState<SourceRow[]>([]);
  const [rrls, setRrls] = useState<SourceRow[]>([]);
  const [nts, setNts] = useState<SourceRow[]>([]);
  const [comp, setComp] = useState<ComparativeRow[]>([]);

  useEffect(() => {
    load<OverviewStats>('overview_stats.json').then(setStats);
    load<SourceRow[]>('chunks_by_source.json').then(setChunks);
    load<SourceRow[]>('rrls_by_source.json').then(setRrls);
    load<SourceRow[]>('nts_by_source.json').then(setNts);
    load<ComparativeRow[]>('comparative_by_db.json').then(setComp);
  }, []);

  if (!stats) return <div className="loading">Loading...</div>;

  const funnelLabels = ['Total Chunks', '1st Pass RLS', '2nd Pass RRLS', '3rd Pass', 'CRLS'];
  const funnelVals = [stats.total_chunks, stats.fpa_rls_relevant, stats.rls2_confirmed, stats.rls3_confirmed, stats.crls_count];

  const ntsFunnel = ['Total Chunks', '1st Pass NTS', '2nd Pass NTS'];
  const ntsVals = [stats.total_chunks, stats.fpa_nts_relevant, stats.nts2_confirmed];

  // Top 15 sources by RRLS
  const top = rrls.slice(0, 15);

  return (
    <div className="tab-content">
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-val">{stats.total_docs.toLocaleString()}</div>
          <div className="stat-label">Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.total_chunks.toLocaleString()}</div>
          <div className="stat-label">Chunks</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#1f77b4' }}>
          <div className="stat-val">{stats.rls2_confirmed.toLocaleString()}</div>
          <div className="stat-label">RRLS Statements</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#ff7f0e' }}>
          <div className="stat-val">{stats.nts2_confirmed.toLocaleString()}</div>
          <div className="stat-label">NTS Statements</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#d62728' }}>
          <div className="stat-val">{stats.crls_count.toLocaleString()}</div>
          <div className="stat-label">CRLS Statements</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{stats.total_sources}</div>
          <div className="stat-label">Sources</div>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-box">
          <Plot
            data={[{
              type: 'funnel',
              y: funnelLabels,
              x: funnelVals,
              textinfo: 'value+percent initial',
              marker: { color: ['#a0a0b0', '#1f77b4', '#2980b9', '#1a5276', '#d62728'] },
            }]}
            layout={{
              title: 'RLS → RRLS → CRLS Pipeline',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' }, margin: { t: 40, b: 20, l: 120, r: 20 },
              height: 300,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
        <div className="chart-box">
          <Plot
            data={[{
              type: 'funnel',
              y: ntsFunnel,
              x: ntsVals,
              textinfo: 'value+percent initial',
              marker: { color: ['#a0a0b0', '#ff7f0e', '#e67e22'] },
            }]}
            layout={{
              title: 'NTS Pipeline',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' }, margin: { t: 40, b: 20, l: 120, r: 20 },
              height: 300,
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
              {
                type: 'bar', name: 'RRLS', x: top.map(r => r.source), y: top.map(r => r.confirmed ?? 0),
                marker: { color: '#1f77b4' },
              },
              {
                type: 'bar', name: 'NTS',
                x: nts.slice(0, 15).map(r => r.source),
                y: nts.slice(0, 15).map(r => r.confirmed ?? 0),
                marker: { color: '#ff7f0e' },
              },
            ]}
            layout={{
              title: 'Confirmed Statements by Source (Top 15)',
              barmode: 'group',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              xaxis: { tickangle: -45 },
              margin: { t: 40, b: 120, l: 60, r: 20 },
              height: 400,
              legend: { orientation: 'h', y: 1.1 },
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
              { type: 'bar', name: 'Total Chunks', x: comp.map(r => r.db), y: comp.map(r => r.total_chunks), marker: { color: '#a0a0b0' } },
              { type: 'bar', name: 'RRLS', x: comp.map(r => r.db), y: comp.map(r => r.rrls), marker: { color: '#1f77b4' } },
              { type: 'bar', name: 'NTS', x: comp.map(r => r.db), y: comp.map(r => r.nts), marker: { color: '#ff7f0e' } },
            ]}
            layout={{
              title: 'By Database',
              barmode: 'group',
              paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
              font: { color: '#e0e0e0' },
              margin: { t: 40, b: 60, l: 60, r: 20 },
              height: 350,
              legend: { orientation: 'h', y: 1.1 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="info-box">
        <p>Date range: <strong>{stats.date_min}</strong> to <strong>{stats.date_max}</strong> | {chunks.length} unique sources across {stats.total_sources} institutions</p>
        <p>Pipeline: 1st pass (GPT-4o screening) → 2nd pass (GPT-5 mini taxonomy) → 3rd pass (civilizational framing)</p>
      </div>
    </div>
  );
}
