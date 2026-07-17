"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ScenarioKey = "steady" | "flash" | "retry" | "ddos";
type RateStrategy = "token" | "sliding" | "fixed" | "leaky";
type BalanceStrategy = "least" | "round" | "weighted" | "hash";

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

const scenarios: Record<ScenarioKey, { name: string; tag: string; detail: string; load: number; jitter: number }> = {
  steady: { name: "Carga constante", tag: "BASELINE", detail: "Tráfego previsível com baixa variância.", load: 1, jitter: 0.04 },
  flash: { name: "Flash sale", tag: "BURST", detail: "Pico abrupto de clientes legítimos.", load: 1.75, jitter: 0.28 },
  retry: { name: "Retry storm", tag: "CASCADE", detail: "Timeouts disparam retentativas em cadeia.", load: 1.35, jitter: 0.18 },
  ddos: { name: "DDoS L7", tag: "HOSTILE", detail: "Grande volume distribuído e malicioso.", load: 2.6, jitter: 0.35 },
};

const initialControls: Controls = {
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const compact = (value: number) => value >= 1000 ? (value / 1000).toFixed(value >= 100000 ? 0 : 1) + "k" : Math.round(value).toString();

function Toggle({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><b /></i>
    </label>
  );
}

function Range({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className="range-field">
      <span><b>{label}</b><output>{value.toLocaleString("pt-BR")}{suffix}</output></span>
      <input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} style={{ "--range": progress + "%" } as React.CSSProperties} />
      <small><em>{min.toLocaleString("pt-BR")}</em><em>{max.toLocaleString("pt-BR")}</em></small>
    </label>
  );
}

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioKey>("flash");
  const [controls, setControls] = useState<Controls>(initialControls);
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(8);
  const [history, setHistory] = useState<number[]>([28, 34, 31, 48, 51, 64, 59, 72, 68, 79, 83, 76, 88, 84, 91, 86, 78, 82, 87, 90]);
  const [logs, setLogs] = useState([
    { time: "10:42:18", level: "info", text: "Cenário flash-sale carregado" },
    { time: "10:42:19", level: "ok", text: "24 workers saudáveis em 3 zonas" },
    { time: "10:42:21", level: "warn", text: "Token bucket absorvendo burst +35%" },
  ]);
  const previousStatus = useRef("healthy");

  const setControl = <K extends keyof Controls>(key: K, value: Controls[K]) => setControls((current) => ({ ...current, [key]: value }));

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
    const availability = 100 - errorRate;
    const blocked = Math.round(blockedByPolicy + backpressureShed + circuitShed);
    const status = errorRate > 8 || latency > 900 ? "critical" : errorRate > 1.5 || latency > 350 || queueRatio > 0.65 ? "degraded" : "healthy";
    return { requested, processed: Math.round(processed), blocked, queue: Math.round(queue), queueRatio, utilization, latency, errorRate, availability, scaledWorkers, status };
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
    const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    const messages = {
      healthy: { level: "ok", text: "SLO recuperado; sistema estabilizado" },
      degraded: { level: "warn", text: "Saturação detectada; mitigação ativa" },
      critical: { level: "critical", text: "Budget de erro em risco; shedding aplicado" },
    };
    setLogs((items) => [{ time: now, ...messages[metrics.status as keyof typeof messages] }, ...items].slice(0, 7));
  }, [metrics.status]);

  const applyScenario = (key: ScenarioKey) => {
    setScenario(key);
    const presets: Record<ScenarioKey, Partial<Controls>> = {
      steady: { targetRps: 28000, burst: 10, retries: 1 },
      flash: { targetRps: 42000, burst: 35, retries: 2 },
      retry: { targetRps: 36000, burst: 25, retries: 4 },
      ddos: { targetRps: 68000, burst: 70, retries: 1 },
    };
    setControls((current) => ({ ...current, ...presets[key] }));
    setLogs((items) => [{ time: new Date().toLocaleTimeString("pt-BR", { hour12: false }), level: "info", text: "Cenário " + scenarios[key].name.toLowerCase() + " iniciado" }, ...items].slice(0, 7));
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Traffic Lab — início">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>TRAFFIC<strong>LAB</strong></span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#simulador">Simulador</a>
          <a href="#arquitetura">Arquitetura</a>
          <a href="#playbook">Playbook</a>
        </nav>
        <div className="system-online"><i /> LAB ONLINE <span>v1.0</span></div>
      </header>

      <section className="hero" id="top">
        <div>
          <span className="eyebrow"><i /> RESILIENCE ENGINEERING LAB</span>
          <h1>Projete para o pico.<br /><em>Sobreviva ao caos.</em></h1>
          <p>Um laboratório interativo para explorar como sistemas distribuídos absorvem milhões de requisições sem bloquear usuários legítimos — nem derrubar a própria infraestrutura.</p>
          <div className="hero-actions">
            <a className="primary-action" href="#simulador">ABRIR SIMULADOR <span>↘</span></a>
            <a className="text-action" href="#playbook">EXPLORAR ESTRATÉGIAS →</a>
          </div>
        </div>
        <div className="hero-telemetry" aria-label="Telemetria ao vivo">
          <div className="telemetry-head"><span>LIVE / EDGE-SOUTH-1</span><span><i /> STREAMING</span></div>
          <div className="hero-metric"><span>THROUGHPUT</span><strong>{compact(metrics.processed)} <small>req/s</small></strong><b>+12.4%</b></div>
          <div className="sparkline">{history.slice(-16).map((value, index) => <i key={index} style={{ height: value + "%" }} />)}</div>
          <div className="mini-grid">
            <div><span>P99 LATENCY</span><strong>{metrics.latency}ms</strong></div>
            <div><span>AVAILABILITY</span><strong>{metrics.availability.toFixed(2)}%</strong></div>
            <div><span>ACTIVE NODES</span><strong>{metrics.scaledWorkers}/64</strong></div>
          </div>
        </div>
      </section>

      <section className="lab-section" id="simulador">
        <div className="section-heading">
          <div><span className="index">01</span><span className="eyebrow">TRAFFIC SIMULATOR</span><h2>Submeta a arquitetura<br />ao mundo real.</h2></div>
          <p>Ajuste a carga e as defesas. O modelo recalcula amplificação, saturação, filas, shedding e latência a cada ciclo.</p>
        </div>

        <div className="scenario-strip" role="group" aria-label="Cenários de tráfego">
          {(Object.keys(scenarios) as ScenarioKey[]).map((key) => (
            <button key={key} className={scenario === key ? "active" : ""} onClick={() => applyScenario(key)}>
              <span>{scenarios[key].tag}</span><strong>{scenarios[key].name}</strong><small>{scenarios[key].detail}</small>
            </button>
          ))}
        </div>

        <div className="simulator-shell">
          <aside className="control-panel">
            <div className="panel-title"><span>CONFIGURAÇÃO</span><button onClick={() => setControls(initialControls)}>RESET</button></div>
            <Range label="Carga de entrada" value={controls.targetRps} min={5000} max={120000} step={1000} suffix=" RPS" onChange={(value) => setControl("targetRps", value)} />
            <Range label="Burst tolerance" value={controls.burst} min={0} max={100} step={5} suffix="%" onChange={(value) => setControl("burst", value)} />
            <div className="two-fields">
              <label><span>Rate limit</span><select value={controls.rateStrategy} onChange={(event) => setControl("rateStrategy", event.target.value as RateStrategy)}><option value="token">Token bucket</option><option value="sliding">Sliding window</option><option value="fixed">Fixed window</option><option value="leaky">Leaky bucket</option></select></label>
              <label><span>Load balancer</span><select value={controls.balanceStrategy} onChange={(event) => setControl("balanceStrategy", event.target.value as BalanceStrategy)}><option value="least">Least connections</option><option value="round">Round robin</option><option value="weighted">Weighted RR</option><option value="hash">Consistent hash</option></select></label>
            </div>
            <Range label="Limite global" value={controls.globalLimit} min={10000} max={100000} step={2000} suffix=" RPS" onChange={(value) => setControl("globalLimit", value)} />
            <div className="two-fields compact-fields">
              <label><span>Workers</span><input type="number" min="4" max="64" value={controls.workers} onChange={(event) => setControl("workers", clamp(Number(event.target.value), 4, 64))} /></label>
              <label><span>Retries</span><input type="number" min="0" max="6" value={controls.retries} onChange={(event) => setControl("retries", clamp(Number(event.target.value), 0, 6))} /></label>
            </div>
            <div className="toggles">
              <Toggle checked={controls.backpressure} label="Backpressure" description="Propaga saturação para a borda" onChange={(value) => setControl("backpressure", value)} />
              <Toggle checked={controls.circuitBreaker} label="Circuit breaker" description="Isola dependências instáveis" onChange={(value) => setControl("circuitBreaker", value)} />
              <Toggle checked={controls.autoscale} label="Autoscaling" description="Escala por fila e utilização" onChange={(value) => setControl("autoscale", value)} />
              <Toggle checked={controls.adaptiveLimit} label="Adaptive limit" description="Ajusta concorrência pela latência" onChange={(value) => setControl("adaptiveLimit", value)} />
            </div>
            <button className={"run-button " + (running ? "running" : "")} onClick={() => setRunning((value) => !value)}><i /> {running ? "PAUSAR SIMULAÇÃO" : "INICIAR SIMULAÇÃO"}</button>
          </aside>

          <div className="simulation-stage">
            <div className="stage-header">
              <div><span>STATUS DO SISTEMA</span><strong className={metrics.status}><i /> {metrics.status === "healthy" ? "RESILIENTE" : metrics.status === "degraded" ? "DEGRADADO" : "CRÍTICO"}</strong></div>
              <div className="clock">T+ {String(tick).padStart(3, "0")}s</div>
            </div>
            <div className="metric-row">
              <div><span>INCOMING</span><strong>{compact(metrics.requested)}</strong><small>req/s</small></div>
              <div><span>PROCESSED</span><strong>{compact(metrics.processed)}</strong><small>req/s</small></div>
              <div><span>BLOCKED / SHED</span><strong>{compact(metrics.blocked)}</strong><small>req/s</small></div>
              <div><span>ERROR RATE</span><strong>{metrics.errorRate.toFixed(2)}%</strong><small>SLO &lt; 1%</small></div>
            </div>

            <div className="topology" id="arquitetura">
              <div className="flow-line"><span /><span /><span /><span /><span /></div>
              <div className="topology-node"><span>01 / EDGE</span><i className="node-icon globe">◎</i><strong>CDN + WAF</strong><small>{compact(metrics.requested)} RPS recebido</small><b className="ok">HEALTHY</b></div>
              <div className="topology-node"><span>02 / CONTROL</span><i className="node-icon">⌁</i><strong>RATE LIMIT</strong><small>{controls.rateStrategy.replace("token", "Token bucket").replace("sliding", "Sliding window").replace("fixed", "Fixed window").replace("leaky", "Leaky bucket")}</small><b className={metrics.blocked > 0 ? "warn" : "ok"}>{compact(metrics.blocked)} bloqueadas</b></div>
              <div className="topology-node"><span>03 / ROUTING</span><i className="node-icon">⇄</i><strong>LOAD BALANCER</strong><small>3 zonas · health checks</small><b className="ok">{Math.round(metrics.utilization * 100)}% utilização</b></div>
              <div className="topology-node"><span>04 / BUFFER</span><i className="node-icon">≋</i><strong>QUEUE</strong><small>{compact(metrics.queue)} / {compact(controls.queueCapacity)}</small><b className={metrics.queueRatio > .65 ? "warn" : "ok"}>{Math.round(metrics.queueRatio * 100)}% ocupada</b></div>
              <div className="topology-node"><span>05 / COMPUTE</span><i className="node-icon">▦</i><strong>WORKERS</strong><small>{metrics.scaledWorkers} instâncias ativas</small><b className={metrics.utilization > .95 ? "warn" : "ok"}>{compact(metrics.processed)} RPS útil</b></div>
            </div>

            <div className="stage-bottom">
              <div className="load-chart">
                <div className="chart-head"><span>SATURAÇÃO / ÚLTIMOS 25s</span><b>{Math.round(metrics.utilization * 100)}%</b></div>
                <div className="bars">{history.map((value, index) => <i key={index} className={value > 90 ? "hot" : ""} style={{ height: value + "%" }} />)}</div>
                <div className="threshold"><span>SATURATION THRESHOLD</span></div>
              </div>
              <div className="incident-log">
                <div className="chart-head"><span>INCIDENT STREAM</span><b>LIVE</b></div>
                <div className="log-list">{logs.map((log, index) => <div key={log.time + index}><time>{log.time}</time><i className={log.level} /><span>{log.text}</span></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="playbook" id="playbook">
        <div className="section-heading">
          <div><span className="index">02</span><span className="eyebrow">DEFENSE IN DEPTH</span><h2>Não existe bala de prata.<br />Existe composição.</h2></div>
          <p>Resiliência emerge de camadas independentes. Cada mecanismo protege uma restrição diferente e falha de um jeito diferente.</p>
        </div>
        <div className="strategy-grid">
          <article><span>01 / ADMISSION</span><h3>Rate limiting</h3><p>Token bucket tolera bursts; sliding window entrega precisão; leaky bucket suaviza o fluxo; limites adaptativos reagem à latência.</p><ul><li>Chave por IP, usuário, token ou rota</li><li>Limites locais + contador distribuído</li><li>Headers 429 e Retry-After com jitter</li></ul><b>PROTEGE CAPACIDADE</b></article>
          <article><span>02 / DISTRIBUTION</span><h3>Load balancing</h3><p>Round robin é simples; least-connections reage à duração; pesos drenam nós; consistent hash preserva afinidade e cache.</p><ul><li>Health checks ativos e passivos</li><li>Connection draining em deploys</li><li>Balanceamento multi-região</li></ul><b>DISTRIBUI TRABALHO</b></article>
          <article><span>03 / FLOW CONTROL</span><h3>Backpressure</h3><p>Quando o consumidor satura, o produtor precisa desacelerar. Buffers infinitos apenas transformam carga em latência e memória.</p><ul><li>Filas limitadas e bounded concurrency</li><li>Load shedding por prioridade</li><li>Créditos, pull e streaming</li></ul><b>LIMITA FILAS</b></article>
          <article><span>04 / ISOLATION</span><h3>Circuit breaker</h3><p>Closed, open e half-open impedem que uma dependência lenta consuma todas as threads, conexões e budgets de timeout.</p><ul><li>Bulkheads por dependência</li><li>Timeouts menores que o deadline</li><li>Fallback e degradação graciosa</li></ul><b>INTERROMPE CASCATAS</b></article>
          <article><span>05 / ASYNC</span><h3>Queues & workers</h3><p>Filas desacoplam picos da capacidade de processamento, mas exigem idempotência, visibilidade e uma política explícita para poison pills.</p><ul><li>Dead-letter queue e redrive</li><li>Deduplicação e idempotency keys</li><li>Particionamento por ordering key</li></ul><b>ABSORVE BURSTS</b></article>
          <article><span>06 / CONTROL LOOP</span><h3>Observabilidade</h3><p>Autoscaling sem sinais corretos chega atrasado. Combine utilização, idade da fila, concorrência, latência e burn rate do SLO.</p><ul><li>RED: rate, errors, duration</li><li>Tracing com tail sampling</li><li>Alertas por error-budget burn</li></ul><b>FECHA O CICLO</b></article>
        </div>
      </section>

      <section className="failure-model">
        <span className="eyebrow">FAILURE MODEL / LEIA O SISTEMA</span>
        <h2>O que quebra primeiro?</h2>
        <div className="failure-table">
          <div className="table-head"><span>SINAL</span><span>CAUSA PROVÁVEL</span><span>RESPOSTA</span><span>TRADE-OFF</span></div>
          <div><span>P99 ↑ · CPU normal</span><span>Fila ou dependência lenta</span><span>Timeout + circuit breaker</span><span>Mais falhas rápidas</span></div>
          <div><span>429 ↑ · latência estável</span><span>Admission control ativo</span><span>Retry com jitter / quota</span><span>Menos throughput</span></div>
          <div><span>CPU ↑ · fila ↑</span><span>Capacidade insuficiente</span><span>Scale-out + shedding</span><span>Custo e cold start</span></div>
          <div><span>Retries ↑ · sucesso ↓</span><span>Retry amplification</span><span>Budget + exponential backoff</span><span>Recuperação mais lenta</span></div>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span><span>TRAFFIC<strong>LAB</strong></span></a>
        <p>Um laboratório de engenharia de resiliência.<br />Construa sistemas que falham com elegância.</p>
        <a href="#simulador">EXECUTAR NOVO EXPERIMENTO ↑</a>
      </footer>
    </main>
  );
}
