/**
 * Terminal UI helpers — spinner, colors, table formatting
 */

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

export function success(msg: string) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
}

export function error(msg: string) {
  console.error(`${COLORS.red}✗${COLORS.reset} ${msg}`);
}

export function info(msg: string) {
  console.log(`${COLORS.cyan}ℹ${COLORS.reset} ${msg}`);
}

export function warn(msg: string) {
  console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`);
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function spinner(message: string) {
  let i = 0;
  let text = message;
  const interval = setInterval(() => {
    process.stderr.write(`\r${COLORS.cyan}${SPINNER_FRAMES[i % SPINNER_FRAMES.length]}${COLORS.reset} ${text}`);
    i++;
  }, 80);

  return {
    update(newText: string) {
      text = newText;
    },
    stop() {
      clearInterval(interval);
      process.stderr.write('\r\x1b[K');
    },
  };
}

export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length))
  );

  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const header = headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('│');
  const body = rows.map((r) =>
    r.map((c, i) => ` ${(c || '').padEnd(widths[i])} `).join('│')
  );

  return [header, sep, ...body].join('\n');
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
