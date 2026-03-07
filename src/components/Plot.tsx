import OrigPlot from 'react-plotly.js';
import type { ComponentProps } from 'react';

/**
 * Thin wrapper around react-plotly.js Plot that sets legend defaults:
 * - Single click: isolate trace (toggleothers)
 * - Double click: toggle trace visibility
 */
export default function Plot(props: ComponentProps<typeof OrigPlot>) {
  const layout = {
    ...props.layout,
    legend: {
      ...(props.layout as Record<string, unknown>)?.legend as Record<string, unknown>,
      itemclick: 'toggleothers' as const,
      itemdoubleclick: 'toggle' as const,
    },
  };
  return <OrigPlot {...props} layout={layout} />;
}
