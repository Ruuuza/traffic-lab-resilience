export type ScenarioKey = "steady" | "flash" | "retry" | "ddos";
export type RateStrategy = "token" | "sliding" | "fixed" | "leaky";
export type BalanceStrategy = "least" | "round" | "weighted" | "hash";

export type Controls = {
  targetRps: number;
  burst: number;
  workers: number;
  workerCapacity: number;
  globalLimit: number;
  queueCapacity: number;
  retries: number;
  rateStrategy: RateStrategy;
  balanceStrategy: BalanceStrategy;
  backpressure: boolean;
  circuitBreaker: boolean;
  autoscale: boolean;
  adaptiveLimit: boolean;
};

export type SimulationMetrics = {
  requested: number;
  processed: number;
  blocked: number;
  queue: number;
  queueRatio: number;
  utilization: number;
  latency: number;
  errorRate: number;
  availability: number;
  scaledWorkers: number;
  status: "healthy" | "degraded" | "critical";
};

export const scenarios: Record<ScenarioKey, { name: string; tag: string; detail: string; load: number; jitter: number }> = {
  steady: { name: "Carga constante", tag: "BASELINE", detail: "Tráfego previsível com baixa variância.", load: 1, jitter: 0.04 },
  flash: { name: "Flash sale", tag: "BURST", detail: "Pico abrupto de clientes legítimos.", load: 1.75, jitter: 0.28 },
  retry: { name: "Retry storm", tag: "CASCADE", detail: "Timeouts disparam retentativas em cadeia.", load: 1.35, jitter: 0.18 },
  ddos: { name: "DDoS L7", tag: "HOSTILE", detail: "Grande volume distribuído e malicioso.", load: 2.6, jitter: 0.35 },
};

export const initialControls: Controls = {
  targetRps: 42000,
  burst: 35,
  workers: 24,
  workerCapacity: 1850,
  globalLimit: 48000,
  queueCapacity: 12000,
  retries: 2,
  rateStrategy: "token",
  balanceStrategy: "least",
  backpressure: true,
  circuitBreaker: true,
  autoscale: true,
  adaptiveLimit: true,
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calculateMetrics(controls: Controls, scenario: ScenarioKey, tick: number): SimulationMetrics {
  const profile = scenarios[scenario];
  const wave = 1 + Math.sin(tick * 0.74) * profile.jitter + Math.sin(tick * 0.21) * profile.jitter * 0.45;
  const retryAmplification = scenario === "retry" ? 1 + controls.retries * 0.22 : 1;
  const requested = Math.round(controls.targetRps * profile.load * wave * retryAmplification);
  const strategyBurst = { token: 1 + controls.burst / 100, sliding: 1.02, fixed: tick % 8 < 2 ? 1.18 : 1, leaky: 0.94 }[controls.rateStrategy];
  const adaptiveFactor = controls.adaptiveLimit ? 0.96 + Math.sin(tick * 0.17) * 0.04 : 1;
  const rateCeiling = controls.globalLimit * strategyBurst * adaptiveFactor;
  const maliciousShare = scenario === "ddos" ? 0.62 : 0;
  const blockedByPolicy = Math.max(0, requested - rateCeiling) + requested * maliciousShare * (controls.adaptiveLimit ? 0.72 : 0.42);
  const admitted = Math.max(0, requested - blockedByPolicy);
  const balanceEfficiency = { least: 1, round: 0.94, weighted: 0.97, hash: 0.91 }[controls.balanceStrategy];
  const scaledWorkers = controls.autoscale && admitted > controls.workers * controls.workerCapacity * 0.82
    ? Math.min(64, controls.workers + Math.ceil((admitted / controls.workerCapacity - controls.workers) * 0.58))
    : controls.workers;
  const serviceCapacity = scaledWorkers * controls.workerCapacity * balanceEfficiency;
  const rawOverflow = Math.max(0, admitted - serviceCapacity);
  const queue = Math.min(controls.queueCapacity, rawOverflow * (1.4 + controls.retries * 0.18));
  const queueRatio = queue / controls.queueCapacity;
  const backpressureShed = controls.backpressure && queueRatio > 0.58 ? admitted * (queueRatio - 0.5) * 0.44 : 0;
  const circuitShed = controls.circuitBreaker && queueRatio > 0.82 ? admitted * 0.16 : 0;
  const processed = Math.min(serviceCapacity, Math.max(0, admitted - backpressureShed - circuitShed));
  const dropped = Math.max(0, admitted - processed - Math.min(queue, rawOverflow));
  const utilization = clamp(processed / serviceCapacity, 0, 1.35);
  const latency = Math.round(24 + Math.pow(utilization, 4) * 185 + queueRatio * 620 + (scenario === "retry" ? 55 : 0));
  const errorRate = clamp(((dropped + circuitShed) / Math.max(1, requested)) * 100 + Math.max(0, utilization - 0.95) * 18, 0.02, 99);
  const blocked = Math.round(blockedByPolicy + backpressureShed + circuitShed);
  const status = errorRate > 8 || latency > 900 ? "critical" : errorRate > 1.5 || latency > 350 || queueRatio > 0.65 ? "degraded" : "healthy";

  return {
    requested,
    processed: Math.round(processed),
    blocked,
    queue: Math.round(queue),
    queueRatio,
    utilization,
    latency,
    errorRate,
    availability: 100 - errorRate,
    scaledWorkers,
    status,
  };
}
