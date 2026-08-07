/* lib/centrifugo.js
   ------------------------------------------------------------------
   پارسر سبک پروتکل Centrifugo برای دریافت قیمت زنده ArzDigital:

   1) جدا کردن فریم‌های JSON که پشت سر هم و بدون \n می‌آیند.
      نمونه واقعی (از لاگ کاربر):
        {...pusd:0.9993...}} {"push":{...}} {...}
      → با شمارش آکولاد (با رعایت رشته‌ها) هر فریم کامل جدا می‌شود.
      این دقیقاً همان دلیلی است که پارس قبلی خراب بود و قیمت «—» می‌آمد.

   2) نرمال‌سازی دیتای کانال price:812 (تتر):
      - pirt : قیمت به تومان  (مثلاً "186059.97742166547448")
      - pusd : قیمت به دلار  (~0.999)
      - p24h : نسبت تغییر ۲۴ ساعته (0.0162 یعنی +1.62%)
*/

(function (global) {
  'use strict';

  var buffer = '';

  /**
   * قطعه‌ی جدید (شاید چند فریم) را می‌گیرد و آرایه‌ای از آبجکت‌های کامل برمی‌گرداند.
   * فریم ناقص داخل بافر می‌ماند تا با پیام بعدی کامل شود.
   */
  function parseChunk(chunk) {
    buffer += chunk;
    var events = [];
    var n = buffer.length;
    var i = 0;

    while (i < n) {
      // رد کردن فضای خالی
      while (i < n && /\s/.test(buffer[i])) i++;
      if (i >= n) break;

      // هر چیزی غیر از { (مثل زباله یا پیشوند) را نادیده بگیر
      if (buffer[i] !== '{') { i++; continue; }

      // شمارش آکولاد برای یافتن انتهای فریم
      var depth = 0, j = i, inString = false, esc = false, complete = false;
      for (; j < n; j++) {
        var c = buffer[j];
        if (inString) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inString = false;
        } else if (c === '"') {
          inString = true;
        } else if (c === '{') {
          depth++;
        } else if (c === '}') {
          depth--;
          if (depth === 0) { j++; complete = true; break; }
        }
      }

      // فریم ناقص → صبر برای ادامه‌ی داده
      if (!complete) break;

      var text = buffer.slice(i, j);
      try { events.push(JSON.parse(text)); } catch (e) { /* فریم خراب را نادیده بگیر */ }
      i = j;
    }

    buffer = buffer.slice(i);
    return events;
  }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = parseFloat(v);
    return isNaN(x) ? null : x;
  }

  /** تبدیل دیتای خام کانال قیمت به یک ساختار تمیز */
  function normalizePrice(data) {
    if (!data || typeof data !== 'object') return null;
    return {
      id: data.id,
      toman: toNum(data.pirt),      // قیمت به تومان
      usd: toNum(data.pusd),        // قیمت به دلار
      chg24h: toNum(data.p24h),     // نسبت تغییر ۲۴ ساعته
      chg7d: toNum(data.p7d),
      chg30d: toNum(data.p30d),
      marketCap: toNum(data.mc),
      volume: toNum(data.v),
      ts: data.t || null
    };
  }

  /** با قطع اتصال صدا بزنید تا بافر فریم ناقصِ اتصال قبلی پاک شود */
  function reset() {
    buffer = '';
  }

  global.CentrifugoParser = {
    parseChunk: parseChunk,
    normalizePrice: normalizePrice,
    reset: reset
  };
})(typeof window !== 'undefined' ? window : globalThis);
