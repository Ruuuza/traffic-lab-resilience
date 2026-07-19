# Relatório de grooming técnico

Data: 2026-07-19

Branch base: `main`

Branch de trabalho: `codex/technical-grooming-traffic`

## Estado inicial

| Verificação | Resultado inicial |
| --- | --- |
| Build | sucesso |
| Lint | sucesso na branch base; a execução na pasta agregadora varria repositórios aninhados |
| Testes | 2/2 smoke tests passaram |
| Typecheck | não existia como script; o worker continha referências de tipo não resolvidas |
| Auditoria de produção | 2 vulnerabilidades moderadas em PostCSS via Next.js |
| Auditoria completa | 14 achados, incluindo ferramentas de desenvolvimento |
| Working tree | limpo na branch isolada; a pasta agregadora tinha arquivos não rastreados preservados |

## Achados e tratamento

| Severidade | Categoria | Evidência e impacto | Mudança | Critério de aceite |
| --- | --- | --- | --- | --- |
| Alta | Segurança de desenvolvimento | versões de Vite/Cloudflare expostas a advisories locais e de rede | atualização patch/minor compatível | `npm audit` sem achados |
| Média | Segurança de produção | PostCSS 8.4.31 vulnerável, aninhado em Next.js | override para PostCSS 8.5.10 | `npm audit --omit=dev` sem achados |
| Média | Manutenibilidade | fórmulas de domínio acopladas ao componente | extração para função pura tipada | testes unitários determinísticos |
| Média | Qualidade | ausência de typecheck e cobertura do motor | scripts e três testes unitários | lint, typecheck e 5 testes passam |
| Baixa | Higiene | scaffolding D1/autenticação sem uso e com dependências associadas | remoção comprovada por ausência de consumidores e `d1: null` | build e testes permanecem verdes |
| Baixa | DX | lint da pasta agregadora alcançava projetos aninhados | ignores explícitos para artefatos externos | lint do repositório permanece isolado |

## Mudanças aplicadas

- separação do motor e contratos em `app/simulation.ts`;
- cobertura de determinismo, tráfego hostil, limites e autoscaling;
- typecheck reproduzível e correção dos tipos mínimos do Worker;
- remoção de D1, Drizzle, exemplo de notes e autenticação não utilizados;
- atualização segura da toolchain e correção da cadeia PostCSS;
- documentação arquitetural, ADR, runbook, troubleshooting e capturas reais.

## Evidências pós-grooming

| Verificação | Resultado final |
| --- | --- |
| Build | sucesso |
| Lint | sucesso, zero erros |
| Typecheck | sucesso, zero erros |
| Testes | 7/7 passaram |
| Auditoria completa | zero vulnerabilidades conhecidas |
| Browser | desktop e móvel validados; cenário steady chegou a `RESILIENTE`; zero erros de console |

## Antes e depois

| Aspecto | Antes | Depois |
| --- | --- | --- |
| Motor | dentro do componente | função pura tipada e reutilizável |
| Cobertura | shell e presença de strings | shell + invariantes de domínio |
| Persistência | scaffolding D1 sem uso | nenhuma persistência declarada |
| Dependências | Drizzle e toolchain vulnerável | superfície menor e auditoria limpa |
| Documentação | README curto | README operacional, arquitetura, ADR, diagramas e runbooks |

## Riscos remanescentes e dívida técnica

- não há E2E contínuo em navegador;
- o modelo não é calibrado com medições reais;
- o PR de CI permanece separado e precisa de revisão;
- a branch bilíngue também permanece em PR independente;
- a classificação estática de rotas do Vinext continua limitada.

## Melhorias futuras

Priorizar o merge seguro da CI, testes E2E de controles/teclado e uma estratégia explícita de calibração antes de aumentar a complexidade do motor.
