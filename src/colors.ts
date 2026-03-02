// Matplotlib tab20 palette — consistent categorical colors across all charts
export const TAB20: string[] = [
  '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c',
  '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5',
  '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
  '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5',
];

const colorMap = new Map<string, string>();

/**
 * Get a deterministic color for a categorical value.
 * Same value always returns same color within a session.
 * Falls back to index-based assignment from TAB20.
 */
export function getColor(value: string, index: number): string {
  if (colorMap.has(value)) return colorMap.get(value)!;
  const color = TAB20[index % TAB20.length];
  colorMap.set(value, color);
  return color;
}

// ── Ordinal sequential scales (low→high severity) ──────────────────
// 3-point: green → yellow → red
const SEQ3 = ['#2ca02c', '#bcbd22', '#d62728'];
// 4-point
const SEQ4 = ['#2ca02c', '#bcbd22', '#ff7f0e', '#d62728'];
// 5-point
const SEQ5 = ['#2ca02c', '#98df8a', '#bcbd22', '#ff7f0e', '#d62728'];
// 7-point
const SEQ7 = ['#2ca02c', '#98df8a', '#bcbd22', '#dbdb8d', '#ffbb78', '#ff7f0e', '#d62728'];

// ── RRLS VALUE COLORS ──────────────────────────────────────────────

export const RRLS_COLORS: Record<string, Record<string, string>> = {
  // Categorical dimensions — distinct tab20 colors
  theme: {
    'Military':                     '#1f77b4',
    'Diplomacy':                    '#ff7f0e',
    'Economy':                      '#2ca02c',
    'Legal':                        '#d62728',
    'Information/Media':            '#9467bd',
    'Domestic Politics':            '#8c564b',
    'Sports':                       '#e377c2',
    'Environment/Resources':        '#7f7f7f',
    'Public Health/Medical Research':'#bcbd22',
    'Infrastructure':               '#17becf',
    'Tech/Science':                 '#aec7e8',
  },
  audience: {
    'Adversaries':          '#d62728',
    'Foreign':              '#ff7f0e',
    'Government Officials': '#1f77b4',
    'Allies':               '#2ca02c',
  },
  level_of_escalation: {
    'Diplomatic to Military':   '#d62728',
    'Symbolic to Material':     '#ff7f0e',
    'Economic to Diplomatic':   '#bcbd22',
    'Defensive to Offensive':   '#9467bd',
    'Regional to Global':       '#1f77b4',
    'Covert to Overt':          '#17becf',
    'Individual to Collective': '#8c564b',
  },
  nature_of_threat: {
    'Military Action':      '#d62728',
    'Economic Sanctions':   '#ff7f0e',
    'Political Subversion': '#9467bd',
    'Cyber Warfare':        '#17becf',
  },
  underlying_values_or_interests: {
    'National Security':        '#d62728',
    'Diplomatic Relations':     '#1f77b4',
    'Territorial Integrity':    '#ff7f0e',
    'Economic Interests':       '#2ca02c',
    'Ideological Beliefs':      '#9467bd',
    'Human Rights':             '#e377c2',
    'Environmental Concerns':   '#17becf',
  },
  temporal_context: {
    'Immediate':          '#d62728',
    'Near Future':        '#ff7f0e',
    'Conditional Future': '#bcbd22',
    'Ongoing':            '#1f77b4',
    'Long-term Future':   '#2ca02c',
    'Past Statement':     '#7f7f7f',
  },
  reciprocity: {
    'Explicit':     '#d62728',
    'Tit-for-Tat':  '#ff7f0e',
    'Reciprocal':   '#bcbd22',
    'Conditional':  '#1f77b4',
    'Implicit':     '#9467bd',
    'One-sided':    '#7f7f7f',
  },
  geopolitical_area_of_concern: {
    'Eastern Europe':  '#1f77b4',
    'Global':          '#d62728',
    'Western Europe':  '#ff7f0e',
    'North America':   '#2ca02c',
    'Asia-Pacific':    '#9467bd',
    'Middle East':     '#8c564b',
    'Central Asia':    '#bcbd22',
    'Arctic':          '#17becf',
  },
  unilateral_vs_multilateral: {
    'Unilateral':   '#d62728',
    'Multilateral': '#1f77b4',
  },
  rhetorical_device: {
    'Literal':      '#1f77b4',
    'Hyperbolic':   '#d62728',
    'Metaphorical': '#9467bd',
  },

  // Ordinal intensity dimensions
  line_intensity: {
    'Low':      SEQ4[0],
    'Moderate':  SEQ4[1],
    'High':     SEQ4[2],
    'Very High': SEQ4[3],
  },
  threat_intensity: {
    'Low':      SEQ4[0],
    'Moderate':  SEQ4[1],
    'High':     SEQ4[2],
    'Very High': SEQ4[3],
  },
  overall_confidence: {
    '7': SEQ4[0],
    '8': SEQ4[1],
    '9': SEQ4[2],
    '10': SEQ4[3],
  },

  // Ordinal dimensions — sequential green→red
  line: {
    'Vague Line':    SEQ3[0],
    'Quasi-Line':    SEQ3[1],
    'Explicit Line': SEQ3[2],
  },
  threat: {
    'Vague Threat':    SEQ3[0],
    'Medium Threat':   SEQ3[1],
    'Explicit Threat': SEQ3[2],
  },
  specificity: {
    'Vague':      SEQ3[0],
    'In-between': SEQ3[1],
    'Specific':   SEQ3[2],
  },
  immediacy: {
    'Long-term':    SEQ3[0],
    'Conditional':  SEQ3[1],
    'Immediate':    SEQ3[2],
  },
  durability: {
    'One-time':    SEQ7[0],
    'Short-term':  SEQ7[1],
    'Revocable':   SEQ7[2],
    'Conditional': SEQ7[3],
    'Long-term':   SEQ7[4],
    'Indefinite':  SEQ7[5],
    'Irrevocable': SEQ7[6],
  },
};

