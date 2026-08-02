import postgres from "postgres";

export type ProbeState = { counter: number; version: bigint };

export function normalizeProbeVersion(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error("Probe version must be a non-negative PostgreSQL integer.");
}

export const SERIALIZABLE_MODE = "isolation level serializable";

export function nextProbeState(current: ProbeState): ProbeState {
  return { counter: current.counter + 1, version: current.version + 1n };
}

export type ConcurrencyProbeResult = ProbeState & {
  attempts: number[];
  connectionPids: number[];
};

function createBarrier(participants: number, timeoutMs = 5_000) {
  let arrived = 0;
  let release = () => {};
  let rejectGate = (_error: Error) => {};
  const gate = new Promise<void>((resolve, reject) => {
    release = resolve;
    rejectGate = reject;
  });
  const timeout = setTimeout(() => {
    rejectGate(new Error(`Concurrency barrier timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  return async () => {
    arrived += 1;
    if (arrived === participants) {
      clearTimeout(timeout);
      release();
    }
    await gate;
  };
}

function isSerializationFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "40001";
}

async function incrementWithRetry(
  sql: postgres.Sql<Record<string, never>>,
  barrier: () => Promise<void>,
): Promise<number> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await sql.begin(SERIALIZABLE_MODE, async (transaction) => {
        const rows = await transaction`select counter, version from public.p1_framework_probe where probe_key = 'p1-01'`;
        if (attempt === 1) await barrier();

        const currentRow = rows[0] as { counter: number; version: unknown } | undefined;
        if (!currentRow) throw new Error("P1 framework probe seed is missing.");

        const current: ProbeState = {
          counter: currentRow.counter,
          version: normalizeProbeVersion(currentRow.version),
        };

        const next = nextProbeState(current);
        await transaction`
          update public.p1_framework_probe
          set counter = ${next.counter}, version = ${next.version.toString()}::bigint
          where probe_key = 'p1-01'
        `;
      });

      return attempt;
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 3) throw error;
    }
  }

  throw new Error("Unreachable retry state.");
}

export async function runConcurrencyProbe(databaseUrl: string): Promise<ConcurrencyProbeResult> {
  const left = postgres(databaseUrl, { max: 1 });
  const right = postgres(databaseUrl, { max: 1 });

  try {
    const leftPidRows = await left`select pg_backend_pid() as pid`;
    const rightPidRows = await right`select pg_backend_pid() as pid`;
    const connectionPids = [Number(leftPidRows[0]?.pid), Number(rightPidRows[0]?.pid)];

    if (new Set(connectionPids).size !== 2) {
      throw new Error("Concurrency harness requires two independent PostgreSQL connections.");
    }

    await left`
      update public.p1_framework_probe
      set counter = 0, version = 0
      where probe_key = 'p1-01'
    `;

    const barrier = createBarrier(2);
    const attempts = await Promise.all([
      incrementWithRetry(left, barrier),
      incrementWithRetry(right, barrier),
    ]);
    const finalRows = await left`select counter, version from public.p1_framework_probe where probe_key = 'p1-01'`;
    const finalRow = finalRows[0] as { counter: number; version: unknown } | undefined;

    if (!finalRow) throw new Error("P1 framework probe read-back is missing.");

    const finalState: ProbeState = {
      counter: finalRow.counter,
      version: normalizeProbeVersion(finalRow.version),
    };

    return { ...finalState, attempts, connectionPids };
  } finally {
    await Promise.all([left.end({ timeout: 1 }), right.end({ timeout: 1 })]);
  }
}
