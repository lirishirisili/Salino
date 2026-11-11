/**
 * Hedged race over AI providers. Copied from Tohav (src/features/import/hedgedRace.ts)
 * so this worker stands alone; keep the two in step when fixing bugs.
 *
 * Candidates start in order. The next one starts as soon as a running one
 * fails, or when `hedgeDelayMs` passes without an answer — so a slow provider
 * costs at most the hedge delay, not its whole timeout. The first success wins
 * and every other attempt is aborted.
 */

export interface RaceCandidate<T> {
  label: string;
  timeoutMs: number;
  run: (signal: AbortSignal) => Promise<T>;
}

export interface RaceOptions {
  hedgeDelayMs: number;
  /** Hard cap for the whole race. */
  budgetMs: number;
  maxInFlight: number;
  signal?: AbortSignal;
}

export interface RaceWin<T> {
  value: T;
  label: string;
  elapsedMs: number;
  failures: string[];
}

export class RaceFailedError extends Error {
  constructor(
    readonly failures: string[],
    /** The errors thrown by candidates, for classifying why the race failed. */
    readonly causes: unknown[],
  ) {
    super(`All AI providers failed.\n${failures.slice(-4).join('\n')}`);
    this.name = 'RaceFailedError';
  }
}

export function createAbortError(): Error {
  const error = new Error('Cancelled');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function describe(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

export function hedgedRace<T>(
  candidates: readonly RaceCandidate<T>[],
  options: RaceOptions,
): Promise<RaceWin<T>> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const failures: string[] = [];
    const causes: unknown[] = [];
    const inFlight = new Map<AbortController, string>();
    let nextIndex = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
    // Workers' clearTimeout() rejects undefined.
    const stopHedgeTimer = () => {
      if (hedgeTimer !== undefined) clearTimeout(hedgeTimer);
    };

    const finish = (outcome: { win: RaceWin<T> } | { error: Error }) => {
      if (settled) return;
      settled = true;
      stopHedgeTimer();
      clearTimeout(budgetTimer);
      options.signal?.removeEventListener('abort', onAbort);
      for (const controller of inFlight.keys()) controller.abort();
      inFlight.clear();
      if ('win' in outcome) resolve(outcome.win);
      else reject(outcome.error);
    };

    const onAbort = () => finish({ error: createAbortError() });

    const budgetTimer = setTimeout(() => {
      const waiting = [...inFlight.values()];
      const message = `gave up after ${options.budgetMs / 1000}s`;
      failures.push(waiting.length ? `${message} (still waiting: ${waiting.join(', ')})` : message);
      causes.push(new Error(message));
      finish({ error: new RaceFailedError(failures, causes) });
    }, options.budgetMs);

    const launchNext = () => {
      stopHedgeTimer();
      if (settled) return;
      if (nextIndex >= candidates.length) {
        if (inFlight.size === 0) finish({ error: new RaceFailedError(failures, causes) });
        return;
      }
      // At capacity: the next failure launches a replacement.
      if (inFlight.size >= options.maxInFlight) return;

      const candidate = candidates[nextIndex++];
      const controller = new AbortController();
      inFlight.set(controller, candidate.label);
      let done = false;

      const fail = (reason: string, cause: unknown) => {
        if (done) return;
        done = true;
        clearTimeout(attemptTimer);
        inFlight.delete(controller);
        controller.abort();
        if (settled) return;
        failures.push(`${candidate.label}: ${reason}`);
        causes.push(cause);
        launchNext();
      };

      const attemptTimer = setTimeout(() => {
        const message = `timed out after ${candidate.timeoutMs / 1000}s`;
        fail(message, new Error(message));
      }, candidate.timeoutMs);

      // The executor turns a synchronous throw from run() into a rejection.
      new Promise<T>((resolveRun) => resolveRun(candidate.run(controller.signal))).then(
        (value) => {
          if (done) return;
          done = true;
          clearTimeout(attemptTimer);
          inFlight.delete(controller);
          finish({
            win: { value, label: candidate.label, elapsedMs: Date.now() - startedAt, failures },
          });
        },
        (error: unknown) => fail(describe(error), error),
      );

      hedgeTimer = setTimeout(launchNext, options.hedgeDelayMs);
    };

    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    options.signal?.addEventListener('abort', onAbort);
    launchNext();
  });
}
