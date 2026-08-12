(() => {
  "use strict";

  const CHANNEL = "price:812";
  const WS_URL = "wss://ws.arzdigital.com/connection/websocket";
  const PING_MS = 25000;
  const MAX_RETRY_MS = 30000;
  const WIDGET_SELECTOR = '[data-test-id-widget-type="watchlist"]';
  const ICON_URL = chrome.runtime.getURL("icons/icon32.png");


  const Parser = window.CentrifugoParser;

  let ws = null;
  let pingTimer = null;
  let reconnectTimer = null;
  let retryDelay = 1000;
  let port = null;
  let strip = null;
  let lastToman = null;
  let enabled = true;

  const fa = (v, opts) => new Intl.NumberFormat("fa-IR", opts || {}).format(v);

  function formatToman(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    const decimals = v >= 10000 ? 0 : v >= 10 ? 2 : 3;
    return fa(v, { maximumFractionDigits: decimals });
  }

  function formatPct(value) {
    if (value === null || value === undefined || isNaN(value)) return "—";

    const text = fa(Math.abs(value), { maximumFractionDigits: 2 });

    return (value >= 0 ? "+" : "−") + text + "٪";
  }

  function formatBig(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return fa(v, { notation: "compact", maximumFractionDigits: 1 });
  }

  function faNum(v) {
    return v === null || v === undefined || isNaN(v) ? "—" : fa(v);
  }

function buildStrip() {
  const el = document.createElement("div");

  el.className = "usdt-live-strip";
  el.dir = "rtl";
  el.innerHTML =
    '<img class="usdt-logo" src="' + ICON_URL + '" alt="" aria-hidden="true" />' +
    '<span class="usdt-name">' +
    '  <span class="usdt-name-main">تتر <span class="usdt-ticker">USDT</span></span>' +
    "</span>" +
    '<span class="usdt-price-wrap">' +
    '  <span class="usdt-price" data-part="price">—</span>' +
    '  <span class="usdt-currency">تومان</span>' +
    "</span>" +
    '<span class="usdt-chg" data-part="chg">—</span>' +
    '<span class="usdt-status"><span class="usdt-dot"></span><span data-part="status">در حال اتصال…</span></span>' +
    '<span class="usdt-time" data-part="time"></span>' +
    '<div class="usdt-tooltip" data-part="tooltip"></div>';

  return el;
}



  function q(part) {
    return strip ? strip.querySelector('[data-part="' + part + '"]') : null;
  }

  function setState(s, errorText) {
    if (errorText) console.warn("[USDT-Live]", errorText);
    if (strip) {
      strip.classList.toggle("live", s === "live");
      const st = q("status");
      if (st) {
        st.textContent =
          s === "live"
            ? "زنده"
            : s === "connecting"
              ? "در حال اتصال…"
              : "قطع اتصال";
      }
    }
    if (port) {
      try {
        port.postMessage({
          type: "ws-state",
          state: s,
          error: errorText || null,
        });
      } catch (e) {}
    }
  }

  function updateStrip(d) {
    if (!strip) return;
    const priceEl = q("price");
    const chgEl = q("chg");
    const timeEl = q("time");
    const prev = lastToman;
    lastToman = d.toman;

    if (priceEl) priceEl.textContent = formatToman(d.toman);

    if (chgEl && d.chg24h !== null && d.chg24h !== undefined) {
      chgEl.textContent = formatPct(d.chg24h);
      chgEl.classList.toggle("down", d.chg24h < 0);
      chgEl.classList.toggle("up", d.chg24h >= 0);
    }

    if (timeEl && d.ts) {
      const t = new Date(d.ts);
      if (!isNaN(t.getTime())) {
        timeEl.textContent = t.toLocaleTimeString("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    if (prev !== null && d.toman !== null && d.toman !== prev && strip) {
      const up = d.toman > prev;
      if (priceEl) {
        priceEl.classList.remove("tick-up", "tick-down");
        void priceEl.offsetWidth;
        priceEl.classList.add(up ? "tick-up" : "tick-down");
      }
      strip.classList.remove("flash-up", "flash-down");
      void strip.offsetWidth;
      strip.classList.add(up ? "flash-up" : "flash-down");
    }

const tooltipEl = q("tooltip");

if (tooltipEl) {
  tooltipEl.innerHTML =
    '<div class="usdt-tooltip-title">جزئیات بیشتر<span>USDT</span></div>' +
    '<div class="usdt-tooltip-row"><span>تومان</span><strong>' + formatToman(d.toman) + '</strong></div>' +
    '<div class="usdt-tooltip-row"><span>دلار</span><strong>' + faNum(d.usd) + '</strong></div>' +
    '<div class="usdt-tooltip-row"><span>تغییر ۲۴ساعته</span><strong>' + formatPct(d.chg24h) + '</strong></div>' +
    '<div class="usdt-tooltip-row"><span>تغییر ۷روزه</span><strong>' + formatPct(d.chg7d) + '</strong></div>' +
    '<div class="usdt-tooltip-row"><span>ارزش بازار</span><strong>' + formatBig(d.marketCap) + '</strong></div>' +
    '<div class="usdt-tooltip-row"><span>حجم ۲۴ساعته</span><strong>' + formatBig(d.volume) + '</strong></div>' +
    '<div class="usdt-tooltip-footer">آخرین به‌روزرسانی: ' +
      (d.ts ? new Date(d.ts).toLocaleString("fa-IR") : "—") +
    '</div>';
}

  }

  function connectSocket() {
    clearTimeout(reconnectTimer);
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    )
      return;
    try {
      Parser.reset();
    } catch (e) {}
    setState("connecting");

    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      scheduleReconnect("خطا در ساخت WebSocket: " + e.message);
      return;
    }

    ws.onopen = () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send("{}"); // heartbeat Centrifugo
      }, PING_MS);
      ws.send(JSON.stringify({ id: 1, connect: {} }));
    };

    ws.onmessage = (ev) => {
      const raw =
        typeof ev.data === "string"
          ? ev.data
          : new TextDecoder().decode(ev.data);
      let events = [];
      try {
        events = Parser.parseChunk(raw);
      } catch (e) {
        return;
      }
      for (const frame of events) handleFrame(frame);
    };

    ws.onclose = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      ws = null;
      setState("error", "اتصال بسته شد؛ تلاش مجدد…");
      scheduleReconnect("اتصال بسته شد");
    };

    ws.onerror = () => {
      setState("error", "خطا در اتصال به سوکت");
    };
  }

  function handleFrame(frame) {
    if (!frame || typeof frame !== "object") return;
    const send = (obj) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    };

    if (frame.id === 1 && frame.connect) {
      if (frame.connect.error) {
        scheduleReconnect(
          "خطای connect: " + JSON.stringify(frame.connect.error),
        );
        return;
      }
      send({ id: 2, subscribe: { channel: CHANNEL } });
      return;
    }

    if (frame.id === 2) {
      if (frame.subscribe && frame.subscribe.error) {
        scheduleReconnect(
          "خطای subscribe: " + JSON.stringify(frame.subscribe.error),
        );
        return;
      }
      retryDelay = 1000;
      return;
    }

    if (frame.push) {
      const ch = frame.push.channel || "";
      const data = frame.push.pub && frame.push.pub.data;
      if (ch === CHANNEL && data) {
        const norm = Parser.normalizePrice(data);
        if (norm) onPrice(norm);
      }
      return;
    }

    if (frame.error) scheduleReconnect("خطا: " + JSON.stringify(frame.error));
  }

  function onPrice(d) {
    retryDelay = 1000;
    setState("live");
    updateStrip(d);
    if (port) {
      try {
        port.postMessage({ type: "price", data: d });
      } catch (e) {}
    }
  }

  function scheduleReconnect(reason) {
    clearTimeout(reconnectTimer);
    const delay = retryDelay;
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    console.warn(
      "[USDT-Live] اتصال مجدد تا " + Math.round(delay / 1000) + " ثانیه دیگر —",
      reason || "",
    );
    reconnectTimer = setTimeout(connectSocket, delay);
  }

  function closeSocket() {
    clearTimeout(reconnectTimer);
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
      ws = null;
    }
    setState("idle");
  }

  function injectStrip() {
    const widget = document.querySelector(WIDGET_SELECTOR);
    if (!widget) return;
    if (strip && strip.isConnected) return;
    if (!strip) strip = buildStrip();

    const header = widget.querySelector('[class*="widgetHeader"]');
    if (header && header.parentNode === widget) {
      header.after(strip);
    } else {
      widget.prepend(strip);
    }
    strip.classList.toggle("usdt-hidden", !enabled);
  }

  let pendingInject = false;
  const observer = new MutationObserver(() => {
    if (pendingInject) return;
    pendingInject = true;
    requestAnimationFrame(() => {
      pendingInject = false;
      injectStrip();
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: "usdt" });
    } catch (e) {
      port = null;
    }
    if (!port) return;
    port.onMessage.addListener(() => {});
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connectPort, 3000);
    });
  }

  chrome.storage.sync.get({ usdtEnabled: true }, (r) => {
    enabled = r.usdtEnabled !== false;
    if (strip) strip.classList.toggle("usdt-hidden", !enabled);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.usdtEnabled) return;
    enabled = changes.usdtEnabled.newValue !== false;
    if (strip) strip.classList.toggle("usdt-hidden", !enabled);
    if (enabled) connectSocket();
    else closeSocket();
  });

  injectStrip();
  connectPort();
  connectSocket();
})();
