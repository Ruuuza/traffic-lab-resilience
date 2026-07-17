# Traffic Lab

Laboratório interativo de engenharia de resiliência para explorar como sistemas distribuídos reagem a picos legítimos, retry storms e ataques de camada 7.

O projeto não envia tráfego real. Ele executa um modelo determinístico no navegador e transforma decisões arquiteturais em métricas observáveis: throughput, P99, error rate, ocupação da fila, utilização, bloqueios e instâncias ativas.

## O que pode ser simulado

- quatro perfis de carga: constante, flash sale, retry storm e DDoS L7;
- token bucket, sliding window, fixed window e leaky bucket;
- least connections, round robin, weighted round robin e consistent hashing;
- backpressure, load shedding, circuit breaker e limites adaptativos;
- filas limitadas, retries e amplificação de carga;
- autoscaling orientado por capacidade e saturação;
- propagação do fluxo por Edge → Rate Limit → Load Balancer → Queue → Workers.

## Modelo

A cada ciclo, o simulador calcula:

1. requested = targetRps × scenarioLoad × jitter × retryAmplification;
2. admission control conforme o algoritmo de rate limit e a tolerância a burst;
3. capacidade útil do pool de workers, ajustada pela eficiência do balanceador;
4. overflow, profundidade da fila e pressão sobre o sistema;
5. shedding por backpressure e isolamento pelo circuit breaker;
6. utilização, P99 estimado, taxa de erro e disponibilidade.

O modelo é intencionalmente explicável: ele demonstra relações e trade-offs, não substitui um load test ou capacity plan de produção.

## Defesa em profundidade

| Camada | Mecanismo | Protege contra |
| --- | --- | --- |
| Edge | CDN, WAF, bot management | volume hostil e trabalho repetido |
| Admission | rate limit, quotas, concurrency limit | consumo injusto de capacidade |
| Routing | load balancing e health checks | hotspots e nós doentes |
| Flow | bounded queues e backpressure | memória ilimitada e latência crescente |
| Isolation | timeouts, bulkheads e circuit breakers | falhas em cascata |
| Compute | workers stateless e autoscaling | variação sustentada de demanda |
| Control loop | RED metrics, tracing e SLO burn rate | reação tardia e operação às cegas |

## Rodando localmente

Requisitos: Node.js 22.13 ou superior.

~~~bash
npm install
npm run dev
~~~

Para validar a versão de produção:

~~~bash
npm test
~~~

## Estrutura

- app/page.tsx: interface, estado e motor do simulador;
- app/globals.css: sistema visual dark, responsividade e motion;
- app/layout.tsx: metadados e social card;
- tests/rendered-html.test.mjs: smoke tests do artefato server-rendered;
- .openai/hosting.json: configuração do deploy no Sites.

## Princípios de produção representados

- rejeitar cedo é mais barato que falhar tarde;
- retries precisam de budget, exponential backoff e jitter;
- uma fila é um buffer finito, não capacidade;
- autoscaling é um loop de controle com atraso;
- rate limit global exige coordenação distribuída e uma política de falha;
- degradação graciosa preserva o caminho crítico;
- SLOs e error budgets conectam sinais técnicos ao impacto para o usuário.

## Licença

MIT.
