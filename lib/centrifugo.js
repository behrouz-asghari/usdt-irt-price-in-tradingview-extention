(function (global) {
  "use strict";

  var buffer = "";

  function parseChunk(chunk) {
    buffer += chunk;
    var events = [];
    var n = buffer.length;
    var i = 0;

    while (i < n) {
      while (i < n && /\s/.test(buffer[i])) i++;
      if (i >= n) break;

      if (buffer[i] !== "{") {
        i++;
        continue;
      }

      var depth = 0,
        j = i,
        inString = false,
        esc = false,
        complete = false;
      for (; j < n; j++) {
        var c = buffer[j];
        if (inString) {
          if (esc) esc = false;
          else if (c === "\\") esc = true;
          else if (c === '"') inString = false;
        } else if (c === '"') {
          inString = true;
        } else if (c === "{") {
          depth++;
        } else if (c === "}") {
          depth--;
          if (depth === 0) {
            j++;
            complete = true;
            break;
          }
        }
      }

      if (!complete) break;

      var text = buffer.slice(i, j);
      try {
        events.push(JSON.parse(text));
      } catch (e) {
        console.info(" Ignore the corrupted frame ")
      }
      i = j;
    }

    buffer = buffer.slice(i);
    return events;
  }

  function toNum(v) {
    if (v === null || v === undefined || v === "") return null;
    var x = parseFloat(v);
    return isNaN(x) ? null : x;
  }

  function normalizePrice(data) {
    if (!data || typeof data !== "object") return null;
    return {
      id: data.id,
      toman: toNum(data.pirt),
      usd: toNum(data.pusd),
      chg24h: toNum(data.pirt24h),
      chg7d: toNum(data.pirt7d),
      chg30d: toNum(data.pirt30d),
      marketCap: toNum(data.mc),
      volume: toNum(data.v),
      ts: data.t || null,
    };
  }

  function reset() {
    buffer = "";
  }

  global.CentrifugoParser = {
    parseChunk: parseChunk,
    normalizePrice: normalizePrice,
    reset: reset,
  };
})(typeof window !== "undefined" ? window : globalThis);
