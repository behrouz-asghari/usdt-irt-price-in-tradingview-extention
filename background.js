
'use strict';

const CHANNEL = 'price:812';

let lastData = null;
let lastError = null;
let state = 'idle'; // idle | connecting | live | error
const ports = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'usdt') return;
  ports.add(port);

  port.postMessage({ type: 'status', state, data: lastData, error: lastError });

  port.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'price') {
      lastData = msg.data;
      state = 'live';
      lastError = null;
      broadcast({ type: 'price', data: msg.data });
    } else if (msg.type === 'ws-state') {
      state = msg.state;
      if (msg.error) lastError = msg.error;
      broadcast({ type: 'status', state, data: lastData, error: lastError });
    } else if (msg.type === 'get-status') {
      port.postMessage({ type: 'status', state, data: lastData, error: lastError });
    }
  });

  port.onDisconnect.addListener(() => ports.delete(port));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === 'get-status') {
    sendResponse({ state, data: lastData, error: lastError, channel: CHANNEL });
  }
});

function broadcast(payload) {
  for (const p of ports) {
    try { p.postMessage(payload); } catch (e) { ports.delete(p); }
  }
}
