const clock = document.querySelector('#clock');
const toast = document.querySelector('#toast');
const refreshButton = document.querySelector('#refresh-button');
const executeButton = document.querySelector('#execute-button');
const selectedAsset = document.querySelector('#selected-asset');
const scoreValue = document.querySelector('#score-value');
const assetPrice = document.querySelector('#asset-price');
const assetChange = document.querySelector('#asset-change');
const analysisTime = document.querySelector('#analysis-time');
const refreshCountdown = document.querySelector('#refresh-countdown');
const refreshInterval = document.querySelector('#refresh-interval');
const entryZone = document.querySelector('#entry-zone');
const stopLoss = document.querySelector('#stop-loss');
const takeProfit = document.querySelector('#take-profit');
const riskReward = document.querySelector('#risk-reward');
const riskStatus = document.querySelector('#risk-status');
const entrySource = document.querySelector('#entry-source');
const aiRiskLevel = document.querySelector('#ai-risk-level');
const riskRing = document.querySelector('#risk-ring');
const chartAxis = document.querySelector('#chart-axis');
const chartArea = document.querySelector('#chart-area');
const chartLine = document.querySelector('#chart-line');
const chartPoint = document.querySelector('#chart-point');
const divergenceCard = document.querySelector('#divergence-card');
const divergenceTitle = document.querySelector('#divergence-title');
const divergenceSummary = document.querySelector('#divergence-summary');
const divergenceType = document.querySelector('#divergence-type');
const divergenceTimeframe = document.querySelector('#divergence-timeframe');
const riskModeLabel = document.querySelector('#risk-mode-label');
const regimeAsset = document.querySelector('#regime-asset');
const regimeValue = document.querySelector('#regime-value');
const regimeIcon = document.querySelector('#regime-icon');
const regimeAlignment = document.querySelector('#regime-alignment');
const regimeChange = document.querySelector('#regime-change');
const ltfRegime = document.querySelector('#ltf-regime');
const mtfRegime = document.querySelector('#mtf-regime');
const htfRegime = document.querySelector('#htf-regime');
const ltfLabel = document.querySelector('#ltf-label');
const mtfLabel = document.querySelector('#mtf-label');
const htfLabel = document.querySelector('#htf-label');
const aiButton = document.querySelector('#ai-button');
const aiState = document.querySelector('#ai-state');
const aiSummary = document.querySelector('#ai-summary');
const aiDetails = document.querySelector('#ai-details');
const aiSignalAlert = document.querySelector('#ai-signal-alert');
const aiSignalTitle = document.querySelector('#ai-signal-title');
const aiSignalMeta = document.querySelector('#ai-signal-meta');
const themeButton = document.querySelector('#theme-button');
const priceApi = 'https://fapi.binance.com/fapi/v1/ticker/24hr';
const marketPrices = new Map();
let selectedSymbol = 'BTCUSDT';
let selectedDirection = 'LONG';
let refreshIntervalSeconds = Number(window.localStorage.getItem('godbot-refresh-interval')) || 15;
let secondsToRefresh = refreshIntervalSeconds;
let activeTradeMode = 'scalp';
let latestAiRisk = null;
let latestAiAnalysis = null;
let analysisController = null;
let chartRequest = 0;
let chartInterval = '15m';
const tradeModes = {
  scalp: { label: 'SCALP', timeframe: '1m / 5m', layers: ['1m', '5m', '15m'], stop: 0.35, target: 1.05, scores: [88.4, 82.7, 86.1], directions: ['LONG', 'LONG', 'LONG'] },
  day: { label: 'DAY TRADE', timeframe: '15m / 1h', layers: ['15m', '1h', '4h'], stop: 1.38, target: 4.82, scores: [92.8, 84.1, 81.6], directions: ['LONG', 'LONG', 'SHORT'] },
  swing: { label: 'SWING TRADE', timeframe: '4h / 1D', layers: ['1h', '4h', '1D'], stop: 2.4, target: 7.2, scores: [89.6, 87.4, 83.2], directions: ['LONG', 'LONG', 'LONG'] },
  position: { label: 'POSITION TRADE', timeframe: '1D / 1W', layers: ['4h', '1D', '1W'], stop: 4.0, target: 12.0, scores: [86.2, 91.3, 79.8], directions: ['LONG', 'LONG', 'SHORT'] }
};

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.textContent = dark ? '☀' : '☾';
  themeButton.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
  themeButton.title = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
}

