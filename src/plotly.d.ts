// Relax Plotly types - the @types/react-plotly.js types are overly strict
// for many valid Plotly.js configurations
declare module 'react-plotly.js' {
  import { Component } from 'react';

  interface PlotParams {
    data: Array<Record<string, unknown>>;
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
    style?: React.CSSProperties;
    className?: string;
    onInitialized?: (figure: any, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: any, graphDiv: HTMLElement) => void;
    onPurge?: (figure: any, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    onSelected?: (event: any) => void;
    onClick?: (event: any) => void;
    onHover?: (event: any) => void;
    onUnhover?: (event: any) => void;
    useResizeHandler?: boolean;
    revision?: number;
  }

  export default class Plot extends Component<PlotParams> {}
}
