// ==UserScript==
// @name         色花堂每日自动签到 (drag captcha auto-solver)
// @namespace    https://github.com/7452323
// @version      1.0.0
// @description  打开每日签到页时自动完成 滑块拼图验证码 + 签到；非 drag 型验证码会提示手动。仅在 sehuatang.org 生效。
// @match        https://sehuatang.org/plugin.php?id=dd_sign*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// ==/UserScript==

(function () {
  'use strict';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- 工具：图片 base64 -> canvas ----
  function loadCanvas(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        res(c);
      };
      img.onerror = rej;
      img.src = dataUrl;
    });
  }

  // ---- 缺口检测（drag 型）：固定 y=display_y 邻域，拼图轮廓 vs 底图边缘能量 ----
  async function locateGap(d) {
    const mc = await loadCanvas(d.master_image_base64);
    const tc = await loadCanvas(d.thumb_image_base64);
    const mg = mc.getContext('2d').getImageData(0, 0, mc.width, mc.height).data;
    const tg = tc.getContext('2d').getImageData(0, 0, tc.width, tc.height).data;
    const mw = mc.width, mh = mc.height, tw = tc.width, th = tc.height;
    const g = new Uint8Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const i = (y * mw + x) * 4;
      g[y * mw + x] = (mg[i] * 77 + mg[i + 1] * 150 + mg[i + 2] * 29) >> 8;
    }
    const edge = new Float32Array(mw * mh);
    for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) {
      const i = y * mw + x;
      edge[i] = Math.abs(g[i - 1] - g[i + 1]) + Math.abs(g[i - mw] - g[i + mw]);
    }
    // 拼图轮廓像素（透明边界）
    const contour = [];
    for (let py = 0; py < th; py++) for (let px = 0; px < tw; px++) {
      const i = (py * tw + px) * 4;
      if (tg[i + 3] < 150) continue;
      const a0 = px > 0 ? tg[(py * tw + px - 1) * 4 + 3] : 0;
      const a1 = px < tw - 1 ? tg[(py * tw + px + 1) * 4 + 3] : 0;
      const a2 = py > 0 ? tg[((py - 1) * tw + px) * 4 + 3] : 0;
      const a3 = py < th - 1 ? tg[((py + 1) * tw + px) * 4 + 3] : 0;
      if (a0 < 150 || a1 < 150 || a2 < 150 || a3 < 150) contour.push([px, py]);
    }
    const baseY = (d.display_y != null ? d.display_y : Math.floor((mh - th) / 2));
    let best = { x: 0, y: baseY, s: -1 };
    for (let yy = Math.max(0, baseY - 6); yy <= Math.min(mh - th, baseY + 6); yy++) {
      for (let x = 0; x <= mw - tw; x++) {
        let s = 0, n = 0;
        for (let k = 0; k < contour.length; k++) {
          const px = contour[k][0], py = contour[k][1];
          s += edge[Math.min(mh - 2, yy + py) * mw + Math.min(mw - 2, x + px)];
          n++;
        }
        const a = s / n;
        if (a > best.s) { best.s = a; best.x = x; best.y = yy; }
      }
    }
    return best;
  }

  // ---- 主流程 ----
  async function run() {
    const btn = document.getElementById('signin-btn');
    if (!btn) return; // 页面结构变化，跳过
    const btnText = (btn.textContent || '').trim();
    if (!/未签到|点击签到/.test(btnText)) {
      GM_notification && GM_notification('色花堂', '', '今日已签到，无需操作');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const last = GM_getValue('sht_auto_date', '');
    if (last === today) return; // 今天已经自动尝试过
    GM_setValue('sht_auto_date', today);

    const toast = (t) => {
      const e = document.createElement('div');
      e.textContent = t;
      e.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;background:#111;color:#0f0;padding:10px 14px;border-radius:8px;font-size:15px;box-shadow:0 2px 10px rgba(0,0,0,.4)';
      document.body.appendChild(e);
      setTimeout(() => e.remove(), 6000);
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      let d = null;
      for (let i = 0; i < 5; i++) {
        try {
          const r = await fetch('misc.php?mod=captcha', { credentials: 'include' });
          const j = await r.json();
          if (j.code === 200 && j.data && j.data.type === 'drag') { d = j.data; break; }
          if (j.data && j.data.type !== 'drag') { toast('遇到「' + j.data.type + '」型验证码，请手动完成签到'); GM_setValue('sht_auto_date', ''); return; }
        } catch (e) {}
        await sleep(1500);
      }
      if (!d) { toast('获取验证码失败(限流)，请稍后手动签到'); GM_setValue('sht_auto_date', ''); return; }

      let b = null;
      try { b = await locateGap(d); } catch (e) { toast('解析验证码图片失败，请手动签到'); GM_setValue('sht_auto_date', ''); return; }

      // 提交 x,y（y 用服务端下发的 display_y）
      const guess = Math.round(b.x) + ',' + (d.display_y != null ? Math.round(d.display_y) : Math.round(b.y));
      try {
        const c = await fetch('misc.php?mod=captcha&action=check', {
          method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: guess, credentials: 'include'
        });
        const cj = await c.json();
        if (cj.data === 'ok') {
          const s = await fetch('plugin.php?id=dd_sign&ac=sign_v2', { credentials: 'include' });
          const sj = await s.json();
          toast('✅ ' + (sj.message || '签到成功'));
          GM_notification && GM_notification('色花堂自动签到', '', sj.message || '签到成功');
          setTimeout(() => location.reload(), 2500);
          return;
        }
      } catch (e) {}
      // 失败：刷新重试（最多3次）
      await sleep(1800);
    }
    toast('自动验证 3 次未通过，请手动完成签到');
    GM_setValue('sht_auto_date', '');
  }

  setTimeout(run, 1200);
})();