applyTheme(localStorage.getItem('godbot-theme') || 'light');
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('godbot-theme', theme);
  applyTheme(theme);
});

function updateClock() {
  const now = new Date();
  clock.textContent = `${now.toISOString().slice(11, 19)} UTC`;
  analysisTime.textContent = `Análise ao vivo / ${now.toISOString().slice(11, 16)} UTC`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

function renderMarketRegime(symbol = selectedSymbol) {
  if (latestAiAnalysis) {
    renderAiMarketRegime(latestAiAnalysis);
    return;
  }
  const ticker = marketPrices.get(symbol);
  const row = document.querySelector(`.signal-row[data-symbol="${symbol}"]`);
  if (!ticker || !row) return;

  const change = Number(ticker.priceChangePercent);
  const isLong = selectedDirection === 'LONG';
  const strength = Math.abs(change);
  const htf = change > 1 ? 'ACCUMULATION' : change < -1 ? 'DISTRIBUTION' : 'RANGE';
  const mtf = isLong ? (change >= -1 ? 'BULLISH' : 'RECOVERY') : (change <= 1 ? 'BEARISH' : 'EXHAUSTION');
  const ltf = isLong ? 'BUYING PRESSURE' : 'SELLING PRESSURE';
  const regime = htf === 'RANGE' ? 'RANGE' : isLong ? 'ACCUMULATION' : 'DISTRIBUTION';
  const asset = row.dataset.asset;
  const profile = tradeModes[activeTradeMode];

  regimeAsset.textContent = asset;
  regimeValue.textContent = regime;
  regimeIcon.textContent = regime === 'DISTRIBUTION' ? '↘' : regime === 'RANGE' ? '→' : '↗';
  regimeAlignment.textContent = `${profile.label} / MTF`;
  ltfLabel.textContent = `LTF / ${profile.layers[0]}`;
  mtfLabel.textContent = `MTF / ${profile.layers[1]}`;
  htfLabel.textContent = `HTF / ${profile.layers[2]}`;
  ltfRegime.textContent = ltf;
  mtfRegime.textContent = mtf;
  htfRegime.textContent = htf;
  regimeChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  regimeChange.className = change >= 0 ? 'positive' : 'negative';
  regimeValue.className = regime === 'DISTRIBUTION' ? 'negative' : regime === 'RANGE' ? '' : 'positive';
  regimeAlignment.title = `${asset} selecionado · força ${strength.toFixed(2)}% em 24h`;
}

function renderAiMarketRegime(result) {
  const row = document.querySelector(`.signal-row[data-symbol="${selectedSymbol}"]`);
  const ticker = marketPrices.get(selectedSymbol);
  const profile = tradeModes[activeTradeMode];
  if (!row) return;
  const marketRegime = String(result.market_regime).toUpperCase();
  regimeAsset.textContent = row.dataset.asset;
  regimeValue.textContent = marketRegime;
  regimeIcon.textContent = /DISTRIBUT|BEAR|BAIXA/.test(marketRegime) ? '↘' : /RANGE|LATERAL/.test(marketRegime) ? '→' : '↗';
  regimeAlignment.textContent = `${profile.label} / AI`;
  ltfLabel.textContent = `LTF / ${profile.layers[0]}`;
  mtfLabel.textContent = `MTF / ${profile.layers[1]}`;
  htfLabel.textContent = `HTF / ${profile.layers[2]}`;
  ltfRegime.textContent = result.ltf_regime;
  mtfRegime.textContent = result.mtf_regime;
  htfRegime.textContent = result.htf_regime;
  if (ticker) {
    const change = Number(ticker.priceChangePercent);
    regimeChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    regimeChange.className = change >= 0 ? 'positive' : 'negative';
  }
  regimeValue.className = /DISTRIBUT|BEAR|BAIXA/.test(marketRegime) ? 'negative' : 'positive';
}

function buildAiPayload() {
  const row = document.querySelector(`.signal-row[data-symbol="${selectedSymbol}"]`);
  const ticker = marketPrices.get(selectedSymbol);
  return {
    asset: row?.dataset.asset || selectedSymbol,
    mode: tradeModes[activeTradeMode].label,
    direction: selectedDirection,
    price: ticker ? Number(ticker.lastPrice) : null,
    change24h: ticker ? Number(ticker.priceChangePercent) : null,
    timeframes: tradeModes[activeTradeMode].layers,
    regimes: { ltf: ltfRegime.textContent, mtf: mtfRegime.textContent, htf: htfRegime.textContent },
    pillars: Array.from(document.querySelectorAll('.pillar-row')).map((pillar) => pillar.innerText)
  };
}

function renderAiRisk(result) {
  const values = [result.entry_low, result.entry_high, result.stop_loss, result.take_profit, result.risk_reward].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return false;
  const [entryLow, entryHigh, stop, target, ratio] = values;
  entryZone.textContent = `${formatPrice(entryLow)} — ${formatPrice(entryHigh)}`;
  stopLoss.innerHTML = `${formatPrice(stop)} <em>AI invalidation</em>`;
  takeProfit.innerHTML = `${formatPrice(target)} <em>AI liquidity target</em>`;
  riskReward.textContent = `1 : ${ratio.toFixed(1)}`;
  riskStatus.textContent = String(result.approval).toUpperCase() === 'APPROVED' ? 'approved' : 'blocked';
  riskStatus.className = String(result.approval).toUpperCase() === 'APPROVED' ? 'positive' : 'negative';
  entrySource.textContent = 'AI';
  const riskLevel = String(result.risk_level).toUpperCase();
  const riskLabels = { HIGH: 'ALTO', NEUTRAL: 'NEUTRO', LOW: 'BAIXO' };
  aiRiskLevel.textContent = riskLabels[riskLevel] || 'N/D';
  riskRing.className = `risk-ring risk-${riskLevel.toLowerCase()}`;
  return true;
}

function renderAiAnalysis(result) {
  aiState.textContent = 'ONLINE';
  aiState.classList.add('online');
  const row = document.querySelector(`.signal-row[data-symbol="${selectedSymbol}"]`);
  const asset = row?.dataset.asset || selectedSymbol;
  const direction = selectedDirection;
  aiSignalAlert.classList.add('active');
  aiSignalTitle.textContent = `Sinal ${direction} detectado · ${asset}`;
  aiSignalMeta.textContent = `${tradeModes[activeTradeMode].label} / convicção ${result.confidence}`;
  if (renderAiRisk(result)) latestAiRisk = result;
  latestAiAnalysis = result;
  renderAiMarketRegime(result);
  aiSummary.textContent = result.summary;
  aiDetails.innerHTML = `<div><strong>Convicção:</strong> ${result.confidence}</div><div><strong>Confirmação:</strong> ${result.confirmation}</div><div><strong>Risco:</strong> ${result.risk}</div>`;
  renderDivergence(result);
}

function renderDivergence(result) {
  const detected = result.divergence_detected === true;
  if (!detected) {
    divergenceCard.hidden = true;
    return;
  }
  const type = String(result.divergence_type || 'NONE').toUpperCase();
  divergenceCard.hidden = false;
  divergenceCard.className = `divergence-card ${type === 'BEARISH' ? 'bearish' : 'bullish'}`;
  divergenceTitle.textContent = `${type === 'BEARISH' ? 'Divergência bearish' : 'Divergência bullish'} detectada`;
  divergenceSummary.textContent = result.divergence_summary || 'A IA encontrou divergência entre preço e RSI.';
  divergenceType.textContent = type;
  divergenceTimeframe.textContent = String(result.divergence_timeframe || 'MTF').toUpperCase();
}

async function analyzeConfluences() {
  if (analysisController) analysisController.abort();
  const controller = new AbortController();
  analysisController = controller;
  aiButton.disabled = true;
  aiButton.innerHTML = 'Analisando confluências...';
  aiState.textContent = 'ANALYZING';
  let attempt = 0;
  try {
    while (!controller.signal.aborted) {
      attempt += 1;
      try {
        const response = await fetch('/api/ai-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildAiPayload()), signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha na análise');
        renderAiAnalysis(result);
        showToast(`Sinal ${selectedDirection} detectado em ${selectedSymbol}.`);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
        aiSummary.textContent = `Tentativa ${attempt}: aguardando resposta da IA...`;
        await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 700 + attempt * 300)));
      }
    }
  } finally {
    if (analysisController === controller) {
      analysisController = null;
      aiButton.disabled = false;
      aiButton.innerHTML = 'Analisar confluências <span>↗</span>';
    }
  }
}

