# Troubleshooting

## Build falha após instalar dependências

Remova a suspeita de instalação incompleta executando `npm ci` a partir do lockfile e repita `npm test`. Não edite artefatos em `dist/`.

## Porta 3000 em uso

Encerre somente o processo de desenvolvimento iniciado para este projeto ou informe uma porta explícita suportada pelo Vinext. Não finalize processos sem confirmar sua origem.

## Métricas mudam mesmo sem interação

Esse é o comportamento esperado enquanto a simulação está ativa. Use “PAUSAR SIMULAÇÃO” para congelar o tick.

## Build mostra rota não classificada

O Vinext informa que sua análise estática ainda não classifica todos os usos dinâmicos. O aviso não impediu o build nem os smoke tests; trate uma mudança para erro como regressão.