// ── NTS VALUE COLORS ────────────────────────────────────────────────

export const NTS_COLORS: Record<string, Record<string, string>> = {
  // Categorical dimensions
  nts_statement_type: {
    'Nuclear Threat Statement':    '#d62728',
    'Nuclear Stability Statement': '#1f77b4',
  },
  nts_threat_type: {
    'Explicit Threat': '#d62728',
    'Overt Threat':    '#ff7f0e',
    'Veiled Threat':   '#bcbd22',
    'Implicit Threat': '#2ca02c',
  },
  capability: {
    'Strategic': '#d62728',
    'Tactical':  '#ff7f0e',
  },
  delivery_system: {
    'Missile':         '#d62728',
    'Aircraft':        '#ff7f0e',
    'Artillery Shell': '#bcbd22',
    'Other':           '#7f7f7f',
  },
  purpose: {
    'Deterrence': '#1f77b4',
    'Coercion':   '#ff7f0e',
    'Defense':     '#2ca02c',
  },
  context: {
    'Bilateral':         '#1f77b4',
    'Regional Conflict': '#ff7f0e',
    'Multilateral':      '#2ca02c',
    'Global':            '#d62728',
  },
  geographical_reach: {
    'Global':      '#d62728',
    'Regional':    '#ff7f0e',
    'Unspecified': '#7f7f7f',
  },
  timeline: {
    'Immediate':          '#d62728',
    'Future/Conditional': '#ff7f0e',
    'Long-term':          '#2ca02c',
  },
  audience: {
    'International':    '#1f77b4',
    'Global Community': '#d62728',
    'Specific Group':   '#ff7f0e',
    'Domestic':         '#2ca02c',
  },
  arms_control_and_testing: {
    'Withdrawal from Arms Control Agreements': '#d62728',
    'Conducting Nuclear Testing':              '#ff7f0e',
  },
  rhetorical_device: {
    'Literal':      '#1f77b4',
    'Hyperbolic':   '#d62728',
    'Metaphorical': '#9467bd',
  },

  // Ordinal dimensions — sequential scales (matching Level labels)
  tone: {
    'Firm (Level 2)':        SEQ4[0],
    'Aggressive (Level 3)':  SEQ4[1],
    'Belligerent (Level 4)': SEQ4[2],
    'Apocalyptic (Level 5)': SEQ4[3],
  },
  conditionality: {
    'Conditional (Level 1)':        SEQ4[0],
    'Situational (Level 2)':        SEQ4[1],
    'Implicit Condition (Level 3)': SEQ4[2],
    'Unconditional (Level 4)':      SEQ4[3],
  },
  consequences: {
    'Significant (Level 3)': SEQ3[0],
    'Severe (Level 4)':      SEQ3[1],
    'Catastrophic (Level 5)':SEQ3[2],
  },
  specificity: {
    'Vague (Level 1)':    SEQ5[0],
    'General (Level 2)':  SEQ5[1],
    'Specific (Level 3)': SEQ5[2],
    'Detailed (Level 4)': SEQ5[3],
    'Explicit (Level 5)': SEQ5[4],
  },
};

