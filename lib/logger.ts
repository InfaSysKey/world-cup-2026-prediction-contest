// Logger estructurado mínimo. Emite una línea JSON por evento. Es el único
// lugar permitido para escribir a stdout/stderr (CLAUDE.md §4.3: nada de
// console.log en código mergeado).

type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

// Los Error no se serializan bien con JSON.stringify; los normalizamos a un
// objeto plano con name/message/stack. Incluimos `cause` para no perder el
// error raíz cuando un wrapper (p. ej. Drizzle) envuelve al driver.
function normalize(value: unknown): unknown {
  if (value instanceof Error) {
    const out: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    if (value.cause !== undefined) out.cause = normalize(value.cause);
    return out;
  }
  return value;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry: Record<string, unknown> = {
    level,
    message,
    time: new Date().toISOString(),
  };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      entry[key] = normalize(value);
    }
  }
  const line = `${JSON.stringify(entry)}\n`;
  if (level === 'error') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
