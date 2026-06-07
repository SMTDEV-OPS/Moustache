export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return true;

  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;

  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return extra.includes(origin);
}

export const corsOriginCallback = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
};
