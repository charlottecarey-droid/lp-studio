/**
 * Unit coverage for the shared in-process FIFO semaphore (June 2026 launch
 * hardening) — the primitive behind PRERENDER_CONCURRENCY,
 * FIRECRAWL_CONCURRENCY, GENERATE_OPENAI_CONCURRENCY, and the refactored
 * brand-import openai-semaphore.
 */
import { describe, it, expect } from "vitest";
import { makeSemaphore, envConcurrency } from "./semaphore";

/** A promise we can resolve from the outside. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Let queued microtasks / handoffs settle. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("makeSemaphore", () => {
  it("never exceeds max concurrency", async () => {
    const sem = makeSemaphore({ name: "t-concurrency", max: 2 });
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 6 }, () => deferred());

    const tasks = gates.map((gate) =>
      sem.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await gate.promise;
        running--;
      }),
    );

    await tick();
    expect(running).toBe(2);
    expect(sem.inFlight()).toBe(2);
    expect(sem.queueLength()).toBe(4);

    // Release everything in order; concurrency must never have exceeded 2.
    for (const gate of gates) {
      gate.resolve();
      await tick();
    }
    await Promise.all(tasks);
    expect(peak).toBe(2);
    expect(sem.inFlight()).toBe(0);
    expect(sem.queueLength()).toBe(0);
  });

  it("hands slots to waiters in FIFO order", async () => {
    const sem = makeSemaphore({ name: "t-fifo", max: 1 });
    const order: number[] = [];
    const first = deferred();

    const t1 = sem.run(async () => {
      await first.promise;
      order.push(1);
    });
    const t2 = sem.run(async () => {
      order.push(2);
    });
    const t3 = sem.run(async () => {
      order.push(3);
    });

    await tick();
    expect(order).toEqual([]); // 2 and 3 are queued behind 1
    first.resolve();
    await Promise.all([t1, t2, t3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("returns the wrapped fn's resolved value", async () => {
    const sem = makeSemaphore({ name: "t-value", max: 1 });
    await expect(sem.run(async () => 42)).resolves.toBe(42);
    // Sync (non-promise) fns are supported too.
    await expect(sem.run(() => "ok")).resolves.toBe("ok");
  });

  it("does not leak a slot when the wrapped fn throws", async () => {
    const sem = makeSemaphore({ name: "t-throw", max: 1 });

    await expect(
      sem.run(async () => {
        throw new Error("boom-async");
      }),
    ).rejects.toThrow("boom-async");
    await expect(
      sem.run(() => {
        throw new Error("boom-sync");
      }),
    ).rejects.toThrow("boom-sync");

    expect(sem.inFlight()).toBe(0);
    // The slot must be reusable after the failures.
    await expect(sem.run(async () => "alive")).resolves.toBe("alive");
  });

  it("releases the slot to the next waiter when a holder rejects", async () => {
    const sem = makeSemaphore({ name: "t-handoff-on-throw", max: 1 });
    const gate = deferred();

    const failing = sem.run(async () => {
      await gate.promise;
      throw new Error("holder failed");
    });
    const queued = sem.run(async () => "queued ran");

    await tick();
    expect(sem.queueLength()).toBe(1);
    gate.resolve();

    await expect(failing).rejects.toThrow("holder failed");
    await expect(queued).resolves.toBe("queued ran");
    expect(sem.inFlight()).toBe(0);
    expect(sem.queueLength()).toBe(0);
  });

  it("clamps max below 1 to 1 (never deadlocks)", async () => {
    const sem = makeSemaphore({ name: "t-clamp", max: 0 });
    await expect(sem.run(async () => "ran")).resolves.toBe("ran");
  });
});

describe("envConcurrency", () => {
  it("parses positive integers and falls back otherwise", () => {
    const key = "TEST_SEMAPHORE_ENV_CONCURRENCY";
    const prev = process.env[key];
    try {
      delete process.env[key];
      expect(envConcurrency(key, 2)).toBe(2);
      process.env[key] = "5";
      expect(envConcurrency(key, 2)).toBe(5);
      process.env[key] = "0"; // zero would deadlock a semaphore → fallback
      expect(envConcurrency(key, 2)).toBe(2);
      process.env[key] = "nope";
      expect(envConcurrency(key, 2)).toBe(2);
      process.env[key] = "3.9";
      expect(envConcurrency(key, 2)).toBe(3);
    } finally {
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });
});
