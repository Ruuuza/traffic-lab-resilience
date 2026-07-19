# Runbook de validação

## Ambiente comprovado

- Windows 11 / PowerShell
- Node.js 22.13 ou superior
- npm e lockfile do repositório

## Sequência

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm audit
```

Critérios de sucesso: todos os comandos encerram com código zero, sete testes passam e a auditoria reporta zero vulnerabilidades conhecidas.

## Validação manual

1. execute `npm run dev` e abra `http://localhost:3000`;
2. selecione cada cenário e confirme a atualização das métricas;
3. altere rate limit e balanceador;
4. pause e retome a simulação;
5. confirme ausência de overflow horizontal em viewport móvel;
6. verifique o console do navegador.
