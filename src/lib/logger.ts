const COLORS = {
  AUTH: '#22c55e',    // green
  API: '#3b82f6',     // blue
  RLS: '#f59e0b',     // amber
  ERROR: '#ef4444',   // red
  NAV: '#a855f7',     // purple
  INFO: '#06b6d4',    // cyan
} as const;

type Category = keyof typeof COLORS;

function log(category: Category, message: string, data?: unknown) {
  const color = COLORS[category];
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `%c[${category}]%c ${timestamp} — ${message}`,
    `color: ${color}; font-weight: bold`,
    'color: inherit',
  );
  if (data !== undefined) {
    console.log('  └─', data);
  }
}

export const logger = {
  auth: (msg: string, data?: unknown) => log('AUTH', msg, data),
  api: (msg: string, data?: unknown) => log('API', msg, data),
  rls: (msg: string, data?: unknown) => log('RLS', msg, data),
  error: (msg: string, data?: unknown) => log('ERROR', msg, data),
  nav: (msg: string, data?: unknown) => log('NAV', msg, data),
  info: (msg: string, data?: unknown) => log('INFO', msg, data),
};
