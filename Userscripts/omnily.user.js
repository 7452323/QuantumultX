// ==UserScript==
// @name         网页翻译 · 多引擎
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  点击翻译整个页面/恢复原文。支持Google(免费)/百度通用(极速)/百度大模型(AI)/DeepSeek(高质量)，双语/单语模式，翻译结果缓存。长按进入配置。
// @author       you
// @match        *://*/*
// @icon         data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  // ====== 配置 ======
  const cfg = {
    engine: GM_getValue("ds_engine", "google"),
    mode: GM_getValue("ds_mode", "bilingual"),
    // 百度通用翻译 (appid + secretKey)
    baiduAppId: GM_getValue("ds_baidu_id", ""),
    baiduKey: GM_getValue("ds_baidu_key", ""),
    // 百度大模型翻译 (只有一串 APP ID)
    baiduLlmAppId: GM_getValue("ds_baidu_llm_id", ""),
    // DeepSeek
    dsKey: GM_getValue("ds_api_key", ""),
    dsModel: GM_getValue("ds_model", "deepseek-chat"),
  };

  // ====== 状态 ======
  let translated = false;
  let translating = false;
  let stopRequested = false;
  let originalTexts = null;
  const transCache = new Map();

  // ====== 样式 ======
  GM_addStyle(`
    #ds-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      width: 52px; height: 52px; border-radius: 50%; background: #4f6ef7;
      color: #fff; border: none; font-size: 24px; cursor: pointer;
      box-shadow: 0 2px 12px rgba(79,110,247,0.4);
      transition: transform 0.15s, background 0.3s;
      display: flex; align-items: center; justify-content: center;
      user-select: none; -webkit-user-select: none;
    }
    #ds-fab:active { transform: scale(0.92); }
    #ds-fab.translated { background: #a6e3a1; }

    #ds-panel {
      position: fixed; bottom: 88px; right: 24px; z-index: 999999;
      width: 320px; max-height: 70vh; overflow-y: auto;
      background: #1e1e2e; border-radius: 16px; padding: 20px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5); color: #cdd6f4;
      font: 14px -apple-system, sans-serif; display: none; border: 1px solid #313244;
    }
    #ds-panel.show { display: block; }
    #ds-panel h3 {
      margin: 0 0 16px 0; font-size: 16px; color: #cba6f7;
      display: flex; justify-content: space-between; align-items: center;
    }
    #ds-panel h3 button { background: none; border: none; color: #a6adc8; cursor: pointer; font-size: 18px; padding: 0 4px; }
    #ds-panel h3 button:hover { color: #f38ba8; }
    #ds-panel label { display: block; margin-bottom: 4px; color: #a6adc8; font-size: 12px; margin-top: 8px; }
    #ds-panel label:first-of-type { margin-top: 0; }
    #ds-panel input, #ds-panel select {
      width: 100%; padding: 8px 12px; margin-bottom: 4px;
      background: #313244; border: 1px solid #45475a; border-radius: 8px;
      color: #cdd6f4; font-size: 13px; box-sizing: border-box; outline: none;
    }
    #ds-panel input:focus, #ds-panel select:focus { border-color: #4f6ef7; }
    #ds-panel .hint { font-size: 11px; color: #6c7086; margin: 2px 0 8px 0; }

    #ds-panel .engine-tab {
      display: flex; gap: 6px; margin-bottom: 6px;
    }
    #ds-panel .engine-tab button {
      flex: 1; padding: 7px; border: 1px solid #45475a; border-radius: 8px;
      background: #313244; color: #a6adc8; cursor: pointer; font-size: 12px; transition: all 0.2s;
    }
    #ds-panel .engine-tab button.active { background: #4f6ef7; border-color: #4f6ef7; color: #fff; }

    #ds-panel .baidu-subtab {
      display: flex; gap: 6px; margin: 6px 0 10px 0;
    }
    #ds-panel .baidu-subtab button {
      flex: 1; padding: 5px; border: 1px solid #45475a; border-radius: 6px;
      background: #313244; color: #a6adc8; cursor: pointer; font-size: 11px; transition: all 0.2s;
    }
    #ds-panel .baidu-subtab button.active { background: #4f6ef7; border-color: #4f6ef7; color: #fff; }

    #ds-panel .mode-tab {
      display: flex; gap: 6px; margin-bottom: 12px;
    }
    #ds-panel .mode-tab button {
      flex: 1; padding: 6px; border: 1px solid #45475a; border-radius: 8px;
      background: #313244; color: #a6adc8; cursor: pointer; font-size: 12px; transition: all 0.2s;
    }
    #ds-panel .mode-tab button.active { background: #585b70; border-color: #585b70; color: #fff; }

    #ds-panel .cfg-section { display: none; }
    #ds-panel .cfg-section.show { display: block; }
    #ds-panel .btn-row { display: flex; gap: 8px; margin-top: 12px; }
    #ds-panel .btn-row button {
      flex: 1; padding: 9px; border: none; border-radius: 8px;
      cursor: pointer; font-size: 13px; transition: opacity 0.2s;
    }
    #ds-panel .btn-row button:active { opacity: 0.8; }
    #ds-panel .btn-save { background: #4f6ef7; color: #fff; }
    #ds-panel .btn-close-cfg { background: #45475a; color: #cdd6f4; }
    #ds-panel .btn-clear-cache { background: #45475a; color: #f38ba8; }

    #ds-progress { margin-top: 10px; display: none; }
    #ds-progress.show { display: block; }
    #ds-progress .bar-wrap { width: 100%; height: 4px; background: #313244; border-radius: 2px; overflow: hidden; }
    #ds-progress .bar { height: 100%; width: 0%; background: #a6e3a1; border-radius: 2px; transition: width 0.3s; }
    #ds-progress .text { font-size: 11px; color: #a6adc8; margin-top: 4px; text-align: center; }

    #ds-toast {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      z-index: 9999999; padding: 10px 24px; border-radius: 10px;
      font: 14px -apple-system, sans-serif; color: #fff;
      display: none; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    #ds-toast.ok { background: #1e3a2e; }
    #ds-toast.err { background: #3a1e1e; }
    #ds-toast.info { background: #1e2a3a; }
  `);

  // ====== DOM ======
  document.body.insertAdjacentHTML("beforeend", `
    <button id="ds-fab">🌐</button>
    <div id="ds-panel">
      <h3>
        ⚙️ 翻译设置
        <button id="ds-close-panel">✕</button>
      </h3>

      <label>翻译引擎</label>
      <div class="engine-tab">
        <button data-engine="google" class="active">🌍 Google</button>
        <button data-engine="baidu">⚡ 百度</button>
        <button data-engine="deepseek">🧠 DeepSeek</button>
      </div>

      <div class="cfg-section show" id="ds-cfg-baidu-hint" style="display:none">
        <div class="baidu-subtab">
          <button data-baidu="normal" class="active">通用翻译</button>
          <button data-baidu="llm">大模型翻译</button>
        </div>
      </div>

      <label>显示模式</label>
      <div class="mode-tab">
        <button data-mode="bilingual" class="active">📖 双语</button>
        <button data-mode="monolingual">🔤 仅译文</button>
      </div>

      <div class="cfg-section show" id="ds-cfg-google">
        <div class="hint">Google 翻译免费使用，无需配置</div>
      </div>
      <div class="cfg-section" id="ds-cfg-baidu-normal">
        <label>APP ID</label>
        <input id="ds-baidu-id" placeholder="从 fanyi-api.baidu.com 获取" value="${cfg.baiduAppId}">
        <label>密钥</label>
        <input type="password" id="ds-baidu-key" placeholder="从 fanyi-api.baidu.com 获取" value="${cfg.baiduKey}">
        <div class="hint">免费版每月 100 万字符</div>
      </div>
      <div class="cfg-section" id="ds-cfg-baidu-llm">
        <label>APP ID</label>
        <input type="password" id="ds-baidu-llm-id" placeholder="从控制台获取的单串 APP ID" value="${cfg.baiduLlmAppId}">
        <div class="hint">免费版每月 100 万字符</div>
      </div>
      <div class="cfg-section" id="ds-cfg-ds">
        <label>API Key</label>
        <input type="password" id="ds-ds-key" placeholder="sk-xxxxxxxx" value="${cfg.dsKey}">
        <label>模型</label>
        <select id="ds-ds-model">
          <option value="deepseek-chat" ${cfg.dsModel === "deepseek-chat" ? "selected" : ""}>DeepSeek V3</option>
          <option value="deepseek-reasoner" ${cfg.dsModel === "deepseek-reasoner" ? "selected" : ""}>DeepSeek R1</option>
        </select>
        <div class="hint">质量高但速度较慢</div>
      </div>
      <div class="btn-row">
        <button class="btn-save" id="ds-save-btn">💾 保存配置</button>
        <button class="btn-close-cfg" id="ds-close-btn">关闭</button>
      </div>
      <div class="hint" style="text-align:center;margin-top:8px;cursor:pointer" id="ds-clear-cache">🗑️ 清除翻译缓存 (${transCache.size}条)</div>
      <div id="ds-progress">
        <div class="bar-wrap"><div class="bar" id="ds-progress-bar"></div></div>
        <div class="text" id="ds-progress-text">准备中...</div>
      </div>
    </div>
    <div id="ds-toast"></div>
  `);

  // ====== DOM 引用 ======
  const fab = document.getElementById("ds-fab");
  const panel = document.getElementById("ds-panel");
  const progress = document.getElementById("ds-progress");
  const progressBar = document.getElementById("ds-progress-bar");
  const progressText = document.getElementById("ds-progress-text");
  const toast = document.getElementById("ds-toast");
  const cacheHint = document.getElementById("ds-clear-cache");

  // ====== 百度子模式 ======
  let baiduMode = GM_getValue("ds_baidu_mode", "normal");

  function showBaiduConfig() {
    document.getElementById("ds-cfg-baidu-normal").classList.toggle("show", baiduMode === "normal");
    document.getElementById("ds-cfg-baidu-llm").classList.toggle("show", baiduMode === "llm");
    document.querySelectorAll(".baidu-subtab button").forEach((b) => {
      b.classList.toggle("active", b.dataset.baidu === baiduMode);
    });
  }

  document.querySelectorAll(".baidu-subtab button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".baidu-subtab button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      baiduMode = btn.dataset.baidu;
      showBaiduConfig();
    });
  });

  // ====== 引擎切换 ======
  document.querySelectorAll(".engine-tab button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".engine-tab button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      cfg.engine = btn.dataset.engine;
      document.getElementById("ds-cfg-google").classList.toggle("show", cfg.engine === "google");
      document.getElementById("ds-cfg-baidu-hint").style.display = cfg.engine === "baidu" ? "block" : "none";
      document.getElementById("ds-cfg-baidu-normal").classList.toggle("show", cfg.engine === "baidu" && baiduMode === "normal");
      document.getElementById("ds-cfg-baidu-llm").classList.toggle("show", cfg.engine === "baidu" && baiduMode === "llm");
      document.getElementById("ds-cfg-ds").classList.toggle("show", cfg.engine === "deepseek");
    });
  });
  // 初始状态：显示百度子tab
  if (cfg.engine === "baidu") {
    document.getElementById("ds-cfg-baidu-hint").style.display = "block";
    showBaiduConfig();
  }

  // ====== 模式切换 ======
  document.querySelectorAll(".mode-tab button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      cfg.mode = btn.dataset.mode;
    });
  });

  // ====== 保存 / 关闭 ======
  document.getElementById("ds-save-btn").addEventListener("click", () => {
    saveConfig();
    showToast("✅ 配置已保存", "ok");
  });
  document.getElementById("ds-close-btn").addEventListener("click", () => panel.classList.remove("show"));
  document.getElementById("ds-close-panel").addEventListener("click", () => panel.classList.remove("show"));

  cacheHint.addEventListener("click", () => {
    transCache.clear();
    cacheHint.textContent = `🗑️ 清除翻译缓存 (0条)`;
    showToast("缓存已清除", "info");
  });

  // ====== 保存配置 ======
  function saveConfig() {
    cfg.baiduAppId = document.getElementById("ds-baidu-id").value.trim();
    cfg.baiduKey = document.getElementById("ds-baidu-key").value.trim();
    cfg.baiduLlmAppId = document.getElementById("ds-baidu-llm-id").value.trim();
    cfg.dsKey = document.getElementById("ds-ds-key").value.trim();
    cfg.dsModel = document.getElementById("ds-ds-model").value;

    GM_setValue("ds_engine", cfg.engine);
    GM_setValue("ds_mode", cfg.mode);
    GM_setValue("ds_baidu_id", cfg.baiduAppId);
    GM_setValue("ds_baidu_key", cfg.baiduKey);
    GM_setValue("ds_baidu_llm_id", cfg.baiduLlmAppId);
    GM_setValue("ds_baidu_mode", baiduMode);
    GM_setValue("ds_api_key", cfg.dsKey);
    GM_setValue("ds_model", cfg.dsModel);
  }

  // ====== 可拖动按钮 ======
  let isDragging = false, dragStartX = 0, dragStartY = 0, dragMoved = false;
  let longPressTimer = null, longPressStart = 0, isLongPress = false;

  fab.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true; dragMoved = false;
    const rect = fab.getBoundingClientRect();
    dragStartX = e.clientX; dragStartY = e.clientY;
    fab._origLeft = rect.left; fab._origTop = rect.top;
    fab.style.cursor = "grabbing";
    fab.style.transition = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragMoved = true;
    const vw = window.innerWidth, vh = window.innerHeight;
    const fw = 52, fh = 52;
    let nx = Math.max(0, Math.min(vw - fw, fab._origLeft + dx));
    let ny = Math.max(0, Math.min(vh - fh, fab._origTop + dy));
    fab.style.left = nx + "px"; fab.style.right = "auto";
    fab.style.top = ny + "px"; fab.style.bottom = "auto";
  });

  document.addEventListener("mouseup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    fab.style.transition = "";
    fab.style.cursor = "";
    if (dragMoved) { e.stopPropagation(); e.preventDefault(); }
  });

  fab.addEventListener("click", (e) => {
    if (dragMoved) { e.stopPropagation(); e.preventDefault(); return; }
    if ("ontouchstart" in window) return;
    toggleTranslate();
  });

  fab.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    isDragging = true; dragMoved = false;
    const rect = fab.getBoundingClientRect();
    dragStartX = t.clientX; dragStartY = t.clientY;
    fab._origLeft = rect.left; fab._origTop = rect.top;
    fab.style.transition = "none";
    longPressStart = Date.now(); isLongPress = false;
    longPressTimer = setTimeout(() => {
      if (!dragMoved) { isLongPress = true; navigator.vibrate?.(20); panel.classList.add("show"); }
    }, 500);
  }, { passive: true });

  fab.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartX, dy = t.clientY - dragStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragMoved = true;
      clearTimeout(longPressTimer);
    }
    const vw = window.innerWidth, vh = window.innerHeight;
    const fw = 52, fh = 52;
    let nx = Math.max(0, Math.min(vw - fw, fab._origLeft + dx));
    let ny = Math.max(0, Math.min(vh - fh, fab._origTop + dy));
    fab.style.left = nx + "px"; fab.style.right = "auto";
    fab.style.top = ny + "px"; fab.style.bottom = "auto";
    e.preventDefault();
  }, { passive: false });

  fab.addEventListener("touchend", (e) => {
    isDragging = false;
    clearTimeout(longPressTimer);
    fab.style.transition = "";
    if (!dragMoved && !isLongPress && Date.now() - longPressStart < 500) {
      e.preventDefault();
      toggleTranslate();
    }
  }, { passive: false });

  fab.addEventListener("contextmenu", (e) => { e.preventDefault(); panel.classList.toggle("show"); });

  // ====== 切换 ======
  async function toggleTranslate() {
    if (translating) return;
    saveConfig();

    if (translating) {
      stopRequested = true;
      showToast("⏹️ 正在停止...", "info");
      return;
    }
    if (translated) { restoreOriginal(); return; }

    if (cfg.engine === "baidu") {
      if (baiduMode === "normal" && (!cfg.baiduAppId || !cfg.baiduKey)) {
        showToast("请配置百度通用翻译（APP ID + 密钥）", "err"); return;
      }
      if (baiduMode === "llm" && !cfg.baiduLlmAppId) {
        showToast("请配置百度大模型翻译 APP ID", "err"); return;
      }
    }
    if (cfg.engine === "deepseek" && !cfg.dsKey) {
      showToast("请先配置 DeepSeek Key（长按图标设置）", "err"); return;
    }

    await translatePage();
  }

  function restoreOriginal() {
    if (!originalTexts) return;
    originalTexts.forEach(({ node, text }) => { node.textContent = text; });
    translated = false; fab.classList.remove("translated"); fab.textContent = "🌐";
    showToast("已恢复原文", "info");
  }

  // ====== 翻译页面 ======
  async function translatePage() {
    translating = true;
    progress.classList.add("show");
    setProgress(0, "提取文本...");

    try {
      const entries = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const p = n.parentElement;
          if (!p || p.closest("script,style,code,pre,#ds-panel,#ds-fab,#ds-toast,svg"))
            return NodeFilter.FILTER_REJECT;
          const t = n.textContent.trim();
          if (t.length < 10) return NodeFilter.FILTER_REJECT;
          if (p.offsetWidth === 0 || p.offsetHeight === 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      while (walk.nextNode()) entries.push({ node: walk.currentNode, text: walk.currentNode.textContent });

      if (entries.length === 0) { showToast("没有可翻译的文本", "info"); return; }
      originalTexts = entries;

      const nodes = entries.map((e) => e.node);
      const needApi = [];
      const cached = [];

      nodes.forEach((node, i) => {
        const key = node.textContent.trim();
        if (transCache.has(key)) {
          cached.push(i);
        } else {
          needApi.push(i);
        }
      });

      cached.forEach((i) => {
        const key = nodes[i].textContent.trim();
        const t = transCache.get(key);
        nodes[i].textContent = cfg.mode === "bilingual" ? key + "\n" + t : t;
      });

      if (needApi.length > 0) {
        if (cfg.engine === "google") {
          await translateGoogle(nodes, needApi);
        } else if (cfg.engine === "baidu") {
          if (baiduMode === "llm") {
            await translateBaiduLLM(nodes, needApi);
          } else {
            await translateBaidu(nodes, needApi);
          }
        } else {
          await translateDeepSeek(nodes, needApi);
        }
      }

      cacheHint.textContent = `🗑️ 清除翻译缓存 (${transCache.size}条)`;

      translated = true;
      fab.classList.add("translated"); fab.textContent = "✅";
      setProgress(100, "✅ 翻译完成");
      const fromCache = cached.length > 0 ? ` (缓存${cached.length}段)` : "";
      showToast(`翻译完成${fromCache}，再点恢复原文`, "ok");
    } catch (err) {
      showToast("出错: " + err.message, "err");
    }
    setTimeout(() => { progress.classList.remove("show"); translating = false; }, 1500);
  }

  // ====== Google 翻译 ======
  async function translateGoogle(nodes, indices) {
    const batchSize = 5;
    for (let ki = 0; ki < indices.length; ki += batchSize) {
      if (stopRequested) { showToast("⏹️ 已停止", "info"); break; }
      const batchIdx = indices.slice(ki, ki + batchSize);
      const pct = Math.min(100, Math.round(((ki + batchIdx.length) / indices.length) * 100));
      setProgress(pct, `Google 翻译中 ${Math.min(ki + batchIdx.length, indices.length)}/${indices.length}...`);

      for (const i of batchIdx) {
        if (stopRequested) break;
        const text = nodes[i].textContent.trim();
        try {
          const t = await callGoogle(text);
          if (t) {
            transCache.set(text, t);
            nodes[i].textContent = cfg.mode === "bilingual" ? text + "\n" + t : t;
          }
        } catch (e) {
          console.warn("Google翻译失败:", e.message?.slice(0, 30));
        }
      }
    }
  }

  function callGoogle(text) {
    return new Promise((resolve, reject) => {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" + encodeURIComponent(text);
      GM_xmlhttpRequest({
        method: "GET", url,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            if (data && data[0]) {
              const result = data[0].map((r) => r[0]).join("");
              resolve(result || null);
            } else {
              reject(new Error("无结果"));
            }
          } catch { reject(new Error("解析失败")); }
        },
        onerror: () => reject(new Error("网络错误")),
        timeout: 15000,
      });
    });
  }

  // ====== 百度通用翻译（appid + key） ======
  async function translateBaidu(nodes, indices) {
    const sep = "\n|||ds-sep|||\n";
    const maxBytes = 5000;
    const batches = [];
    let cur = [], curBytes = 0;
    for (let ki = 0; ki < indices.length; ki++) {
      const t = nodes[indices[ki]].textContent.trim();
      const bytes = new Blob([t]).size;
      if (cur.length > 0 && curBytes + bytes + 20 > maxBytes) {
        batches.push(cur);
        cur = []; curBytes = 0;
      }
      cur.push({ idx: indices[ki], text: t, bytes });
      curBytes += bytes + 20;
    }
    if (cur.length) batches.push(cur);

    for (let b = 0; b < batches.length; b += 3) {
      if (stopRequested) { showToast("⏹️ 已停止", "info"); break; }
      const chunk = batches.slice(b, b + 3);
      const pct = Math.min(100, Math.round(((b + chunk.length) / batches.length) * 100));
      setProgress(pct, `百度翻译中 ${Math.min((b + chunk.length) * 30, indices.length)}/${indices.length}...`);

      await Promise.all(chunk.map(async (batch) => {
        try {
          const joined = batch.map(x => x.text).join(sep);
          const result = await callBaidu(joined);
          if (result) {
            const parts = result.split("|||ds-sep|||").map((s) => s.trim());
            batch.forEach((item, idx) => {
              const t = parts[idx];
              if (t && t !== item.text) {
                transCache.set(item.text, t);
                const node = nodes[item.idx];
                node.textContent = cfg.mode === "bilingual" ? item.text + "\n" + t : t;
              }
            });
          }
        } catch (e) {
          console.warn("百度批量失败:", e.message.slice(0, 30));
          for (const item of batch) {
            if (stopRequested) break;
            try {
              const r = await callBaidu(item.text);
              if (r) {
                transCache.set(item.text, r);
                nodes[item.idx].textContent = cfg.mode === "bilingual" ? item.text + "\n" + r : r;
              }
            } catch {}
          }
        }
      }));
    }
  }

  function callBaidu(text) {
    return new Promise((resolve, reject) => {
      const appid = cfg.baiduAppId;
      const key = cfg.baiduKey;
      const salt = Date.now() + Math.random();
      const sign = md5(appid + text + salt + key);
      const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=auto&to=zh&appid=${appid}&salt=${salt}&sign=${sign}`;
      GM_xmlhttpRequest({
        method: "GET", url,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            if (data.trans_result) resolve(data.trans_result.map((r) => r.dst).join("\n"));
            else if (data.error_code) reject(new Error(`[${data.error_code}] ${data.error_msg}`));
            else reject(new Error("返回异常"));
          } catch { reject(new Error("解析失败")); }
        },
        onerror: () => reject(new Error("网络错误")),
        timeout: 15000,
      });
    });
  }

  // ====== 百度大模型翻译（单 APP ID） ======
  async function translateBaiduLLM(nodes, indices) {
    const batchSize = 5;
    for (let ki = 0; ki < indices.length; ki += batchSize) {
      if (stopRequested) { showToast("⏹️ 已停止", "info"); break; }
      const batchIdx = indices.slice(ki, ki + batchSize);
      const pct = Math.min(100, Math.round(((ki + batchIdx.length) / indices.length) * 100));
      setProgress(pct, `百度大模型翻译中 ${Math.min(ki + batchIdx.length, indices.length)}/${indices.length}...`);

      for (const i of batchIdx) {
        if (stopRequested) break;
        const text = nodes[i].textContent.trim();
        try {
          const t = await callBaiduLLM(text);
          if (t) {
            transCache.set(text, t);
            nodes[i].textContent = cfg.mode === "bilingual" ? text + "\n" + t : t;
          }
        } catch (e) {
          console.warn("百度大模型翻译失败:", e.message?.slice(0, 30));
        }
      }
    }
  }

  function callBaiduLLM(text) {
    return new Promise((resolve, reject) => {
      const appid = cfg.baiduLlmAppId;
      const salt = Date.now() + Math.random();
      const sign = md5(appid + text + salt + appid);
      const url = `https://fanyi-api.baidu.com/api/trans/llm/translate?q=${encodeURIComponent(text)}&from=auto&to=zh&appid=${appid}&salt=${salt}&sign=${sign}`;
      GM_xmlhttpRequest({
        method: "GET", url,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            if (data.trans_result) resolve(data.trans_result.map((r) => r.dst).join("\n"));
            else if (data.result) resolve(data.result);
            else if (data.error_code) reject(new Error(`[${data.error_code}] ${data.error_msg}`));
            else reject(new Error("返回异常"));
          } catch { reject(new Error("解析失败")); }
        },
        onerror: () => reject(new Error("网络错误")),
        timeout: 30000,
      });
    });
  }

  // ====== DeepSeek API ======
  async function translateDeepSeek(nodes, indices) {
    const batchSize = 20;
    const sep = "\n---\n";
    for (let ki = 0; ki < indices.length; ki += batchSize) {
      if (stopRequested) { showToast("⏹️ 已停止", "info"); break; }
      const batchIdx = indices.slice(ki, ki + batchSize);
      const texts = batchIdx.map((i) => nodes[i].textContent.trim());
      const pct = Math.min(100, Math.round(((ki + batchIdx.length) / indices.length) * 100));
      setProgress(pct, `DeepSeek 翻译中 ${Math.min(ki + batchIdx.length, indices.length)}/${indices.length}...`);

      const result = await callDeepSeek(texts);
      if (result) {
        batchIdx.forEach((i, idx) => {
          const orig = texts[idx];
          if (result[idx]) {
            transCache.set(orig, result[idx]);
            nodes[i].textContent = cfg.mode === "bilingual" ? orig + "\n" + result[idx] : result[idx];
          }
        });
      }
    }
  }

  function callDeepSeek(texts) {
    return new Promise((resolve) => {
      const joined = texts.map((t, i) => `[${i + 1}] ${t}`).join("\n---\n");
      const prompt = `逐段翻译为简体中文，保持编号格式，只返回翻译结果：\n\n${joined}`;
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://api.deepseek.com/chat/completions",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.dsKey}` },
        data: JSON.stringify({
          model: cfg.dsModel,
          messages: [{ role: "system", content: "逐段翻译，保持编号。" }, { role: "user", content: prompt }],
          temperature: 0.3, max_tokens: 8192,
        }),
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            if (data.choices && data.choices[0]) {
              const content = data.choices[0].message.content.trim();
              const results = [];
              for (let i = 0; i < texts.length; i++) {
                const re = new RegExp(`\\[${i + 1}\\]\\s*([\\s\\S]*?)(?=\\[${i + 2}\\]|$)`);
                const m = content.match(re);
                results.push(m ? m[1].trim() : "");
              }
              resolve(results);
            } else resolve(null);
          } catch { resolve(null); }
        },
        onerror: () => resolve(null),
        timeout: 60000,
      });
    });
  }

  // ====== MD5 ======
  function md5(str) {
    function rotateLeft(x, n) { return (x << n) | (x >>> (32 - n)); }
    function toHex(x) {
      var s = "";
      for (var i = 0; i < 4; i++) {
        s += ("0" + ((x >> (i * 8)) & 0xff).toString(16)).slice(-2);
      }
      return s;
    }
    function addUnsigned(x, y) {
      var lsw = (x & 0xffff) + (y & 0xffff);
      return ((x >>> 16) + (y >>> 16) + (lsw >>> 16)) << 16 | (lsw & 0xffff);
    }
    var i, j, aa, bb, cc, dd;
    var S = [[7, 12, 17, 22], [5, 9, 14, 20], [4, 11, 16, 23], [6, 10, 15, 21]];
    var T = [];
    for (i = 0; i < 64; i++) T[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
    str = unescape(encodeURIComponent(str));
    var n = str.length, bits = [];
    for (i = 0; i < n; i++) bits.push(str.charCodeAt(i));
    bits.push(0x80);
    var len = bits.length / 4 + 2;
    len = Math.ceil(len / 16) * 16;
    var x = [];
    for (i = 0; i < len; i++) x[i] = 0;
    for (i = 0; i < bits.length; i++) x[i >> 2] |= bits[i] << ((i % 4) * 8);
    x[x.length - 2] = n * 8;
    var a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
    for (i = 0; i < x.length; i += 16) {
      var X = x.slice(i, i + 16);
      aa = a; bb = b; cc = c; dd = d;
      for (j = 0; j < 64; j++) {
        var g, f;
        if (j < 16) { g = j; f = (bb & cc) | (~bb & dd); }
        else if (j < 32) { g = (5 * j + 1) % 16; f = (dd & bb) | (~dd & cc); }
        else if (j < 48) { g = (3 * j + 5) % 16; f = bb ^ cc ^ dd; }
        else { g = (7 * j) % 16; f = cc ^ (bb | ~dd); }
        var temp = dd; dd = cc; cc = bb;
        bb = addUnsigned(bb, rotateLeft(addUnsigned(addUnsigned(addUnsigned(aa, f), T[j]), X[g]), S[j >> 4][j & 3]));
        aa = temp;
      }
      a = addUnsigned(a, aa); b = addUnsigned(b, bb);
      c = addUnsigned(c, cc); d = addUnsigned(d, dd);
    }
    return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
  }

  // ====== 工具 ======
  function setProgress(pct, text) { progressBar.style.width = pct + "%"; progressText.textContent = text; }
  function showToast(msg, type) { toast.textContent = msg; toast.className = type; toast.style.display = "block"; setTimeout(() => { toast.style.display = "none"; }, 3000); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") panel.classList.remove("show"); });

  const engName = cfg.engine === "google" ? "Google" : cfg.engine === "baidu" ? ("百度" + (baiduMode === "llm" ? "·大模型" : "·通用")) : "DeepSeek";
  const modeName = cfg.mode === "bilingual" ? "双语" : "仅译文";
  console.log(`✅ 网页翻译已加载 | ${engName} | ${modeName} | 点击翻译/恢复，长按配置`);
})();
