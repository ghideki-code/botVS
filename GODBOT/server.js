const http = require('http');
const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

loadLocalEnv();
const port = Number(process.env.PORT || 8787);
const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const fallbackModel = process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant';
const emergencyModel = 'openai/gpt-oss-20b';
const inferenceUrl = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const root = __dirname;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function buildPrompt(data) {
  return `Você é um analista quantitativo rigoroso de cripto. Analise TODOS os dados deste setup sem prometer lucro. Calcule o protocolo de execução, classifique o regime da moeda nas três camadas e verifique divergência entre preço e RSI. Só marque divergência como true se houver evidência nos dados; não invente valores de RSI. Responda SOMENTE JSON válido, sem markdown, com exatamente estas chaves: summary, confidence, confirmation, risk, risk_level, market_regime, ltf_regime, mtf_regime, htf_regime, divergence_detected, divergence_type, divergence_timeframe, divergence_summary, entry_low, entry_high, stop_loss, take_profit, risk_reward, approval. risk_level deve ser HIGH, NEUTRAL ou LOW; divergence_detected deve ser boolean; divergence_type deve ser BULLISH, BEARISH ou NONE; approval deve ser APPROVED ou BLOCKED. Os campos numéricos devem ser números. Se não houver dados suficientes para RSI, use divergence_detected false, divergence_type NONE e explique isso em divergence_summary. Seja conciso.\n\nDados: ${JSON.stringify(data)}`;
}

function parseModelJson(text) {
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```json\s*|\s*```$/g, '').trim();
  const start = cleanText.indexOf('{');
  const end = cleanText.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('O Qwen não retornou um JSON de análise válido.');
  return JSON.parse(cleanText.slice(start, end + 1));
}

async function requestQwen(modelName, data) {
  const body = { model: modelName, messages: [{ role: 'user', content: buildPrompt(data) }], temperature: 0.2, max_tokens: 900 };
  if (modelName === 'qwen/qwen3.6-27b') body.reasoning_effort = 'none';
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada. Crie uma chave gratuita no Groq.');
  }

  const response = await fetch(inferenceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || payload.error || 'O Groq recusou a análise.');
  const message = payload.choices?.[0]?.message;
  const text = message?.content || message?.reasoning;
  if (!text) throw new Error('O Qwen não retornou um parecer legível.');
  const result = parseModelJson(text);
  const numericFields = ['entry_low', 'entry_high', 'stop_loss', 'take_profit', 'risk_reward'];
  if (numericFields.some((field) => !Number.isFinite(Number(result[field])))) {
    throw new Error(`O modelo ${modelName} não retornou níveis completos de Entry, Stop Loss e Take Profit.`);
  }
  const regimeFields = ['market_regime', 'ltf_regime', 'mtf_regime', 'htf_regime'];
  if (regimeFields.some((field) => !String(result[field] || '').trim())) {
    throw new Error(`O modelo ${modelName} não retornou os regimes LTF, MTF e HTF.`);
  }
  if (!['HIGH', 'NEUTRAL', 'LOW'].includes(String(result.risk_level).toUpperCase())) {
    throw new Error(`O modelo ${modelName} não retornou um nível de risco válido.`);
  }
  return result;
}

async function analyzeWithQwen(data) {
  try {
    return await requestQwen(model, data);
  } catch (error) {
    const canTryFallback = /rate limit|tokens per day|TPD|níveis completos|regimes|nível de risco|failed to generate json|does not exist|do not have access|parecer legível/i.test(error.message);
    if (!canTryFallback) throw error;
    try {
      return await requestQwen(fallbackModel, data);
    } catch (fallbackError) {
      if (fallbackModel === emergencyModel) throw fallbackError;
      return await requestQwen(emergencyModel, data);
    }
  }
}

function serveFile(request, response) {
  const requested = new URL(request.url, `http://${request.headers.host}`).pathname;
  const filePath = path.resolve(root, requested === '/' ? 'index.html' : `.${requested}`);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); response.end(); return; }
  if (request.method === 'POST' && request.url === '/api/ai-analysis') {
    try { sendJson(response, 200, await analyzeWithQwen(JSON.parse(await readBody(request)))); }
    catch (error) { sendJson(response, 503, { error: error.message }); }
    return;
  }
  if (request.method === 'GET') { serveFile(request, response); return; }
  response.writeHead(405); response.end('Method not allowed');
});

server.listen(port, () => console.log(`GODBOT em http://localhost:${port} usando Qwen (${model})`));
