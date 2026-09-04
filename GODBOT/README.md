# GODBOT

## Analise de confluencias com IA

O painel usa dados de preco da Binance Futures. A analise textual das confluencias e feita pelo Qwen na nuvem via Groq, sem usar creditos da OpenAI e sem exigir processamento do computador local.

### Iniciar

No PowerShell, dentro desta pasta:

Crie um arquivo `.env` nesta pasta, baseado no `.env.example`:

```text
GROQ_API_KEY=gsk_sua_chave_aqui
GROQ_MODEL=qwen/qwen3-32b
GROQ_FALLBACK_MODEL=qwen/qwen3.6-27b
PORT=8787
```

Depois execute:

```powershell
node server.js
```

Depois abra `http://localhost:8787`.

O bot envia ao Qwen pelo Groq o ativo selecionado, tipo de trade, direcao, preco, variacao de 24h, timeframes LTF/MTF/HTF e os quatro pilares. A resposta e apenas um parecer de confluencia; nenhuma ordem e enviada.

Sem `GROQ_API_KEY`, o painel permanece em modo `OFFLINE` e mostra o motivo. A chave pode ser criada em console.groq.com/keys.
