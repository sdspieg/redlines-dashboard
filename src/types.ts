export interface OverviewStats {
  total_docs: number;
  total_chunks: number;
  fpa_rows: number;
  fpa_chunks: number;
  fpa_rls_relevant: number;
  fpa_nts_relevant: number;
  rls2_total: number;
  rls2_confirmed: number;
  nts2_total: number;
  nts2_confirmed: number;
  rls3_total: number;
  rls3_confirmed: number;
  crls_count: number;
  total_sources: number;
  date_min: string;
  date_max: string;
}

export interface SourceRow {
  source: string;
  db: string;
  count?: number;
  confirmed?: number;
  total_chunks?: number;
  total_docs?: number;
  crls?: number;
  date_min?: string;
  date_max?: string;
}

export interface MonthlyRow {
  month: string;
  source?: string;
  count: number;
}

export interface TaxonomyRow {
  value: string;
  count: number;
  source?: string;
}

export interface CrossTabRow {
  dim1: string;
  dim2: string;
  count: number;
}

export interface NTSSeverityRow {
  month: string;
  tone: string;
  conditionality: string;
  consequences: string;
  specificity: string;
  count: number;
}

export interface RRLSStatement {
  chunk_id: number;
  date: string;
  source: string;
  db: string;
  context_text_span: string;
  speaker: string;
  target: string;
  line_text_span: string;
  threat_text_span: string;
  line_type: string;
  threat_type: string;
  line_intensity: number;
  threat_intensity: number;
  theme: string;
  audience: string;
  nature_of_threat: string;
  level_of_escalation: string;
  geopolitical_area_of_concern: string;
  immediacy: string;
  durability: string;
  reciprocity: string;
  specificity: string;
  temporal_context: string;
  underlying_values_or_interests: string;
  unilateral_vs_multilateral: string;
  rhetorical_device: string;
  overall_confidence: number;
}

export interface NTSStatement {
  chunk_id: number;
  date: string;
  source: string;
  db: string;
  context_text_span: string;
  speaker: string;
  target: string;
  threat_text_span: string;
  nts_statement_type: string;
  nts_threat_type: string;
  capability: string;
  delivery_system: string;
  conditionality: string;
  purpose: string;
  tone: string;
  context: string;
  geographical_reach: string;
  consequences: string;
  timeline: string;
  audience: string;
  specificity: string;
  rhetorical_device: string;
  arms_control_and_testing: string;
  overall_confidence: number;
}

export interface WarContextRow {
  month: string;
  personnel_losses?: number;
  events?: number;
  fatalities?: number;
}

export interface IntensityRow {
  line_intensity: number;
  threat_intensity: number;
  confidence_bin: number;
  count: number;
}

export interface ComparativeRow {
  db: string;
  total_chunks: number;
  rrls: number;
  nts: number;
}

export type TabId = 'overview' | 'rrls' | 'nts' | 'crls' | 'timeseries' | 'statements' | 'analytics';

// ── Causal Analytics types ─────────────────────────────────────────────────

export interface CrossCorrPair {
  rhetoric_var: string;
  action_var: string;
  rhetoric_label: string;
  action_label: string;
  correlations: { lag: number; r: number }[];
  ci_bound: number;
}

export interface GrangerResult {
  cause: string;
  effect: string;
  cause_label: string;
  effect_label: string;
  lags: Record<string, { f_pvalue: number; chi2_pvalue: number }>;
  best_lag: number;
  best_pvalue: number;
}

export interface IRFData {
  impulse: string;
  response: string;
  impulse_label: string;
  response_label: string;
  horizons: number[];
  point: number[];
  ci_lower: number[] | null;
  ci_upper: number[] | null;
  cumulative: number[];
  cum_ci_lower: number[] | null;
  cum_ci_upper: number[] | null;
}

export interface VARModel {
  name: string;
  variables: string[];
  variable_labels: Record<string, string>;
  optimal_lag: number;
  aic: number | null;
  irfs: Record<string, IRFData>;
}

export interface LPResult {
  impulse: string;
  response: string;
  impulse_label: string;
  response_label: string;
  horizons: number[];
  point: number[];
  ci_lower: number[];
  ci_upper: number[];
}

export interface EventStudyResponse {
  variable: string;
  label: string;
  window: number[];
  mean_abnormal: number[];
  se: number[];
  cumulative: number[];
}

export interface EventStudy {
  spike_variable: string;
  spike_label: string;
  threshold: number;
  n_spikes: number;
  spike_weeks: string[];
  responses: Record<string, EventStudyResponse>;
}

export interface AnalyticsMetadata {
  n_weeks: number;
  date_min: string;
  date_max: string;
  variables: Record<string, string>;
  rhetoric_vars: string[];
  action_vars: string[];
  media_vars: string[];
  stationarity: Record<string, { statistic: number | null; pvalue: number | null; stationary: boolean | null }>;
  var_models: string[];
  lp_pairs: [string, string][];
  warnings: string[];
}
