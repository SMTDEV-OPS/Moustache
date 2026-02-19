const timestamp = () => new Date().toISOString();

interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

function formatLog(level: string, msg: string, context?: LogContext, error?: Error): string {
  const parts: string[] = [`[${level}]`, timestamp()];
  
  if (context?.requestId) {
    parts.push(`[req:${context.requestId}]`);
  }
  
  if (context?.userId) {
    parts.push(`[user:${context.userId}]`);
  }
  
  if (context?.method && context?.path) {
    parts.push(`${context.method} ${context.path}`);
  }
  
  parts.push(msg);
  
  return parts.join(" ");
}

function formatMeta(context?: LogContext, error?: Error): unknown {
  const meta: Record<string, unknown> = {};
  
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      if (key !== "requestId" && key !== "userId" && key !== "method" && key !== "path") {
        meta[key] = value;
      }
    });
  }
  
  if (error) {
    const errorObj: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    
    // Include additional error properties if they exist
    if (error instanceof Error && "status" in error) {
      errorObj.status = (error as { status?: number }).status;
    }
    if (error instanceof Error && "code" in error) {
      errorObj.code = (error as { code?: string }).code;
    }
    
    meta.error = errorObj;
  }
  
  return Object.keys(meta).length > 0 ? meta : undefined;
}

export const logger = {
  info: (msg: string, context?: LogContext) => {
    const formatted = formatLog("INFO", msg, context);
    const meta = formatMeta(context);
    // eslint-disable-next-line no-console
    console.log(formatted, meta ?? "");
  },
  warn: (msg: string, context?: LogContext) => {
    const formatted = formatLog("WARN", msg, context);
    const meta = formatMeta(context);
    // eslint-disable-next-line no-console
    console.warn(formatted, meta ?? "");
  },
  error: (msg: string, context?: LogContext, error?: Error) => {
    const formatted = formatLog("ERROR", msg, context, error);
    const meta = formatMeta(context, error);
    // eslint-disable-next-line no-console
    console.error(formatted, meta ?? "");
  },
  debug: (msg: string, context?: LogContext) => {
    const formatted = formatLog("DEBUG", msg, context);
    const meta = formatMeta(context);
    // eslint-disable-next-line no-console
    console.debug(formatted, meta ?? "");
  },
};



