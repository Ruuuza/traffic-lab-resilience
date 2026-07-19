import assert from "node:assert/strict";
import test from "node:test";
import { calculateMetrics, initialControls } from "../app/simulation.ts";

test("produces deterministic metrics for the same inputs", () => {
  const first = calculateMetrics(initialControls, "flash", 8);
  const second = calculateMetrics(initialControls, "flash", 8);
  assert.deepEqual(first, second);
});

test("blocks hostile traffic and keeps metrics within published bounds", () => {
  const metrics = calculateMetrics(initialControls, "ddos", 8);
  assert.ok(metrics.blocked > 0);
  assert.ok(metrics.processed <= metrics.requested);
  assert.ok(metrics.availability >= 1 && metrics.availability <= 99.98);
  assert.ok(["healthy", "degraded", "critical"].includes(metrics.status));
});

test("autoscaling never exceeds the simulator limit", () => {
  const metrics = calculateMetrics({ ...initialControls, targetRps: 120000 }, "flash", 12);
  assert.ok(metrics.scaledWorkers >= initialControls.workers);
  assert.ok(metrics.scaledWorkers <= 64);
});