function renderRiskProtocol(symbol = selectedSymbol) {
  const ticker = marketPrices.get(symbol);
  if (!ticker) {
    entryZone.textContent = 'Indisponível';
    stopLoss.textContent = 'Indisponível';
    takeProfit.textContent = 'Indisponível';
    return;
  }

  const price = Number(ticker.lastPrice);
  const isLong = selectedDirection === 'LONG';
  const entryLow = price * 0.9985;
  const entryHigh = price * 1.0015;
  const profile = tradeModes[activeTradeMode];
  const stop = price * (isLong ? 1 - profile.stop / 100 : 1 + profile.stop / 100);
  const target = price * (isLong ? 1 + profile.target / 100 : 1 - profile.target / 100);
  const riskDistance = Math.abs(price - stop);
  const rewardDistance = Math.abs(target - price);
  const ratio = rewardDistance / riskDistance;
  const approved = Number(ratio.toFixed(1)) >= 3;

  entryZone.textContent = `${formatPrice(entryLow)} — ${formatPrice(entryHigh)}`;
  stopLoss.innerHTML = `${formatPrice(stop)} <em>${isLong ? `-${profile.stop.toFixed(2)}%` : `+${profile.stop.toFixed(2)}%`}</em>`;
  takeProfit.innerHTML = `${formatPrice(target)} <em>${isLong ? `+${profile.target.toFixed(2)}%` : `-${profile.target.toFixed(2)}%`}</em>`;
  riskReward.textContent = `1 : ${ratio.toFixed(1)}`;
  riskStatus.textContent = approved ? 'approved' : 'blocked';
  riskStatus.className = approved ? 'positive' : 'negative';
}

