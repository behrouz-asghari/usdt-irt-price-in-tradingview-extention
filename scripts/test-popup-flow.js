'use strict';

// Regression test for the popup socket-data bug.
//
// In Chrome, `chrome.runtime.Port.onMessage` is an Event and MUST be listened
// to with `port.onMessage.addListener(fn)`. The old code assigned a plain
// function (`port.onMessage = fn`), which silently registered nothing — so the
// popup never received price data even though the content script socket worked.
//
// This script loads the REAL background.js and popup.js with a mocked `chrome`
// API, simulates the TradingView content script pushing a price, and asserts
// the popup actually renders it. With the old broken code these assertions
// fail (price stays "—").

const assert = require('assert');

// ---------------- Minimal DOM ----------------
const elements = new Map();
function makeEl(id) {
  const el = {
    id,
    textContent: '',
    className: '',
    checked: false,
    classList: {
      _state: {},
      add() {},
      remove() {},
      toggle(name, force) {
        this._state[name] = force === undefined ? !this._state[name] : force;
      },
    },
    addEventListener() {},
  };
  return el;
}

global.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  },
};

// ---------------- Chrome mock ----------------
// One logical port = two ends ({a, b}). Messages posted on one end are
// delivered asynchronously (like the real browser) to listeners registered on
// the other end. Posts made before the peer registers a listener are queued
// and flushed on registration — mirroring real Chrome's ordered delivery.
function createPortPair(name) {
  const a = { name, handlers: [], queue: [] };
  const b = { name, handlers: [], queue: [] };
  const event = (port) => ({
    addListener(fn) {
      port.handlers.push(fn);
      const queued = port.queue.splice(0);
      queued.forEach((m) => setTimeout(() => fn(m), 0));
    },
  });
  a.onMessage = event(a);
  b.onMessage = event(b);
  a.onDisconnect = event(a);
  b.onDisconnect = event(b);
  a.postMessage = (m) =>
    b.handlers.length
      ? b.handlers.slice().forEach((fn) => setTimeout(() => fn(m), 0))
      : b.queue.push(m);
  b.postMessage = (m) =>
    a.handlers.length
      ? a.handlers.slice().forEach((fn) => setTimeout(() => fn(m), 0))
      : a.queue.push(m);
  return { a, b };
}

const onConnectListeners = [];

global.chrome = {
  runtime: {
    connect({ name }) {
      const pair = createPortPair(name);
      // The background receives the other end, asynchronously like Chrome.
      onConnectListeners.slice().forEach((fn) => setTimeout(() => fn(pair.b), 0));
      return pair.a;
    },
    onConnect: { addListener: (fn) => onConnectListeners.push(fn) },
    onMessage: { addListener() {} },
    sendMessage() {},
  },
  storage: {
    sync: {
      get(defaults, cb) {
        cb(defaults);
      },
      set() {},
    },
    onChanged: { addListener() {} },
  },
  tabs: { create() {} },
};

// ---------------- Load the real extension scripts ----------------
require('../background.js');
require('../popup.js');

const priceEl = document.getElementById('price');
const usdEl = document.getElementById('usd');
const chgEl = document.getElementById('chg');
const chg24El = document.getElementById('chg24');
const timeEl = document.getElementById('time');
const stateBadge = document.getElementById('state-badge');
const hintEl = document.getElementById('hint');

const tick = () => new Promise((r) => setTimeout(r, 25));

async function main() {
  // Simulate the TradingView content script: it connects and, on the first
  // price, posts ws-state "live" followed by the price (same order as content.js).
  const contentPort = chrome.runtime.connect({ name: 'usdt' });
  // Like content.js, the simulated content page listens on its port (no-op),
  // so background broadcasts to it are consumed instead of being queued.
  contentPort.onMessage.addListener(() => {});
  contentPort.postMessage({ type: 'ws-state', state: 'live', error: null });
  contentPort.postMessage({
    type: 'price',
    data: {
      id: '812',
      toman: 186059.97,
      usd: 0.9991353146082637,
      chg24h: -0.08892807665957791,
      chg7d: -3.558588323954981,
      marketCap: 183369155734.39,
      volume: 46838866870.65,
      ts: '2026-08-07T14:45:22.518Z',
    },
  });

  await tick();

  console.log(
    (priceEl.textContent !== '—' ? '✅' : '❌') +
      ' popup قیمت را از سوکت دریافت کرد (price ≠ —)',
  );
  assert.notStrictEqual(priceEl.textContent, '—', 'popup باید قیمت را از سوکت دریافت کند');
  assert.strictEqual(priceEl.textContent, '۱۸۶٬۰۶۰', 'قیمت تومان باید با فرمت فارسی نمایش داده شود');
  assert.strictEqual(usdEl.textContent, '۰٫۹۹۹', 'قیمت دلار باید نمایش داده شود');
  assert.strictEqual(chg24El.textContent, '−۸٫۸۹٪', 'تغییر ۲۴ ساعته باید نمایش داده شود');
  assert.strictEqual(chgEl.textContent, '−۸٫۸۹٪', 'چرخه تغییر باید نمایش داده شود');
  assert.strictEqual(chgEl.classList._state.down, true, 'تغییر منفی باید حالت down داشته باشد');
  assert.notStrictEqual(timeEl.textContent, '—', 'زمان آخرین بهروزرسانی باید نمایش داده شود');
  assert.strictEqual(stateBadge.textContent, 'زنده', 'وضعیت باید «زنده» باشد');
  assert.strictEqual(hintEl.classList._state.hidden, true, 'هنگام اتصال زنده، hint باید مخفی شود');

  console.log('\n🎉 تست جریان پیام popup موفق بود — popup دادهی سوکت را دریافت میکند.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ ' + err.message);
  console.log('\n⚠️ با کد قبلی (`port.onMessage = fn`) همین تست ناموفق بود.');
  process.exit(1);
});
