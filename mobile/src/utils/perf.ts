/**
 * Lightweight cold-start / item-loading instrumentation.
 *
 * Records named marks (cheap `Date.now()` captures) so we can measure the
 * cold-start pipeline: process start → cache opened → first cached items
 * committed → first list paint → first remote snapshot → reconcile done.
 *
 * Logging is gated behind {@link PERF_LOGGING_ENABLED} so it adds no console
 * overhead in normal production builds. To capture a release baseline, flip the
 * flag to `true` for a one-off measurement build.
 */

const PERF_LOGGING_ENABLED = __DEV__;

export type PerfMarkName =
  | 'process_start'
  | 'auth_restored'
  | 'cache_read_start'
  | 'cache_read_done'
  | 'cache_committed'
  | 'first_list_paint'
  | 'first_remote_snapshot'
  | 'reconcile_done';

const marks = new Map<PerfMarkName, number>();

/** Records a mark at the current time (first write wins for one-shot events). */
export function perfMark(name: PerfMarkName, { overwrite = false }: { overwrite?: boolean } = {}): void {
  if (!overwrite && marks.has(name)) return;
  const now = Date.now();
  marks.set(name, now);
  if (PERF_LOGGING_ENABLED) {
    const start = marks.get('process_start');
    const sinceStart = start != null ? `+${now - start}ms` : '';
    // eslint-disable-next-line no-console
    console.log(`[perf] ${name} ${sinceStart}`);
  }
}

/** Milliseconds between two marks, or null if either is missing. */
export function perfDuration(from: PerfMarkName, to: PerfMarkName): number | null {
  const a = marks.get(from);
  const b = marks.get(to);
  return a != null && b != null ? b - a : null;
}

/** Returns a snapshot of all recorded marks (for tests / diagnostics). */
export function perfSnapshot(): Record<string, number> {
  return Object.fromEntries(marks);
}

export function perfReset(): void {
  marks.clear();
}
