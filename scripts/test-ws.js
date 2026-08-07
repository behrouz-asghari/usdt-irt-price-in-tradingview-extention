
const WS_URL = 'wss://ws.arzdigital.com/connection/websocket';
const CHANNEL = 'price:812';

const timeout = setTimeout(() => {
  console.log('❌ TIMEOUT: هیچ پاسخی از سرور دریافت نشد');
  process.exit(2);
}, 12000);

if (typeof WebSocket === 'undefined') {
  console.log('❌ این نسخه از Node WebSocket نیتیو ندارد (به Node 21+ ارتقا دهید)');
  process.exit(3);
}

const ws = new WebSocket(WS_URL);

ws.addEventListener('open', () => {
  console.log('✅ OPEN — بدون هدر Origin (undici)');
  ws.send(JSON.stringify({ id: 1, connect: {} }));
});

ws.addEventListener('message', (ev) => {
  let text;
  try {
    text = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
  } catch (e) {
    text = String(ev.data);
  }
  const parts = splitFrames(text);
  for (const part of parts) {
    let obj;
    try { obj = JSON.parse(part); } catch { continue; }

    if (obj.id === 1 && obj.connect) {
      console.log('🔌 CONNECT ACK:', JSON.stringify(obj.connect).slice(0, 140));
      ws.send(JSON.stringify({ id: 2, subscribe: { channel: CHANNEL } }));
    } else if (obj.id === 2) {
      console.log('✅ SUBSCRIBE ACK');
    } else if (obj.push && obj.push.pub && obj.push.pub.data) {
      const d = obj.push.pub.data;
      console.log('💰 PRICE: pirt=' + d.pirt + ' pusd=' + d.pusd + ' p24h=' + d.p24h);
      clearTimeout(timeout);
      process.exit(0);
    }
  }
});

ws.addEventListener('close', (e) => {
  console.log('❌ CLOSE code=' + e.code + ' reason=' + e.reason);
  process.exit(1);
});

ws.addEventListener('error', () => {
  console.log('⚠️ ERROR event');
});

function splitFrames(text) {
  const out = [];
  let buf = text;
  while (buf.length) {
    const i = buf.indexOf('{');
    if (i < 0) break;
    buf = buf.slice(i);
    let depth = 0, inS = false, esc = false, end = -1;
    for (let j = 0; j < buf.length; j++) {
      const c = buf[j];
      if (inS) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inS = false;
      } else if (c === '"') {
        inS = true;
      } else if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) { end = j + 1; break; }
      }
    }
    if (end < 0) break;
    out.push(buf.slice(0, end));
    buf = buf.slice(end);
  }
  return out;
}
