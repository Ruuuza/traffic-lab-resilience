# Arquitetura

## Contexto

Traffic Lab é uma aplicação web educacional, sem backend de domínio. Usuários ajustam parâmetros e observam um modelo matemático de resiliência. O único sistema externo em runtime é a plataforma de hospedagem que entrega HTML, JavaScript, CSS e imagens.

## Componentes

- `app/page.tsx`: coordena eventos, relógio da simulação, histórico e renderização.
- `app/simulation.ts`: contém contratos, cenários, valores iniciais e a função pura `calculateMetrics`.
- `worker/index.ts`: integra o bundle Vinext ao runtime Cloudflare e ao serviço de imagens.
- `tests/simulation.test.ts`: protege invariantes do modelo.
- `tests/rendered-html.test.mjs`: valida o artefato server-rendered.

## Fluxo de dados

Os controles formam um valor `Controls`. A cada tick, `calculateMetrics(controls, scenario, tick)` retorna `SimulationMetrics`. O React deriva somente a apresentação; a função não usa rede, relógio do sistema ou estado global e, portanto, é repetível para entradas idênticas.

## Segurança e privacidade

Não há autenticação, cookies de sessão, persistência, API própria nem conteúdo HTML fornecido pelo usuário. A aplicação não executa carga real. O servidor de desenvolvimento deve permanecer restrito ao host local.

## Implantação

O pipeline Vinext gera `dist/server/index.js` e assets estáticos. O Cloudflare Worker recebe a requisição, encaminha otimização de imagem quando aplicável e delega as demais rotas ao App Router compilado.