function renderPrice(symbol) {
  const ticker = marketPrices.get(symbol);
  if (!ticker) {
    assetPrice.textContent = 'Indisponível';
    assetChange.className = '';
    assetChange.textContent = 'Cotação não disponível';
    return;
  }

  const change = Number(ticker.priceChangePercent);
  assetPrice.textContent = formatPrice(Number(ticker.lastPrice));
  assetChange.className = change >= 0 ? 'positive' : 'negative';
  assetChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% / 24h`;
  loadChart(symbol, chartInterval).catch(() => {
    if (symbol === selectedSymbol) showToast('Não foi possível atualizar o gráfico.');
  });
  renderMarketRegime(symbol);
  if (!latestAiRisk) renderRiskProtocol(symbol);
}

async function loadChart(symbol = selectedSymbol, interval = chartInterval) {
  const requestId = ++chartRequest;
  const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=80`);
  if (!response.ok) throw new Error(`Chart API returned ${response.status}`);
  const candles = await response.json();
  if (requestId !== chartRequest || !candles.length) return;
  const closes = candles.map((candle) => Number(candle[4]));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || max * 0.01 || 1;
  const points = closes.map((close, index) => {
    const x = (index / (closes.length - 1)) * 620;
    const y = 170 - ((close - min) / range) * 150;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L620 190 L0 190Z`;
  chartLine.setAttribute('d', line);
  chartArea.setAttribute('d', area);
  const [lastX, lastY] = points[points.length - 1];
  chartPoint.setAttribute('cx', lastX.toFixed(1));
  chartPoint.setAttribute('cy', lastY.toFixed(1));
  chartAxis.querySelectorAll('span').forEach((label, index) => {
    label.textContent = formatPrice(max - (range * index) / 3).replace('$', '');
  });
}

async function fetchMarketPrices() {
  const response = await fetch(`${priceApi}?symbols=[%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22]`);
  if (!response.ok) throw new Error(`Market API returned ${response.status}`);
  const tickers = await response.json();
  tickers.forEach((ticker) => marketPrices.set(ticker.symbol, ticker));
  renderPrice(selectedSymbol);
}

async function refreshMarketPrices(showFeedback = false) {
  try {
    await fetchMarketPrices();
    if (showFeedback) showToast('Cotações atualizadas agora.');
  } catch (error) {
    assetPrice.textContent = 'Indisponível';
    assetChange.className = '';
    assetChange.textContent = 'API de mercado indisponível';
    if (showFeedback) showToast('Não foi possível atualizar as cotações.');
  }
}

document.querySelectorAll('.signal-row').forEach((row) => {
  row.addEventListener('click', () => {
    document.querySelectorAll('.signal-row').forEach((item) => item.classList.remove('selected'));
    row.classList.add('selected');
    selectedSymbol = row.dataset.symbol;
    selectedDirection = row.querySelector('.direction').textContent;
    latestAiRisk = null;
    latestAiAnalysis = null;
    entrySource.textContent = 'RULES';
    aiRiskLevel.textContent = '--';
    riskRing.className = 'risk-ring';
    divergenceCard.hidden = true;
    selectedAsset.innerHTML = `${row.dataset.asset} <span class="live-pill">LIVE</span>`;
    scoreValue.textContent = row.querySelector('.signal-score strong').textContent;
    renderPrice(selectedSymbol);
    showToast(`${tradeModes[activeTradeMode].label}: protocolo recalculado para ${row.dataset.asset}.`);
    analyzeConfluences();
  });
});

document.querySelectorAll('.trade-mode').forEach((button) => {
  button.addEventListener('click', () => {
    activeTradeMode = button.dataset.mode;
    const profile = tradeModes[activeTradeMode];
    latestAiRisk = null;
    latestAiAnalysis = null;
    entrySource.textContent = 'RULES';
    aiRiskLevel.textContent = '--';
    riskRing.className = 'risk-ring';
    divergenceCard.hidden = true;
    document.querySelectorAll('.trade-mode').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    document.querySelector('#trade-mode-label').textContent = profile.label;
    riskModeLabel.textContent = profile.label;
    ltfLabel.textContent = `LTF / ${profile.layers[0]}`;
    mtfLabel.textContent = `MTF / ${profile.layers[1]}`;
    htfLabel.textContent = `HTF / ${profile.layers[2]}`;
    document.querySelectorAll('.signal-row').forEach((row, index) => {
      const direction = profile.directions[index];
      row.querySelector('.direction').textContent = direction;
      row.querySelector('.direction').className = `direction ${direction.toLowerCase()}`;
      row.querySelector('.signal-score strong').textContent = profile.scores[index].toFixed(1);
      row.querySelector('.asset-name small').textContent = `${row.dataset.assetName} / ${profile.timeframe}`;
    });
    selectedDirection = document.querySelector('.signal-row.selected .direction').textContent;
    scoreValue.textContent = document.querySelector('.signal-row.selected .signal-score strong').textContent;
    renderMarketRegime();
    renderRiskProtocol();
    showToast(`${profile.label} selecionado: ${profile.timeframe}.`);
    analyzeConfluences();
  });
});

aiButton.addEventListener('click', analyzeConfluences);

document.querySelectorAll('.mode-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.mode-button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    showToast(button.dataset.mode === 'live' ? 'Modo live ativado.' : 'Replay disponível após a sessão atual.');
  });
});

document.querySelectorAll('.time-tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.time-tabs button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    chartInterval = button.dataset.interval;
    loadChart(selectedSymbol, chartInterval).catch(() => showToast('Não foi possível atualizar o gráfico.'));
    showToast(`Timeframe ${button.textContent} selecionado.`);
  });
});

refreshInterval.value = String(refreshIntervalSeconds);
refreshInterval.addEventListener('change', () => {
  refreshIntervalSeconds = Number(refreshInterval.value);
  secondsToRefresh = refreshIntervalSeconds;
  window.localStorage.setItem('godbot-refresh-interval', String(refreshIntervalSeconds));
  refreshCountdown.textContent = `${secondsToRefresh}s`;
  showToast(`Atualização automática a cada ${refreshIntervalSeconds}s.`);
});

refreshButton.addEventListener('click', () => {
  refreshButton.disabled = true;
  refreshButton.innerHTML = '<span>↻</span> Analisando...';
  refreshMarketPrices(true).finally(() => {
    refreshButton.disabled = false;
    refreshButton.innerHTML = '<span>↻</span> Atualizar análise';
  });
});

executeButton.addEventListener('click', () => {
  renderPrice(selectedSymbol);
  executeButton.textContent = `Protocolo ${tradeModes[activeTradeMode].label} gerado`;
  showToast(`Protocolo ${tradeModes[activeTradeMode].label} gerado para ${selectedSymbol}. Nenhuma ordem foi enviada.`);
  window.setTimeout(() => {
    executeButton.innerHTML = 'Gerar protocolo <span>↗</span>';
  }, 2400);
});

updateClock();
refreshMarketPrices();
window.setInterval(updateClock, 1000);
window.setInterval(() => {
  secondsToRefresh -= 1;
  refreshCountdown.textContent = `${secondsToRefresh}s`;
  if (secondsToRefresh <= 0) {
    secondsToRefresh = refreshIntervalSeconds;
    refreshMarketPrices();
  }
}, 1000);
