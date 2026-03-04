/** Convert hex color (#RRGGBB) to space-separated RGB string for Tailwind */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '96 165 250'; // fallback
  return `${r} ${g} ${b}`;
}

export const DEFAULT_COLORS = {
  primary: '#60A5FA',
  accent: '#3B82F6',
  background: '#0F172A',
} as const;

export const DEFAULT_RGB = {
  primary: '96 165 250',
  accent: '59 130 246',
  background: '15 23 42',
} as const;
