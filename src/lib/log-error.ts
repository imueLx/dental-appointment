/** Log Error with Node fetch `cause` (common on Vercel: ENOTFOUND, ECONNREFUSED). */
export function logErrorWithCause(label: string, err: unknown): void {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    console.error(label, {
      name: err.name,
      message: err.message,
      cause:
        cause instanceof Error
          ? { name: cause.name, message: cause.message, code: (cause as NodeJS.ErrnoException).code }
          : cause,
      stack: err.stack,
    });
    return;
  }
  console.error(label, err);
}
