import { type Theme } from './types';

export const DARK_THEME: Theme = {
  background: '#0d1117',
  nodeColors: [
    '#58a6ff',
    '#3fb950',
    '#f78166',
    '#d2a8ff',
    '#ffa657',
    '#79c0ff',
    '#56d364',
    '#ff7b72',
  ],
  nodeRadius: 8,
  edgeWidth: 2,
  mergeNodeColor: '#e3b341',
  textColor: '#e6edf3',
  labelFontSize: 11,
  shaFontSize: 10,
  fontFamily: 'monospace',
};

export const LIGHT_THEME: Theme = {
  background: '#ffffff',
  nodeColors: ['#0969da', '#1a7f37', '#cf222e', '#8250df', '#d1242f', '#0550ae'],
  nodeRadius: 8,
  edgeWidth: 2,
  mergeNodeColor: '#9a6700',
  textColor: '#1f2328',
  labelFontSize: 11,
  shaFontSize: 10,
  fontFamily: 'monospace',
};
