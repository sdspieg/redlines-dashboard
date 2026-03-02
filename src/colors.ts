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
