import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { load } from '../data';
import ChartInfo from './ChartInfo';
import type {
  CrossCorrPair, GrangerResult, VARModel, LPResult,
  EventStudy, AnalyticsMetadata,
} from '../types';

const PLOT_BG = 'transparent';
const FONT = { color: '#e0e0e0' };
const GRID = { color: 'rgba(255,255,255,0.08)' };

const RHETORIC_OPTS = [
  { value: 'rrls_count', label: 'RRLS Count' },
  { value: 'rrls_intensity_mean', label: 'RRLS Intensity' },
  { value: 'nts_count', label: 'NTS Count' },
  { value: 'nts_severity_mean', label: 'NTS Severity' },
  { value: 'crls_count', label: 'CRLS Count' },
];

const ACTION_OPTS = [
  { value: 'acled_events', label: 'ACLED Events' },
  { value: 'acled_fatalities', label: 'ACLED Fatalities' },
  { value: 'personnel_delta', label: 'Personnel Losses' },
  { value: 'tank_delta', label: 'Tank Losses' },
  { value: 'drone_delta', label: 'Drone Losses' },
  { value: 'missiles_launched', label: 'Missiles Launched' },
  { value: 'aid_military_eur', label: 'Military Aid (EUR)' },
  { value: 'new_sanctions_entities', label: 'New Sanctions' },
  { value: 'gdelt_tone', label: 'GDELT Tone' },
  { value: 'gdelt_nuclear_quotes', label: 'GDELT Nuclear Quotes' },
  { value: 'gdelt_escalation_quotes', label: 'GDELT Escalation Quotes' },
];

