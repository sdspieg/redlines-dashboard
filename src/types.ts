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

export type TabId = 'overview' | 'rrls' | 'nts' | 'crls' | 'timeseries' | 'statements';