// ── RRLS ORDINAL SCORES (Likert scales) ─────────────────────────────

export const RRLS_ORDINAL_SCORES: Record<string, Record<string, number>> = {
  line: { 'Vague Line': 1, 'Quasi-Line': 2, 'Explicit Line': 3 },
  threat: { 'Vague Threat': 1, 'Medium Threat': 2, 'Explicit Threat': 3 },
  specificity: { 'Vague': 1, 'In-between': 2, 'Specific': 3 },
  immediacy: { 'Long-term': 1, 'Conditional': 2, 'Immediate': 3 },
  durability: {
    'One-time': 1, 'Short-term': 2, 'Revocable': 3,
    'Conditional': 4, 'Long-term': 5, 'Indefinite': 6, 'Irrevocable': 7,
  },
  line_intensity: { 'Low': 1, 'Moderate': 2, 'High': 3, 'Very High': 4 },
  threat_intensity: { 'Low': 1, 'Moderate': 2, 'High': 3, 'Very High': 4 },
};

export const RRLS_ORDINAL_DIMS = ['line', 'threat', 'specificity', 'immediacy', 'durability', 'line_intensity', 'threat_intensity'];

// ── NTS ORDINAL SCORES (corrected to match actual data labels) ──────

export const NTS_ORDINAL_SCORES: Record<string, Record<string, number>> = {
  tone: {
    'Firm (Level 2)': 2, 'Aggressive (Level 3)': 3,
    'Belligerent (Level 4)': 4, 'Apocalyptic (Level 5)': 5,
  },
  conditionality: {
    'Conditional (Level 1)': 1, 'Situational (Level 2)': 2,
    'Implicit Condition (Level 3)': 3, 'Unconditional (Level 4)': 4,
  },
  consequences: {
    'Significant (Level 3)': 3, 'Severe (Level 4)': 4, 'Catastrophic (Level 5)': 5,
  },
  specificity: {
    'Vague (Level 1)': 1, 'General (Level 2)': 2, 'Specific (Level 3)': 3,
    'Detailed (Level 4)': 4, 'Explicit (Level 5)': 5,
  },
};

export const NTS_ORDINAL_DIMS = ['tone', 'conditionality', 'consequences', 'specificity'];

// ── DIM COLORS (for severity line chart) ────────────────────────────

export const RRLS_DIM_COLORS: Record<string, string> = {
  line: '#1f77b4',
  threat: '#d62728',
  specificity: '#2ca02c',
  immediacy: '#ff7f0e',
  durability: '#9467bd',
  line_intensity: '#17becf',
  threat_intensity: '#e377c2',
};

export const NTS_DIM_COLORS: Record<string, string> = {
  tone: '#1f77b4',
  conditionality: '#ff7f0e',
  consequences: '#d62728',
  specificity: '#2ca02c',
};

// ── Helper: get color for a value within a dimension ────────────────

/** Get the fixed color for a specific value within a dimension.
 *  Falls back to TAB20 index if not defined. */
export function getDimValueColor(
  colorMap: Record<string, Record<string, string>>,
  dim: string,
  value: string,
  fallbackIndex: number,
): string {
  return colorMap[dim]?.[value] ?? TAB20[fallbackIndex % TAB20.length];
}
