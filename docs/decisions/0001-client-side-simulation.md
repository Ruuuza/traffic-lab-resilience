# ADR 0001 — Manter o modelo determinístico no cliente

- Status: aceito
- Data: 2026-07-19

## Contexto e problema

O laboratório precisa responder imediatamente a ajustes, funcionar sem credenciais e não gerar tráfego real. O código anterior já implementava o cálculo no componente React, mas misturava domínio e apresentação.

## Opções consideradas

1. manter todas as fórmulas no componente;
2. extrair uma função pura executada no cliente;
3. criar um serviço remoto de simulação.

## Decisão

Extrair o modelo para `app/simulation.ts` e manter sua execução no navegador.

## Justificativa

A função pura melhora testabilidade e legibilidade sem introduzir rede, autenticação, custo operacional ou falsa precisão. Esta é uma decisão técnica atual; não atribui motivações históricas não comprovadas.

## Consequências positivas

- resultados repetíveis para as mesmas entradas;
- testes unitários rápidos;
- separação entre domínio e UI;
- nenhuma transmissão de dados.

## Consequências negativas e riscos

- fórmulas ficam expostas no bundle;
- dispositivos do usuário executam o cálculo;
- o modelo continua didático e não calibrado com produção.
