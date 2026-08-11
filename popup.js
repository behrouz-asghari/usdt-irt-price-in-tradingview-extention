'use strict';

const $ = (id) => document.getElementById(id);

const stateBadge = $('state-badge');
const priceEl = $('price');
const chgEl = $('chg');
const usdEl = $('usd');
const chg24El = $('chg24');
const timeEl = $('time');
const hintEl = $('hint');

const fa = (v, opts) => new Intl.NumberFormat('fa-IR', opts || {}).format(v);
const faNum = (v) => (v === null || v === undefined || isNaN(v)) ? '—' : fa(v);

function formatToman(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const decimals = v >= 10000 ? 0 : (v >= 10 ? 2 : 3);
  return fa(v, { maximumFractionDigits: decimals });
}


  function formatPct(value) {
    if (value === null || value === undefined || isNaN(value)) return "—";

    const text = fa(Math.abs(value), { maximumFractionDigits: 2 });

    return (value >= 0 ? "+" : "−") + text + "٪";
  }

function renderPrice(d) {
  priceEl.textContent = formatToman(d && d.toman);
  usdEl.textContent = faNum(d && d.usd);
  chg24El.textContent = formatPct(d && d.chg24h);
console.log("--------",d)
  if (d && d.chg24h !== null && d.chg24h !== undefined) {

        chgEl.textContent = formatPct(d.chg24h);
        chgEl.classList.toggle("up", d.chg24h >= 0);
      chgEl.classList.toggle("down", d.chg24h < 0);
  } else {
    chgEl.textContent = '—';
    chgEl.classList.remove('up', 'down');
  }

  if (d && d.ts) {
    const t = new Date(d.ts);
    timeEl.textContent = isNaN(t.getTime()) ? '—' : t.toLocaleString('fa-IR');
  } else {
    timeEl.textContent = '—';
  }
}

function renderStatus(state) {
  stateBadge.textContent =
    state === 'live' ? 'زنده' :
    state === 'connecting' ? 'در حال اتصال' :
    state === 'error' ? 'قطع اتصال' : 'غیرفعال';
  stateBadge.className = 'badge ' + (state || 'idle');
  hintEl.classList.toggle('hidden', state === 'live');
}

const port = chrome.runtime.connect({ name: 'usdt' });
port.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === 'price') renderPrice(msg.data);
  else if (msg.type === 'status') {
    renderStatus(msg.state);
    if (msg.data) renderPrice(msg.data);
  }
});
port.postMessage({ type: 'get-status' });

chrome.storage.sync.get({ usdtEnabled: true }, (r) => {
  $('toggle').checked = r.usdtEnabled !== false;
});
$('toggle').addEventListener('change', (e) => {
  chrome.storage.sync.set({ usdtEnabled: e.target.checked });
});

$('open-tv').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.tradingview.com/chart/' });
  window.close();
});
