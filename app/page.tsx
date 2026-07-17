"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Locale = "pt" | "en";
type Localized = { pt: string; en: string };
type ScenarioKey = "steady" | "flash" | "retry" | "ddos";
type RateStrategy = "token" | "sliding" | "fixed" | "leaky";
type BalanceStrategy = "least" | "round" | "weighted" | "hash";
type LogLevel = "info" | "ok" | "warn" | "critical";
type LogCode = "flash_loaded" | "workers_healthy" | "token_burst" | "recovered" | "saturation" | "budget_risk" | "scenario_started";
type LogEntry = { time: string; level: LogLevel; code: LogCode; scenario?: ScenarioKey };

type Controls = {
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

const ui = {
  pt: {
    home: "Traffic Lab — início", nav: "Navegação principal", simulator: "Simulador", architecture: "Arquitetura", playbook: "Playbook", language: "Selecionar idioma",
    heroTitle: "Projete para o pico.", heroAccent: "Sobreviva ao caos.", heroBody: "Um laboratório interativo para explorar como sistemas distribuídos absorvem milhões de requisições sem bloquear usuários legítimos — nem derrubar a própria infraestrutura.",
    openSimulator: "ABRIR SIMULADOR", explore: "EXPLORAR ESTRATÉGIAS", liveTelemetry: "Telemetria ao vivo", throughput: "THROUGHPUT", latency: "LATÊNCIA P99", availability: "DISPONIBILIDADE", activeNodes: "NÓS ATIVOS",
    trafficSimulator: "SIMULADOR DE TRÁFEGO", submitArchitecture: "Submeta a arquitetura", toRealWorld: "ao mundo real.", simulatorBody: "Ajuste a carga e as defesas. O modelo recalcula amplificação, saturação, filas, shedding e latência a cada ciclo.",
    scenarios: "Cenários de tráfego", configuration: "CONFIGURAÇÃO", reset: "RESETAR", incomingLoad: "Carga de entrada", burstTolerance: "Tolerância a burst", rateLimit: "Rate limit", loadBalancer: "Load balancer", globalLimit: "Limite global", workers: "Workers", retries: "Retentativas",
    backpressureBody: "Propaga saturação para a borda", breakerBody: "Isola dependências instáveis", autoscaleBody: "Escala por fila e utilização", adaptiveBody: "Ajusta concorrência pela latência",
    pause: "PAUSAR SIMULAÇÃO", start: "INICIAR SIMULAÇÃO", systemStatus: "STATUS DO SISTEMA", resilient: "RESILIENTE", degraded: "DEGRADADO", critical: "CRÍTICO",
    incoming: "ENTRADA", processed: "PROCESSADAS", blocked: "BLOQUEADAS / SHED", errorRate: "TAXA DE ERRO", received: "recebidas", blockedWord: "bloqueadas", zones: "zonas · health checks", utilization: "utilização", occupied: "ocupada", activeInstances: "instâncias ativas", useful: "RPS útil",
    healthy: "SAUDÁVEL", saturationHistory: "SATURAÇÃO / ÚLTIMOS 25s", threshold: "LIMIAR DE SATURAÇÃO", incidentStream: "FLUXO DE INCIDENTES",
    defense: "DEFESA EM PROFUNDIDADE", noSilverBullet: "Não existe bala de prata.", composition: "Existe composição.", defenseBody: "Resiliência emerge de camadas independentes. Cada mecanismo protege uma restrição diferente e falha de um jeito diferente.",
    failureModel: "MODELO DE FALHAS / LEIA O SISTEMA", whatBreaks: "O que quebra primeiro?", signal: "SINAL", probableCause: "CAUSA PROVÁVEL", response: "RESPOSTA", tradeoff: "TRADE-OFF",
    footer: "Um laboratório de engenharia de resiliência.", footerAccent: "Construa sistemas que falham com elegância.", newExperiment: "EXECUTAR NOVO EXPERIMENTO",
  },
  en: {
    home: "Traffic Lab — home", nav: "Main navigation", simulator: "Simulator", architecture: "Architecture", playbook: "Playbook", language: "Select language",
    heroTitle: "Design for the peak.", heroAccent: "Survive the chaos.", heroBody: "An interactive lab for exploring how distributed systems absorb millions of requests without blocking legitimate users — or taking down their own infrastructure.",
    openSimulator: "OPEN SIMULATOR", explore: "EXPLORE STRATEGIES", liveTelemetry: "Live telemetry", throughput: "THROUGHPUT", latency: "P99 LATENCY", availability: "AVAILABILITY", activeNodes: "ACTIVE NODES",
    trafficSimulator: "TRAFFIC SIMULATOR", submitArchitecture: "Put your architecture", toRealWorld: "against the real world.", simulatorBody: "Tune load and defenses. The model recalculates amplification, saturation, queues, shedding, and latency on every cycle.",
    scenarios: "Traffic scenarios", configuration: "CONFIGURATION", reset: "RESET", incomingLoad: "Incoming load", burstTolerance: "Burst tolerance", rateLimit: "Rate limit", loadBalancer: "Load balancer", globalLimit: "Global limit", workers: "Workers", retries: "Retries",
    backpressureBody: "Propagates saturation to the edge", breakerBody: "Isolates unstable dependencies", autoscaleBody: "Scales from queue depth and utilization", adaptiveBody: "Tunes concurrency from latency",
    pause: "PAUSE SIMULATION", start: "START SIMULATION", systemStatus: "SYSTEM STATUS", resilient: "RESILIENT", degraded: "DEGRADED", critical: "CRITICAL",
    incoming: "INCOMING", processed: "PROCESSED", blocked: "BLOCKED / SHED", errorRate: "ERROR RATE", received: "received", blockedWord: "blocked", zones: "zones · health checks", utilization: "utilization", occupied: "occupied", activeInstances: "active instances", useful: "useful RPS",
    healthy: "HEALTHY", saturationHistory: "SATURATION / LAST 25s", threshold: "SATURATION THRESHOLD", incidentStream: "INCIDENT STREAM",
    defense: "DEFENSE IN DEPTH", noSilverBullet: "There is no silver bullet.", composition: "There is composition.", defenseBody: "Resilience emerges from independent layers. Each mechanism protects a different constraint and fails in a different way.",
    failureModel: "FAILURE MODEL / READ THE SYSTEM", whatBreaks: "What breaks first?", signal: "SIGNAL", probableCause: "LIKELY CAUSE", response: "RESPONSE", tradeoff: "TRADE-OFF",
    footer: "A resilience engineering laboratory.", footerAccent: "Build systems that fail gracefully.", newExperiment: "RUN NEW EXPERIMENT",
  },
} as const;

const scenarios: Record<ScenarioKey, { name: Localized; tag: string; detail: Localized; load: number; jitter: number }> = {
  steady: { name: { pt: "Carga constante", en: "Steady load" }, tag: "BASELINE", detail: { pt: "Tráfego previsível com baixa variância.", en: "Predictable traffic with low variance." }, load: 1, jitter: 0.04 },
  flash: { name: { pt: "Flash sale", en: "Flash sale" }, tag: "BURST", detail: { pt: "Pico abrupto de clientes legítimos.", en: "A sudden spike of legitimate customers." }, load: 1.75, jitter: 0.28 },
  retry: { name: { pt: "Retry storm", en: "Retry storm" }, tag: "CASCADE", detail: { pt: "Timeouts disparam retentativas em cadeia.", en: "Timeouts trigger cascading retries." }, load: 1.35, jitter: 0.18 },
  ddos: { name: { pt: "DDoS L7", en: "L7 DDoS" }, tag: "HOSTILE", detail: { pt: "Grande volume distribuído e malicioso.", en: "Large, distributed, malicious volume." }, load: 2.6, jitter: 0.35 },
};

const strategies = [
  {
    category: "01 / ADMISSION", title: "Rate limiting",
    body: { pt: "Token bucket tolera bursts; sliding window entrega precisão; leaky bucket suaviza o fluxo; limites adaptativos reagem à latência.", en: "Token bucket tolerates bursts; sliding window delivers precision; leaky bucket smooths flow; adaptive limits respond to latency." },
    bullets: [
      { pt: "Chave por IP, usuário, token ou rota", en: "Key by IP, user, token, or route" },
      { pt: "Limites locais + contador distribuído", en: "Local limits + distributed counter" },
      { pt: "Headers 429 e Retry-After com jitter", en: "429 and Retry-After headers with jitter" },
    ],
    result: { pt: "PROTEGE CAPACIDADE", en: "PROTECTS CAPACITY" },
  },
  {
    category: "02 / DISTRIBUTION", title: "Load balancing",
    body: { pt: "Round robin é simples; least-connections reage à duração; pesos drenam nós; consistent hash preserva afinidade e cache.", en: "Round robin is simple; least-connections responds to duration; weights drain nodes; consistent hashing preserves affinity and cache." },
    bullets: [
      { pt: "Health checks ativos e passivos", en: "Active and passive health checks" },
      { pt: "Connection draining em deploys", en: "Connection draining during deploys" },
      { pt: "Balanceamento multi-região", en: "Multi-region balancing" },
    ],
    result: { pt: "DISTRIBUI TRABALHO", en: "DISTRIBUTES WORK" },
  },
  {
    category: "03 / FLOW CONTROL", title: "Backpressure",
    body: { pt: "Quando o consumidor satura, o produtor precisa desacelerar. Buffers infinitos apenas transformam carga em latência e memória.", en: "When consumers saturate, producers must slow down. Infinite buffers only turn load into latency and memory pressure." },
    bullets: [
      { pt: "Filas limitadas e concorrência finita", en: "Bounded queues and concurrency" },
      { pt: "Load shedding por prioridade", en: "Priority-based load shedding" },
      { pt: "Créditos, pull e streaming", en: "Credits, pull, and streaming" },
    ],
    result: { pt: "LIMITA FILAS", en: "BOUNDS QUEUES" },
  },
  {
    category: "04 / ISOLATION", title: "Circuit breaker",
    body: { pt: "Closed, open e half-open impedem que uma dependência lenta consuma todas as threads, conexões e budgets de timeout.", en: "Closed, open, and half-open states stop a slow dependency from consuming every thread, connection, and timeout budget." },
    bullets: [
      { pt: "Bulkheads por dependência", en: "Bulkheads per dependency" },
      { pt: "Timeouts menores que o deadline", en: "Timeouts shorter than the deadline" },
      { pt: "Fallback e degradação graciosa", en: "Fallback and graceful degradation" },
    ],
    result: { pt: "INTERROMPE CASCATAS", en: "STOPS CASCADES" },
  },
  {
    category: "05 / ASYNC", title: "Queues & workers",
    body: { pt: "Filas desacoplam picos da capacidade de processamento, mas exigem idempotência, visibilidade e uma política explícita para poison pills.", en: "Queues decouple spikes from processing capacity, but require idempotency, visibility, and an explicit poison-pill policy." },
    bullets: [
      { pt: "Dead-letter queue e redrive", en: "Dead-letter queue and redrive" },
      { pt: "Deduplicação e idempotency keys", en: "Deduplication and idempotency keys" },
      { pt: "Particionamento por chave de ordem", en: "Partitioning by ordering key" },
    ],
    result: { pt: "ABSORVE BURSTS", en: "ABSORBS BURSTS" },
  },
  {
    category: "06 / CONTROL LOOP", title: { pt: "Observabilidade", en: "Observability" },
    body: { pt: "Autoscaling sem sinais corretos chega atrasado. Combine utilização, idade da fila, concorrência, latência e burn rate do SLO.", en: "Autoscaling with the wrong signals arrives late. Combine utilization, queue age, concurrency, latency, and SLO burn rate." },
    bullets: [
      { pt: "RED: taxa, erros, duração", en: "RED: rate, errors, duration" },
      { pt: "Tracing com tail sampling", en: "Tracing with tail sampling" },
      { pt: "Alertas por consumo do error budget", en: "Error-budget burn alerts" },
    ],
    result: { pt: "FECHA O CICLO", en: "CLOSES THE LOOP" },
  },
] as const;

const failureRows: Localized[][] = [
  [{ pt: "P99 ↑ · CPU normal", en: "P99 ↑ · CPU normal" }, { pt: "Fila ou dependência lenta", en: "Queue or slow dependency" }, { pt: "Timeout + circuit breaker", en: "Timeout + circuit breaker" }, { pt: "Mais falhas rápidas", en: "More fast failures" }],
  [{ pt: "429 ↑ · latência estável", en: "429 ↑ · stable latency" }, { pt: "Admission control ativo", en: "Admission control active" }, { pt: "Retry com jitter / quota", en: "Retry with jitter / quota" }, { pt: "Menos throughput", en: "Less throughput" }],
  [{ pt: "CPU ↑ · fila ↑", en: "CPU ↑ · queue ↑" }, { pt: "Capacidade insuficiente", en: "Insufficient capacity" }, { pt: "Scale-out + shedding", en: "Scale-out + shedding" }, { pt: "Custo e cold start", en: "Cost and cold starts" }],
  [{ pt: "Retries ↑ · sucesso ↓", en: "Retries ↑ · success ↓" }, { pt: "Amplificação por retries", en: "Retry amplification" }, { pt: "Budget + backoff exponencial", en: "Budget + exponential backoff" }, { pt: "Recuperação mais lenta", en: "Slower recovery" }],
];

const initialControls: Controls = {
  targetRps: 42000, burst: 35, workers: 24, workerCapacity: 1850, globalLimit: 48000, queueCapacity: 12000, retries: 2,
  rateStrategy: "token", balanceStrategy: "least", backpressure: true, circuitBreaker: true, autoscale: true, adaptiveLimit: true,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const compact = (value: number, locale: Locale) => value >= 1000 ? (value / 1000).toLocaleString(locale === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: value >= 100000 ? 0 : 1 }) + "k" : Math.round(value).toString();
const localize = (value: Localized | string, locale: Locale) => typeof value === "string" ? value : value[locale];

function Toggle({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true"><b /></i></label>;
}

function Range({ label, value, min, max, step, suffix, locale, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; locale: Locale; onChange: (value: number) => void }) {
  const languageTag = locale === "pt" ? "pt-BR" : "en-US";
  const progress = ((value - min) / (max - min)) * 100;
  return <label className="range-field"><span><b>{label}</b><output>{value.toLocaleString(languageTag)}{suffix}</output></span><input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} style={{ "--range": progress + "%" } as React.CSSProperties} /><small><em>{min.toLocaleString(languageTag)}</em><em>{max.toLocaleString(languageTag)}</em></small></label>;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("pt");
  const [scenario, setScenario] = useState<ScenarioKey>("flash");
  const [controls, setControls] = useState<Controls>(initialControls);
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(8);
  const [history, setHistory] = useState<number[]>([28, 34, 31, 48, 51, 64, 59, 72, 68, 79, 83, 76, 88, 84, 91, 86, 78, 82, 87, 90]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: "10:42:18", level: "info", code: "flash_loaded" },
    { time: "10:42:19", level: "ok", code: "workers_healthy" },
    { time: "10:42:21", level: "warn", code: "token_burst" },
  ]);
  const previousStatus = useRef("healthy");
  const t = <K extends keyof typeof ui.pt>(key: K) => ui[locale][key];
  const languageTag = locale === "pt" ? "pt-BR" : "en-US";
  const setControl = <K extends keyof Controls>(key: K, value: Controls[K]) => setControls((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const saved = window.localStorage.getItem("traffic-lab-locale");
    if (saved === "pt" || saved === "en") setLocale(saved);
    else if (window.navigator.language.toLowerCase().startsWith("en")) setLocale("en");
  }, []);

  useEffect(() => {
    document.documentElement.lang = languageTag;
    document.title = locale === "pt" ? "Traffic Lab — Simulador de Engenharia de Resiliência" : "Traffic Lab — Resilience Engineering Simulator";
    window.localStorage.setItem("traffic-lab-locale", locale);
  }, [locale, languageTag]);

  const metrics = useMemo(() => {
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
    const scaledWorkers = controls.autoscale && admitted > controls.workers * controls.workerCapacity * 0.82 ? Math.min(64, controls.workers + Math.ceil((admitted / controls.workerCapacity - controls.workers) * 0.58)) : controls.workers;
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
    return { requested, processed: Math.round(processed), blocked, queue: Math.round(queue), queueRatio, utilization, latency, errorRate, availability: 100 - errorRate, scaledWorkers, status };
  }, [controls, scenario, tick]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      setHistory((values) => [...values.slice(-27), clamp(Math.round(metrics.utilization * 82 + metrics.queueRatio * 24 + Math.random() * 8), 5, 100)]);
    }, 900);
    return () => window.clearInterval(timer);
  }, [running, metrics.utilization, metrics.queueRatio]);

  useEffect(() => {
    if (previousStatus.current === metrics.status) return;
    previousStatus.current = metrics.status;
    const code = metrics.status === "healthy" ? "recovered" : metrics.status === "degraded" ? "saturation" : "budget_risk";
    const level: LogLevel = metrics.status === "healthy" ? "ok" : metrics.status === "degraded" ? "warn" : "critical";
    setLogs((items) => [{ time: new Date().toLocaleTimeString(languageTag, { hour12: locale === "en" }), level, code }, ...items].slice(0, 7));
  }, [metrics.status, languageTag, locale]);

  const applyScenario = (key: ScenarioKey) => {
    setScenario(key);
    const presets: Record<ScenarioKey, Partial<Controls>> = {
      steady: { targetRps: 28000, burst: 10, retries: 1 }, flash: { targetRps: 42000, burst: 35, retries: 2 },
      retry: { targetRps: 36000, burst: 25, retries: 4 }, ddos: { targetRps: 68000, burst: 70, retries: 1 },
    };
    setControls((current) => ({ ...current, ...presets[key] }));
    setLogs((items) => [{ time: new Date().toLocaleTimeString(languageTag, { hour12: locale === "en" }), level: "info", code: "scenario_started", scenario: key }, ...items].slice(0, 7));
  };

  const logText = (log: LogEntry) => {
    const messages: Record<Exclude<LogCode, "scenario_started">, Localized> = {
      flash_loaded: { pt: "Cenário flash-sale carregado", en: "Flash-sale scenario loaded" },
      workers_healthy: { pt: "24 workers saudáveis em 3 zonas", en: "24 healthy workers across 3 zones" },
      token_burst: { pt: "Token bucket absorvendo burst +35%", en: "Token bucket absorbing +35% burst" },
      recovered: { pt: "SLO recuperado; sistema estabilizado", en: "SLO recovered; system stabilized" },
      saturation: { pt: "Saturação detectada; mitigação ativa", en: "Saturation detected; mitigation active" },
      budget_risk: { pt: "Error budget em risco; shedding aplicado", en: "Error budget at risk; shedding applied" },
    };
    if (log.code === "scenario_started") return locale === "pt" ? "Cenário " + localize(scenarios[log.scenario || "steady"].name, locale).toLowerCase() + " iniciado" : localize(scenarios[log.scenario || "steady"].name, locale) + " scenario started";
    return localize(messages[log.code], locale);
  };

  const statusLabel = metrics.status === "healthy" ? t("resilient") : metrics.status === "degraded" ? t("degraded") : t("critical");
  const rateLabel = { token: "Token bucket", sliding: "Sliding window", fixed: "Fixed window", leaky: "Leaky bucket" }[controls.rateStrategy];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={t("home")}><span className="brand-mark"><i /><i /><i /></span><span>TRAFFIC<strong>LAB</strong></span></a>
        <nav aria-label={t("nav")}><a href="#simulador">{t("simulator")}</a><a href="#arquitetura">{t("architecture")}</a><a href="#playbook">{t("playbook")}</a></nav>
        <div className="topbar-actions">
          <div className="lang-switch" role="group" aria-label={t("language")}>
            <button aria-pressed={locale === "pt"} className={locale === "pt" ? "active" : ""} onClick={() => setLocale("pt")}>PT-BR</button>
            <button aria-pressed={locale === "en"} className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN-US</button>
          </div>
          <div className="system-online"><i /> LAB ONLINE <span>v1.1</span></div>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <span className="eyebrow"><i /> RESILIENCE ENGINEERING LAB</span>
          <h1>{t("heroTitle")}<br /><em>{t("heroAccent")}</em></h1>
          <p>{t("heroBody")}</p>
          <div className="hero-actions"><a className="primary-action" href="#simulador">{t("openSimulator")} <span>↘</span></a><a className="text-action" href="#playbook">{t("explore")} →</a></div>
        </div>
        <div className="hero-telemetry" aria-label={t("liveTelemetry")}>
          <div className="telemetry-head"><span>LIVE / EDGE-SOUTH-1</span><span><i /> STREAMING</span></div>
          <div className="hero-metric"><span>{t("throughput")}</span><strong>{compact(metrics.processed, locale)} <small>req/s</small></strong><b>+12.4%</b></div>
          <div className="sparkline">{history.slice(-16).map((value, index) => <i key={index} style={{ height: value + "%" }} />)}</div>
          <div className="mini-grid"><div><span>{t("latency")}</span><strong>{metrics.latency}ms</strong></div><div><span>{t("availability")}</span><strong>{metrics.availability.toFixed(2)}%</strong></div><div><span>{t("activeNodes")}</span><strong>{metrics.scaledWorkers}/64</strong></div></div>
        </div>
      </section>

      <section className="lab-section" id="simulador">
        <div className="section-heading">
          <div><span className="index">01</span><span className="eyebrow">{t("trafficSimulator")}</span><h2>{t("submitArchitecture")}<br />{t("toRealWorld")}</h2></div>
          <p>{t("simulatorBody")}</p>
        </div>
        <div className="scenario-strip" role="group" aria-label={t("scenarios")}>
          {(Object.keys(scenarios) as ScenarioKey[]).map((key) => <button key={key} className={scenario === key ? "active" : ""} onClick={() => applyScenario(key)}><span>{scenarios[key].tag}</span><strong>{localize(scenarios[key].name, locale)}</strong><small>{localize(scenarios[key].detail, locale)}</small></button>)}
        </div>

        <div className="simulator-shell">
          <aside className="control-panel">
            <div className="panel-title"><span>{t("configuration")}</span><button onClick={() => setControls(initialControls)}>{t("reset")}</button></div>
            <Range label={t("incomingLoad")} value={controls.targetRps} min={5000} max={120000} step={1000} suffix=" RPS" locale={locale} onChange={(value) => setControl("targetRps", value)} />
            <Range label={t("burstTolerance")} value={controls.burst} min={0} max={100} step={5} suffix="%" locale={locale} onChange={(value) => setControl("burst", value)} />
            <div className="two-fields">
              <label><span>{t("rateLimit")}</span><select aria-label={t("rateLimit")} value={controls.rateStrategy} onChange={(event) => setControl("rateStrategy", event.target.value as RateStrategy)}><option value="token">Token bucket</option><option value="sliding">Sliding window</option><option value="fixed">Fixed window</option><option value="leaky">Leaky bucket</option></select></label>
              <label><span>{t("loadBalancer")}</span><select aria-label={t("loadBalancer")} value={controls.balanceStrategy} onChange={(event) => setControl("balanceStrategy", event.target.value as BalanceStrategy)}><option value="least">Least connections</option><option value="round">Round robin</option><option value="weighted">Weighted RR</option><option value="hash">Consistent hash</option></select></label>
            </div>
            <Range label={t("globalLimit")} value={controls.globalLimit} min={10000} max={100000} step={2000} suffix=" RPS" locale={locale} onChange={(value) => setControl("globalLimit", value)} />
            <div className="two-fields compact-fields"><label><span>{t("workers")}</span><input aria-label={t("workers")} type="number" min="4" max="64" value={controls.workers} onChange={(event) => setControl("workers", clamp(Number(event.target.value), 4, 64))} /></label><label><span>{t("retries")}</span><input aria-label={t("retries")} type="number" min="0" max="6" value={controls.retries} onChange={(event) => setControl("retries", clamp(Number(event.target.value), 0, 6))} /></label></div>
            <div className="toggles">
              <Toggle checked={controls.backpressure} label="Backpressure" description={t("backpressureBody")} onChange={(value) => setControl("backpressure", value)} />
              <Toggle checked={controls.circuitBreaker} label="Circuit breaker" description={t("breakerBody")} onChange={(value) => setControl("circuitBreaker", value)} />
              <Toggle checked={controls.autoscale} label="Autoscaling" description={t("autoscaleBody")} onChange={(value) => setControl("autoscale", value)} />
              <Toggle checked={controls.adaptiveLimit} label="Adaptive limit" description={t("adaptiveBody")} onChange={(value) => setControl("adaptiveLimit", value)} />
            </div>
            <button className={"run-button " + (running ? "running" : "")} onClick={() => setRunning((value) => !value)}><i /> {running ? t("pause") : t("start")}</button>
          </aside>

          <div className="simulation-stage">
            <div className="stage-header"><div><span>{t("systemStatus")}</span><strong className={metrics.status}><i /> {statusLabel}</strong></div><div className="clock">T+ {String(tick).padStart(3, "0")}s</div></div>
            <div className="metric-row">
              <div><span>{t("incoming")}</span><strong>{compact(metrics.requested, locale)}</strong><small>req/s</small></div>
              <div><span>{t("processed")}</span><strong>{compact(metrics.processed, locale)}</strong><small>req/s</small></div>
              <div><span>{t("blocked")}</span><strong>{compact(metrics.blocked, locale)}</strong><small>req/s</small></div>
              <div><span>{t("errorRate")}</span><strong>{metrics.errorRate.toFixed(2)}%</strong><small>SLO &lt; 1%</small></div>
            </div>
            <div className="topology" id="arquitetura">
              <div className="flow-line"><span /><span /><span /><span /><span /></div>
              <div className="topology-node"><span>01 / EDGE</span><i className="node-icon globe">◎</i><strong>CDN + WAF</strong><small>{compact(metrics.requested, locale)} RPS {t("received")}</small><b className="ok">{t("healthy")}</b></div>
              <div className="topology-node"><span>02 / CONTROL</span><i className="node-icon">⌁</i><strong>RATE LIMIT</strong><small>{rateLabel}</small><b className={metrics.blocked > 0 ? "warn" : "ok"}>{compact(metrics.blocked, locale)} {t("blockedWord")}</b></div>
              <div className="topology-node"><span>03 / ROUTING</span><i className="node-icon">⇄</i><strong>LOAD BALANCER</strong><small>3 {t("zones")}</small><b className="ok">{Math.round(metrics.utilization * 100)}% {t("utilization")}</b></div>
              <div className="topology-node"><span>04 / BUFFER</span><i className="node-icon">≋</i><strong>QUEUE</strong><small>{compact(metrics.queue, locale)} / {compact(controls.queueCapacity, locale)}</small><b className={metrics.queueRatio > .65 ? "warn" : "ok"}>{Math.round(metrics.queueRatio * 100)}% {t("occupied")}</b></div>
              <div className="topology-node"><span>05 / COMPUTE</span><i className="node-icon">▦</i><strong>WORKERS</strong><small>{metrics.scaledWorkers} {t("activeInstances")}</small><b className={metrics.utilization > .95 ? "warn" : "ok"}>{compact(metrics.processed, locale)} {t("useful")}</b></div>
            </div>
            <div className="stage-bottom">
              <div className="load-chart"><div className="chart-head"><span>{t("saturationHistory")}</span><b>{Math.round(metrics.utilization * 100)}%</b></div><div className="bars">{history.map((value, index) => <i key={index} className={value > 90 ? "hot" : ""} style={{ height: value + "%" }} />)}</div><div className="threshold"><span>{t("threshold")}</span></div></div>
              <div className="incident-log"><div className="chart-head"><span>{t("incidentStream")}</span><b>LIVE</b></div><div className="log-list">{logs.map((log, index) => <div key={log.time + index}><time>{log.time}</time><i className={log.level} /><span>{logText(log)}</span></div>)}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="playbook" id="playbook">
        <div className="section-heading"><div><span className="index">02</span><span className="eyebrow">{t("defense")}</span><h2>{t("noSilverBullet")}<br />{t("composition")}</h2></div><p>{t("defenseBody")}</p></div>
        <div className="strategy-grid">{strategies.map((strategy) => <article key={strategy.category}><span>{strategy.category}</span><h3>{localize(strategy.title, locale)}</h3><p>{localize(strategy.body, locale)}</p><ul>{strategy.bullets.map((bullet) => <li key={bullet.en}>{localize(bullet, locale)}</li>)}</ul><b>{localize(strategy.result, locale)}</b></article>)}</div>
      </section>

      <section className="failure-model">
        <span className="eyebrow">{t("failureModel")}</span><h2>{t("whatBreaks")}</h2>
        <div className="failure-table"><div className="table-head"><span>{t("signal")}</span><span>{t("probableCause")}</span><span>{t("response")}</span><span>{t("tradeoff")}</span></div>{failureRows.map((row, rowIndex) => <div key={rowIndex}>{row.map((cell) => <span key={cell.en}>{localize(cell, locale)}</span>)}</div>)}</div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span><span>TRAFFIC<strong>LAB</strong></span></a><p>{t("footer")}<br />{t("footerAccent")}</p><a href="#simulador">{t("newExperiment")} ↑</a></footer>
    </main>
  );
}
