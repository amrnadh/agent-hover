export async function register() {
  // Agent Hover: starts with `next dev` (nothing in production builds or the Edge runtime).
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
    await (await import('@agent-hover/next/register')).register();
  }
}
