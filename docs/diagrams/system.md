# Diagramas

## Contexto e containers

```mermaid
flowchart LR
  U["Usuário no navegador"] --> W["Cloudflare Worker"]
  W --> A["Assets e shell Vinext"]
  A --> UI["React UI"]
  UI --> M["Motor determinístico"]
  M --> UI
```

## Componentes e fluxo principal

```mermaid
sequenceDiagram
  actor User as Usuário
  participant Page as page.tsx
  participant Model as simulation.ts
  User->>Page: seleciona cenário ou altera controle
  Page->>Model: calculateMetrics(controls, scenario, tick)
  Model-->>Page: SimulationMetrics
  Page-->>User: métricas, topologia e incidentes
```

## Modelo lógico de resiliência simulado

```mermaid
flowchart LR
  L["Carga solicitada"] --> R["Rate limit"]
  R --> B["Balanceamento"]
  B --> Q["Fila limitada"]
  Q --> C["Workers"]
  Q --> P["Backpressure / shedding"]
  C --> O["Throughput, P99 e erros"]
  P --> O
  O --> S["Autoscaling e estado"]
```

Os nós representam conceitos calculados no cliente, não infraestrutura real implantada.
