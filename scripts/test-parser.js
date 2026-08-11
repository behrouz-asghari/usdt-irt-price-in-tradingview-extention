
'use strict';

require('../lib/centrifugo.js');
const Parser = global.CentrifugoParser;

let failed = 0;

function ok(name, cond) {
  console.log((cond ? '✅' : '❌') + ' ' + name);
  if (!cond) failed++;
}

const chunk1 =
  '{"push":{"channel":"price:812","pub":{"data":{"id":"812","d":8.2858,"fmc":188971634240.56,' +
  '"fmc24h":0.023211555109,"mc":183384575149.24,"mc24h":-0.002970576297,' +
  '"pirt":"186356.23553352981168","p1h":0.008552731329,"p24h":0.023211555109,' +
  '"p7d":0.057127046188,"p30d":0.048462645246,"p3m":-0.045028528444,"p1y":-0.095807138075,' +
  '"pytd":0.0592,"pall":-17.421142796385,"pirt1h":0.16755735203211053,' +
  '"pirt24h":-0.08892807665957791,"pirt7d":-3.558588323954981,"pirt30d":3.7283780617047624,' +
  '"pirt3m":5.5887367074231475,"pirt1y":103.87825964584701,"pirtytd":37.719609884524544,' +
  '"pirtall":0,"v":46838866870.65,"v24h":-0.628788021157,"pusd":0.999336312384866,' +
  '"t":"2026-08-07T14:45:22.721Z"}}}} {"push":{"channel":"price:812","pub":{"data":{"id":"812",' +
  '"fmc24h":0.014801363616,"mc":183369155734.39,"pirt":"186340.56625434428136",' +
  '"p24h":0.014801363616,"p7d":0.048714002998,"p30d":0.04005033058,"p3m":-0.053432982148,' +
  '"p1y":-0.104207322191,"pytd":0.077373972143,"pall":-17.428086224731,"pirt1h":0,' +
  '"pirt24h":-0.09732883918341928,"pirt7d":-3.5666973491257914,"pirt30d":3.7196563309257247,' +
  '"pirt3m":5.5798585532277345,"pirt1y":103.8611170728557,"pirtytd":37.744624199585886,' +
  '"pirtall":0,"pusd":0.999252285791207,"t":"2026-08-07T14:45:22.518Z"}}}}';

const ev1 = Parser.parseChunk(chunk1);
ok('تست ۱: دو فریم بدون \\n جدا شدند', ev1.length === 2);
ok('تست ۱: قیمت تومان فریم اول', ev1[0] && ev1[0].push.pub.data.pirt === '186356.23553352981168');
ok('تست ۱: قیمت تومان فریم دوم', ev1[1] && ev1[1].push.pub.data.pirt === '186340.56625434428136');

const cut = chunk1.length - 40;
const a = chunk1.slice(0, cut);
const b = chunk1.slice(cut);
const ev2a = Parser.parseChunk(a);
const ev2b = Parser.parseChunk(b);
const total2 = ev2a.length + ev2b.length;
ok('تست ۲: فریم وسط دو پیام ناقص بود و بعد کامل شد', total2 === 2);
ok('تست ۲: خروجی نهایی سالم است', ev2a.concat(ev2b).every((e) => e && e.push && e.push.pub));

const norm = Parser.normalizePrice({
  id: '812', pirt: '186059.97742166547448', pusd: 0.9991353146082637,
  pirt24h: 0.016256221992, mc: 183369155734.39, v: 46838866870.65,
  t: '2026-08-07T14:45:22.518Z'
});
ok('تست ۳: normalizePrice → toman', norm.toman === 186059.97742166547448);
ok('تست ۳: normalizePrice → chg24h', norm.chg24h === 0.016256221992);
ok('تست ۳: normalizePrice → usd', norm.usd === 0.9991353146082637);

const ev4 = Parser.parseChunk(
  '{"id":1,"connect":{}} {"id":1,"connect":{"client":"99e42487-8df1-46cd-a0d3-713dbfd34ffa","version":"6.4.0 OSS","ping":25,"pong":true}} {"id":2,"subscribe":{"channel":"price:812"}} {"id":2,"subscribe":{}}'
);
ok('تست ۴: چهار فریم handshake', ev4.length === 4);
ok('تست ۴: ping مقدار', ev4[1] && ev4[1].connect.ping === 25);

console.log(failed === 0 ? '\n🎉 همه‌ی تست‌ها موفق بودند.' : '\n⚠️ ' + failed + ' تست ناموفق.');
process.exit(failed === 0 ? 0 : 1);