export default function Analytics() {
  const [ts, setTs] = useState<Record<string, unknown>[] | null>(null);
  const [crosscorr, setCrosscorr] = useState<CrossCorrPair[] | null>(null);
  const [granger, setGranger] = useState<GrangerResult[] | null>(null);
  const [varModels, setVarModels] = useState<VARModel[] | null>(null);
  const [lp, setLp] = useState<LPResult[] | null>(null);
  const [eventStudy, setEventStudy] = useState<EventStudy[] | null>(null);
  const [meta, setMeta] = useState<AnalyticsMetadata | null>(null);

  // Controls
  const [rhetVar, setRhetVar] = useState('rrls_count');
  const [actVar, setActVar] = useState('acled_fatalities');
  const [direction, setDirection] = useState<'a2r' | 'r2a'>('a2r');
  const [varModel, setVarModel] = useState(0);
  const [irfPair, setIrfPair] = useState('');
  const [irfCumulative, setIrfCumulative] = useState(false);
  const [lpPair, setLpPair] = useState(0);
  const [esSpikeType, setEsSpikeType] = useState(0);
  const [esResponse, setEsResponse] = useState('');
  const [grangerLag, setGrangerLag] = useState('4');

  useEffect(() => {
    load<Record<string, unknown>[]>('analytics_timeseries.json').then(setTs);
    load<CrossCorrPair[]>('analytics_crosscorr.json').then(setCrosscorr);
    load<GrangerResult[]>('analytics_granger.json').then(setGranger);
    load<VARModel[]>('analytics_var.json').then(setVarModels);
    load<LPResult[]>('analytics_lp.json').then(setLp);
    load<EventStudy[]>('analytics_event_study.json').then(setEventStudy);
    load<AnalyticsMetadata>('analytics_metadata.json').then(setMeta);
  }, []);

  // Set defaults once data loads
  useEffect(() => {
    if (varModels && varModels.length > 0 && !irfPair) {
      const keys = Object.keys(varModels[0].irfs);
      if (keys.length > 0) setIrfPair(keys[0]);
    }
  }, [varModels, irfPair]);

  useEffect(() => {
    if (eventStudy && eventStudy.length > 0 && !esResponse) {
      const keys = Object.keys(eventStudy[0].responses);
      if (keys.length > 0) setEsResponse(keys[0]);
    }
  }, [eventStudy, esResponse]);

  if (!ts || !meta) return <div className="loading">Loading analytics data...</div>;

  const rhetLabel = RHETORIC_OPTS.find(o => o.value === rhetVar)?.label ?? rhetVar;
  const actLabel = ACTION_OPTS.find(o => o.value === actVar)?.label ?? actVar;

  // ── Section 1: Time Series ──────────────────────────────────────────────
  const weeks = ts.map(r => r.week as string);
  const rhetSeries = ts.map(r => (r[rhetVar] as number) ?? 0);
  const actSeries = ts.map(r => (r[actVar] as number) ?? 0);

  // ── Section 2: Cross-correlation ────────────────────────────────────────
  const ccPair = crosscorr?.find(
    c => c.rhetoric_var === rhetVar && c.action_var === actVar
  );

  // ── Section 3: Granger heatmap ──────────────────────────────────────────
  const grangerForDirection = granger?.filter(g => {
    if (direction === 'a2r') {
      return meta.action_vars.concat(meta.media_vars).includes(g.cause) &&
             meta.rhetoric_vars.includes(g.effect);
    }
    return meta.rhetoric_vars.includes(g.cause) &&
           meta.action_vars.concat(meta.media_vars).includes(g.effect);
  });

  const gCauses = [...new Set(grangerForDirection?.map(g => g.cause) ?? [])];
  const gEffects = [...new Set(grangerForDirection?.map(g => g.effect) ?? [])];
  const gMatrix: (number | null)[][] = [];
  const gAnnotations: { text: string; x: number; y: number }[] = [];

  for (let j = 0; j < gEffects.length; j++) {
    const row: (number | null)[] = [];
    for (let i = 0; i < gCauses.length; i++) {
      const entry = grangerForDirection?.find(
        g => g.cause === gCauses[i] && g.effect === gEffects[j]
      );
      const p = entry?.lags[grangerLag]?.f_pvalue ?? null;
      row.push(p !== null ? -Math.log10(Math.max(p, 1e-20)) : null);
      if (p !== null) {
        const stars = p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';
        gAnnotations.push({ text: stars, x: i, y: j });
      }
    }
    gMatrix.push(row);
  }

  // ── Section 4: VAR IRFs ─────────────────────────────────────────────────
  const currentVAR = varModels?.[varModel];
  const currentIRF = currentVAR?.irfs[irfPair];
  const varPairKeys = currentVAR ? Object.keys(currentVAR.irfs) : [];

  // ── Section 5: LP IRFs ──────────────────────────────────────────────────
  const currentLP = lp?.[lpPair];

  // ── Section 6: Event Study ──────────────────────────────────────────────
  const currentES = eventStudy?.[esSpikeType];
  const currentESResp = currentES?.responses[esResponse];
  const esResponseKeys = currentES ? Object.keys(currentES.responses) : [];

  return (
    <div className="tab-content">
      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="stat-cards" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#aaa' }}>Rhetoric:</label>
          <select value={rhetVar} onChange={e => setRhetVar(e.target.value)}
            style={selectStyle}>
            {RHETORIC_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#aaa' }}>Action/Media:</label>
          <select value={actVar} onChange={e => setActVar(e.target.value)}
            style={selectStyle}>
            {ACTION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#aaa' }}>Direction:</label>
          <select value={direction} onChange={e => setDirection(e.target.value as 'a2r' | 'r2a')}
            style={selectStyle}>
            <option value="a2r">Action → Rhetoric</option>
            <option value="r2a">Rhetoric → Action</option>
          </select>
        </div>
      </div>

      {/* ── Section 1: Time Series Overview ──────────────────────────── */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>Time Series: {rhetLabel} vs {actLabel}</h4>
            <ChartInfo title="Time Series Overview"
              description="Weekly time series of the selected rhetoric and action/media variables, shown on separate y-axes. Use the dropdowns above to change variables." />
          </div>
          <Plot
            data={[
              {
                x: weeks, y: rhetSeries, name: rhetLabel,
                type: 'scatter', mode: 'lines',
                line: { color: '#ef5350', width: 2 },
                yaxis: 'y',
              },
              {
                x: weeks, y: actSeries, name: actLabel,
                type: 'scatter', mode: 'lines',
                line: { color: '#4fc3f7', width: 2 },
                yaxis: 'y2',
              },
            ]}
            layout={{
              paper_bgcolor: PLOT_BG, plot_bgcolor: PLOT_BG, font: FONT,
              margin: { t: 30, b: 50, l: 60, r: 60 }, height: 300,
              legend: { x: 0, y: 1.15, orientation: 'h' },
              xaxis: { gridcolor: GRID.color },
              yaxis: { title: rhetLabel, titlefont: { color: '#ef5350' }, gridcolor: GRID.color },
              yaxis2: {
                title: actLabel, titlefont: { color: '#4fc3f7' },
                overlaying: 'y', side: 'right',
              },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── Section 2: Cross-Correlation ─────────────────────────────── */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>Cross-Correlation: {rhetLabel} × {actLabel}</h4>
            <ChartInfo title="Cross-Correlation"
              description="Bar chart of cross-correlations at lags -12 to +12 weeks. Positive lag means rhetoric leads the action variable. Dashed lines show 95% confidence bounds. Bars exceeding the bounds indicate statistically significant correlation at that lag." />
          </div>
          {ccPair ? (
            <Plot
              data={[
                {
                  x: ccPair.correlations.map(c => c.lag),
                  y: ccPair.correlations.map(c => c.r),
                  type: 'bar',
                  marker: {
                    color: ccPair.correlations.map(c =>
                      Math.abs(c.r) > ccPair.ci_bound ? '#4fc3f7' : 'rgba(79,195,247,0.3)'
                    ),
                  },
                },
              ]}
              layout={{
                paper_bgcolor: PLOT_BG, plot_bgcolor: PLOT_BG, font: FONT,
                margin: { t: 20, b: 50, l: 60, r: 30 }, height: 280,
                showlegend: false,
                xaxis: { title: 'Lag (weeks, + = rhetoric leads)', gridcolor: GRID.color },
                yaxis: { title: 'Correlation', gridcolor: GRID.color },
                shapes: [
                  { type: 'line', x0: -12, x1: 12, y0: ccPair.ci_bound, y1: ccPair.ci_bound,
                    line: { dash: 'dash', color: '#ff7043', width: 1 } },
                  { type: 'line', x0: -12, x1: 12, y0: -ccPair.ci_bound, y1: -ccPair.ci_bound,
                    line: { dash: 'dash', color: '#ff7043', width: 1 } },
                ],
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : <p style={{ color: '#888', padding: '2rem' }}>No data for this pair.</p>}
        </div>
      </div>

      {/* ── Section 3: Granger Causality Heatmap ─────────────────────── */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>Granger Causality Heatmap ({direction === 'a2r' ? 'Action → Rhetoric' : 'Rhetoric → Action'})</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Lag:</label>
              <select value={grangerLag} onChange={e => setGrangerLag(e.target.value)} style={selectStyle}>
                {[1,2,3,4,5,6,7,8].map(l => <option key={l} value={String(l)}>{l}</option>)}
              </select>
              <ChartInfo title="Granger Causality Heatmap"
                description="Heatmap of Granger causality p-values. Color intensity represents -log10(p): brighter = more significant. Stars: * p<0.05, ** p<0.01, *** p<0.001. Tests whether past values of the 'cause' variable help predict the 'effect' variable beyond its own past." />
            </div>
          </div>
          {gCauses.length > 0 && gEffects.length > 0 ? (
            <Plot
              data={[{
                z: gMatrix,
                x: gCauses.map(c => meta.variables[c] ?? c),
                y: gEffects.map(e => meta.variables[e] ?? e),
                type: 'heatmap',
                colorscale: [
                  [0, '#1a1a2e'], [0.3, '#16213e'], [0.5, '#0f3460'],
                  [0.7, '#4fc3f7'], [1, '#e1f5fe'],
                ],
                colorbar: { title: '-log10(p)', titleside: 'right' },
              }]}
              layout={{
                paper_bgcolor: PLOT_BG, plot_bgcolor: PLOT_BG, font: FONT,
                margin: { t: 20, b: 100, l: 140, r: 80 }, height: 350,
                xaxis: { tickangle: -45 },
                annotations: gAnnotations.map(a => ({
                  x: a.x, y: a.y, text: a.text,
                  showarrow: false, font: { color: '#fff', size: 14 },
                })),
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : <p style={{ color: '#888', padding: '2rem' }}>No Granger results available.</p>}
        </div>
      </div>

      {/* ── Section 4: VAR Impulse Response Functions ────────────────── */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>VAR Impulse Response Functions</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {varModels && varModels.length > 1 && (
                <select value={varModel} onChange={e => {
                  const idx = Number(e.target.value);
                  setVarModel(idx);
                  const keys = Object.keys(varModels[idx].irfs);
                  if (keys.length > 0) setIrfPair(keys[0]);
                }} style={selectStyle}>
                  {varModels.map((m, i) => <option key={i} value={i}>{m.name}</option>)}
                </select>
              )}
              <select value={irfPair} onChange={e => setIrfPair(e.target.value)} style={selectStyle}>
                {varPairKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <label style={{ fontSize: '0.8rem', color: '#aaa', cursor: 'pointer' }}>
                <input type="checkbox" checked={irfCumulative}
                  onChange={e => setIrfCumulative(e.target.checked)} /> Cumulative
              </label>
              <ChartInfo title="VAR Impulse Response Functions"
                description="Shows how a one-standard-deviation shock to the impulse variable affects the response variable over 20 weeks. Shaded area = 95% bootstrap CI (500 replications). Toggle 'Cumulative' to see accumulated effects. VAR lag order selected by AIC." />
            </div>
          </div>
          {currentIRF ? (
            <Plot
              data={[
                ...(currentIRF.ci_lower && currentIRF.ci_upper && !irfCumulative ? [{
                  x: currentIRF.horizons, y: currentIRF.ci_upper,
                  type: 'scatter' as const, mode: 'lines' as const,
                  line: { width: 0 }, showlegend: false,
                }, {
                  x: currentIRF.horizons, y: currentIRF.ci_lower,
                  type: 'scatter' as const, mode: 'lines' as const,
                  fill: 'tonexty' as const, fillcolor: 'rgba(79,195,247,0.15)',
                  line: { width: 0 }, showlegend: false,
                }] : []),
                ...(currentIRF.cum_ci_lower && currentIRF.cum_ci_upper && irfCumulative ? [{
                  x: currentIRF.horizons, y: currentIRF.cum_ci_upper,
                  type: 'scatter' as const, mode: 'lines' as const,
                  line: { width: 0 }, showlegend: false,
                }, {
                  x: currentIRF.horizons, y: currentIRF.cum_ci_lower,
                  type: 'scatter' as const, mode: 'lines' as const,
                  fill: 'tonexty' as const, fillcolor: 'rgba(79,195,247,0.15)',
                  line: { width: 0 }, showlegend: false,
                }] : []),
                {
                  x: currentIRF.horizons,
                  y: irfCumulative ? currentIRF.cumulative : currentIRF.point,
                  type: 'scatter', mode: 'lines',
                  line: { color: '#4fc3f7', width: 2 },
                  name: irfCumulative ? 'Cumulative IRF' : 'IRF',
                },
              ]}
              layout={{
                paper_bgcolor: PLOT_BG, plot_bgcolor: PLOT_BG, font: FONT,
                margin: { t: 20, b: 50, l: 60, r: 30 }, height: 300,
                showlegend: false,
                xaxis: { title: 'Weeks after shock', gridcolor: GRID.color },
                yaxis: { title: 'Response', gridcolor: GRID.color },
                shapes: [{
                  type: 'line', x0: 0, x1: currentIRF.horizons.length - 1,
                  y0: 0, y1: 0, line: { dash: 'dash', color: '#666', width: 1 },
                }],
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : <p style={{ color: '#888', padding: '2rem' }}>
            {varModels?.length ? 'Select an IRF pair.' : 'No VAR model results available.'}
          </p>}
          {currentVAR && (
            <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.5rem 1rem' }}>
              {currentVAR.name} | Optimal lag: {currentVAR.optimal_lag} |
              Variables: {currentVAR.variables.map(v => currentVAR.variable_labels[v]).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 5: Local Projection IRFs ─────────────────────────── */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>Local Projection IRFs (Jord&agrave;)</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {lp && lp.length > 0 && (
                <select value={lpPair} onChange={e => setLpPair(Number(e.target.value))} style={selectStyle}>
                  {lp.map((l, i) => (
                    <option key={i} value={i}>{l.impulse_label} → {l.response_label}</option>
                  ))}
                </select>
              )}
              <ChartInfo title="Local Projection IRFs"
                description="Local projections estimate the response at each horizon independently (no VAR restrictions). Each point is a separate regression of y_{t+h} on x_t controlling for 4 lags. More robust than VAR to misspecification but noisier. Shaded area = 95% CI." />
            </div>
          </div>
          {currentLP ? (
            <Plot
              data={[
                {
                  x: currentLP.horizons, y: currentLP.ci_upper,
                  type: 'scatter', mode: 'lines',
                  line: { width: 0 }, showlegend: false,
                },
                {
                  x: currentLP.horizons, y: currentLP.ci_lower,
                  type: 'scatter', mode: 'lines',
                  fill: 'tonexty', fillcolor: 'rgba(129,199,132,0.15)',
                  line: { width: 0 }, showlegend: false,
                },
                {
                  x: currentLP.horizons, y: currentLP.point,
                  type: 'scatter', mode: 'lines',
                  line: { color: '#81c784', width: 2 },
                  name: 'LP estimate',
                },
              ]}
              layout={{
                paper_bgcolor: PLOT_BG, plot_bgcolor: PLOT_BG, font: FONT,
                margin: { t: 20, b: 50, l: 60, r: 30 }, height: 300,
                showlegend: false,
                xaxis: { title: 'Weeks after shock', gridcolor: GRID.color },
                yaxis: { title: 'Response', gridcolor: GRID.color },
                shapes: [{
                  type: 'line', x0: 1, x1: currentLP.horizons[currentLP.horizons.length - 1],
                  y0: 0, y1: 0, line: { dash: 'dash', color: '#666', width: 1 },
                }],
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : <p style={{ color: '#888', padding: '2rem' }}>No LP results available.</p>}
        </div>
      </div>

      {/* ── Section 6: Event Study ───────────────────────────────────── */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>Event Study: Abnormal Response to Rhetoric Spikes</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {eventStudy && eventStudy.length > 1 && (
                <select value={esSpikeType} onChange={e => {
                  const idx = Number(e.target.value);
                  setEsSpikeType(idx);
                  const keys = Object.keys(eventStudy[idx].responses);
                  if (keys.length > 0) setEsResponse(keys[0]);
                }} style={selectStyle}>
                  {eventStudy.map((es, i) => <option key={i} value={i}>{es.spike_label}</option>)}
                </select>
              )}
              {esResponseKeys.length > 0 && (
                <select value={esResponse} onChange={e => setEsResponse(e.target.value)} style={selectStyle}>
                  {esResponseKeys.map(k => (
                    <option key={k} value={k}>{currentES?.responses[k]?.label ?? k}</option>
                  ))}
                </select>
              )}
              <ChartInfo title="Event Study"
                description="Shows how action/media variables behave around rhetoric spike weeks (> mean + 1.5 SD). t=0 is the spike week. Values are 'abnormal' responses: actual minus baseline (mean of weeks -8 to -1). Averaged across all spike episodes. Shaded = ±1 SE." />
            </div>
          </div>
          {currentESResp ? (
            <Plot
              data={[
                {
                  x: currentESResp.window,
                  y: currentESResp.mean_abnormal.map((m, i) => m + currentESResp.se[i]),
                  type: 'scatter', mode: 'lines',
                  line: { width: 0 }, showlegend: false,
                },
                {
                  x: currentESResp.window,
                  y: currentESResp.mean_abnormal.map((m, i) => m - currentESResp.se[i]),
                  type: 'scatter', mode: 'lines',
                  fill: 'tonexty', fillcolor: 'rgba(255,183,77,0.15)',
                  line: { width: 0 }, showlegend: false,
                },
                {
                  x: currentESResp.window,
                  y: currentESResp.mean_abnormal,
                  type: 'scatter', mode: 'lines+markers',
                  line: { color: '#ffb74d', width: 2 },
                  marker: { size: 4 },
                  name: 'Abnormal response',
                },
              ]}
              layout={{
                paper_bgcolor: PLOT_BG, plot_bgcolor: PLOT_BG, font: FONT,
                margin: { t: 20, b: 50, l: 60, r: 30 }, height: 300,
                showlegend: false,
                xaxis: { title: 'Weeks relative to spike', gridcolor: GRID.color, dtick: 1 },
                yaxis: { title: 'Abnormal response', gridcolor: GRID.color },
                shapes: [
                  { type: 'line', x0: 0, x1: 0,
                    y0: Math.min(...currentESResp.mean_abnormal) * 1.5,
                    y1: Math.max(...currentESResp.mean_abnormal) * 1.5,
                    line: { dash: 'dash', color: '#ef5350', width: 1 } },
                  { type: 'line',
                    x0: currentESResp.window[0],
                    x1: currentESResp.window[currentESResp.window.length - 1],
                    y0: 0, y1: 0,
                    line: { dash: 'dot', color: '#666', width: 1 } },
                ],
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : <p style={{ color: '#888', padding: '2rem' }}>No event study results available.</p>}
          {currentES && (
            <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.5rem 1rem' }}>
              {currentES.n_spikes} spike weeks identified (threshold: {currentES.threshold.toFixed(1)})
            </p>
          )}
        </div>
      </div>

      {/* ── Section 7: Diagnostics ───────────────────────────────────── */}
      <div className="chart-row">
        <div className="chart-box" style={{ flex: 1 }}>
          <div className="chart-title-bar">
            <h4>Diagnostics & Metadata</h4>
            <ChartInfo title="Diagnostics"
              description="Summary of data coverage, stationarity test results (ADF), and any warnings about truncated series." />
          </div>
          <div style={{ padding: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <strong style={{ color: '#4fc3f7' }}>Data Range:</strong>{' '}
                {meta.date_min} to {meta.date_max} ({meta.n_weeks} weeks)
              </div>
              <div>
                <strong style={{ color: '#4fc3f7' }}>Variables:</strong>{' '}
                {meta.rhetoric_vars.length} rhetoric, {meta.action_vars.length} action, {meta.media_vars.length} media
              </div>
            </div>

            {meta.warnings.length > 0 && (
              <div style={{ background: 'rgba(255,183,77,0.1)', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem' }}>
                <strong style={{ color: '#ffb74d' }}>Warnings:</strong>
                <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                  {meta.warnings.map((w, i) => <li key={i} style={{ color: '#ffb74d' }}>{w}</li>)}
                </ul>
              </div>
            )}

            <details>
              <summary style={{ cursor: 'pointer', color: '#4fc3f7' }}>
                Stationarity Tests (ADF)
              </summary>
              <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Variable</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>ADF Stat</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>p-value</th>
                    <th style={{ textAlign: 'center', padding: '4px 8px' }}>Stationary?</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(meta.stationarity).map(([v, res]) => (
                    <tr key={v} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '3px 8px' }}>{meta.variables[v] ?? v}</td>
                      <td style={{ textAlign: 'right', padding: '3px 8px' }}>
                        {res.statistic?.toFixed(2) ?? 'N/A'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '3px 8px' }}>
                        {res.pvalue?.toFixed(4) ?? 'N/A'}
                      </td>
                      <td style={{
                        textAlign: 'center', padding: '3px 8px',
                        color: res.stationary ? '#81c784' : '#ef5350',
                      }}>
                        {res.stationary === null ? 'N/A' : res.stationary ? 'Yes' : 'No (differenced)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>

            {granger && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', color: '#4fc3f7' }}>
                  Significant Granger Pairs (p {'<'} 0.05 at best lag)
                </summary>
                <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Cause</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Effect</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Best Lag</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>p-value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {granger
                      .filter(g => g.best_pvalue < 0.05)
                      .sort((a, b) => a.best_pvalue - b.best_pvalue)
                      .map((g, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '3px 8px' }}>{g.cause_label}</td>
                          <td style={{ padding: '3px 8px' }}>{g.effect_label}</td>
                          <td style={{ textAlign: 'right', padding: '3px 8px' }}>{g.best_lag}</td>
                          <td style={{
                            textAlign: 'right', padding: '3px 8px',
                            color: g.best_pvalue < 0.01 ? '#4fc3f7' : '#81c784',
                          }}>
                            {g.best_pvalue < 0.001 ? '<0.001' : g.best_pvalue.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #333',
  borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem',
};
