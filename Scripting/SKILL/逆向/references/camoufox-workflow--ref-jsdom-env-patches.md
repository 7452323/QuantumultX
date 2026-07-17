# jsdom 环境补丁知识库

## 概述

当 JSVMP 选择路径 B（环境伪装）在 jsdom 中运行时，jsdom 与真实浏览器存在大量差异。
本文档提供系统化的环境补丁方案，按检测影响分级，所有代码模板可直接复用。

## 使用方法

```javascript
const { JSDOM } = require('jsdom');

function createPatchedJsdom(url, options = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: url,
    referrer: options.referrer || '',
    contentType: 'text/html',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });
  const win = dom.window;
  const doc = win.document;
  const nav = win.navigator;

  patchEnvironment(win, doc, nav, options);
  return dom;
}
```

---

## 致命级补丁（缺失即被服务端拒绝）

### 1. Function.prototype.toString 三层防御

**问题**：jsdom 所有 DOM 方法都是 JS 实现，`toString()` 会暴露完整源码（如 `createElement(localName) { const esValue = ...`），
JSVMP 通过此检测判断是否在真实浏览器中。

**难度**：★★★★★ — 这是 jsdom 环境伪装的第一杀手

```javascript
const _origFnToString = win.Function.prototype.toString;
const nativeFnSet = new WeakSet();

// 第一层：精确标记 — WeakSet 注册已知 jsdom 内置函数
function markNative(fn) {
  if (typeof fn === 'function') {
    nativeFnSet.add(fn);
    try {
      const name = fn.name || '';
      // 第三层：实例级覆写 — 直接在函数对象上定义 toString
      Object.defineProperty(fn, 'toString', {
        value: function () { return `function ${name}() { [native code] }`; },
        writable: true, configurable: true,
      });
    } catch (e) {}
  }
  return fn;
}

// 第二层：源码模式正则 — 捕获 WeakSet 遗漏的 jsdom 函数
const jsdomPatterns = [
  /^\s*\w+\s*\([^)]*\)\s*\{[\s\S]*?const\s+esValue\s*=/,       // jsdom 接口方法模式
  /^\s*function\s*\([^)]*\)\s*\{[\s\S]*?this\._globalObject/,   // jsdom 全局对象访问模式
  /^\s*\w+\s*\([^)]*\)\s*\{\s*const\s+\w+\s*=\s*this\s*!==/,   // jsdom this 检查模式
];

// 覆写全局 Function.prototype.toString
win.Function.prototype.toString = function () {
  // 第一层：WeakSet 精确匹配
  if (nativeFnSet.has(this)) {
    return `function ${this.name || ''}() { [native code] }`;
  }
  let src;
  try { src = _origFnToString.call(this); } catch (e) {
    return 'function () { [native code] }';
  }
  // 第二层：源码模式正则检测
  for (const pat of jsdomPatterns) {
    if (pat.test(src)) return `function ${this.name || ''}() { [native code] }`;
  }
  return src;
};

// 深度扫描原型链，批量标记所有 jsdom 内置方法
function scanPrototypeChain(obj, maxDepth) {
  let proto = obj;
  for (let d = 0; d < (maxDepth || 10) && proto; d++) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      try {
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if (desc && typeof desc.value === 'function') markNative(desc.value);
        if (desc && typeof desc.get === 'function') markNative(desc.get);
        if (desc && typeof desc.set === 'function') markNative(desc.set);
      } catch (e) {}
    }
    proto = Object.getPrototypeOf(proto);
    if (proto === Object.prototype || proto === null) break;
  }
}

// 扫描 50+ 原型链
const protoTargets = [
  win.Document?.prototype, win.HTMLDocument?.prototype,
  win.Element?.prototype, win.HTMLElement?.prototype,
  win.Node?.prototype, win.EventTarget?.prototype,
  win.XMLHttpRequest?.prototype, win.HTMLCanvasElement?.prototype,
  win.HTMLInputElement?.prototype, win.HTMLFormElement?.prototype,
  win.HTMLAnchorElement?.prototype, win.HTMLImageElement?.prototype,
  win.HTMLDivElement?.prototype, win.HTMLSpanElement?.prototype,
  win.HTMLBodyElement?.prototype, win.HTMLHeadElement?.prototype,
  win.HTMLScriptElement?.prototype, win.HTMLStyleElement?.prototype,
  win.HTMLLinkElement?.prototype, win.HTMLMetaElement?.prototype,
  win.Window?.prototype, win.Location?.prototype,
  win.DOMParser?.prototype, win.URL?.prototype,
  win.Event?.prototype, win.CustomEvent?.prototype,
  win.MutationObserver?.prototype, win.ResizeObserver?.prototype,
  win.DOMTokenList?.prototype, win.NamedNodeMap?.prototype,
  win.NodeList?.prototype, win.HTMLCollection?.prototype,
  win.CSSStyleDeclaration?.prototype, win.Text?.prototype,
  win.Comment?.prototype, win.DocumentFragment?.prototype,
  win.Range?.prototype, win.Selection?.prototype,
  win.TreeWalker?.prototype, win.NodeIterator?.prototype,
  win.Attr?.prototype, win.CharacterData?.prototype,
  win.Storage?.prototype, win.FormData?.prototype,
  win.Headers?.prototype,
];
for (const proto of protoTargets) {
  if (proto) scanPrototypeChain(proto, 3);
}
scanPrototypeChain(doc, 5);
scanPrototypeChain(nav, 5);
```

### 2. navigator.webdriver

**问题**：jsdom 中 `navigator.webdriver` 为 `undefined`，真实浏览器为 `false`（Camoufox 在 C++ 层已处理）。

```javascript
Object.defineProperty(nav, 'webdriver', {
  get: () => false, configurable: true, enumerable: true,
});
```

### 3. navigator.plugins 完整结构模拟

**问题**：jsdom `plugins.length = 0`，且无 `item()`/`namedItem()` 方法。JSVMP 不只检查长度，还会遍历结构和检查 `Symbol.toStringTag`。

```javascript
const pluginData = [
  { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
];
const mimeData = [
  { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf' },
  { type: 'text/pdf', description: 'Portable Document Format', suffixes: 'pdf' },
];

function buildPluginArray(win) {
  const mimeTypes = mimeData.map((m, i) => {
    const mt = Object.create(null);
    Object.defineProperties(mt, {
      type: { get: markNative(function type() { return m.type; }), enumerable: true },
      description: { get: markNative(function description() { return m.description; }), enumerable: true },
      suffixes: { get: markNative(function suffixes() { return m.suffixes; }), enumerable: true },
      enabledPlugin: { get: markNative(function enabledPlugin() { return plugins[0]; }), enumerable: true },
    });
    mt[Symbol.toStringTag] = 'MimeType';
    return mt;
  });

  const plugins = pluginData.map((p, i) => {
    const plugin = Object.create(null);
    Object.defineProperties(plugin, {
      name: { get: markNative(function name() { return p.name; }), enumerable: true },
      filename: { get: markNative(function filename() { return p.filename; }), enumerable: true },
      description: { get: markNative(function description() { return p.description; }), enumerable: true },
      length: { get: markNative(function length() { return mimeTypes.length; }), enumerable: true },
    });
    mimeTypes.forEach((mt, mi) => { plugin[mi] = mt; });
    plugin.item = markNative(function item(idx) { return mimeTypes[idx] || null; });
    plugin.namedItem = markNative(function namedItem(name) {
      return mimeTypes.find(m => m.type === name) || null;
    });
    plugin[Symbol.toStringTag] = 'Plugin';
    plugin[Symbol.iterator] = markNative(function* () { yield* mimeTypes; });
    return plugin;
  });

  const pluginArray = Object.create(null);
  Object.defineProperty(pluginArray, 'length', {
    get: markNative(function length() { return plugins.length; }),
    enumerable: true,
  });
  plugins.forEach((p, i) => { pluginArray[i] = p; });
  pluginArray.item = markNative(function item(idx) { return plugins[idx] || null; });
  pluginArray.namedItem = markNative(function namedItem(name) {
    return plugins.find(p => p.name === name) || null;
  });
  pluginArray.refresh = markNative(function refresh() {});
  pluginArray[Symbol.toStringTag] = 'PluginArray';
  pluginArray[Symbol.iterator] = markNative(function* () { yield* plugins; });

  Object.defineProperty(nav, 'plugins', {
    get: markNative(function plugins() { return pluginArray; }),
    configurable: true, enumerable: true,
  });

  // mimeTypes
  const mimeTypeArray = Object.create(null);
  Object.defineProperty(mimeTypeArray, 'length', {
    get: markNative(function length() { return mimeTypes.length; }),
    enumerable: true,
  });
  mimeTypes.forEach((m, i) => { mimeTypeArray[i] = m; });
  mimeTypeArray.item = markNative(function item(idx) { return mimeTypes[idx] || null; });
  mimeTypeArray.namedItem = markNative(function namedItem(name) {
    return mimeTypes.find(m => m.type === name) || null;
  });
  mimeTypeArray[Symbol.toStringTag] = 'MimeTypeArray';
  mimeTypeArray[Symbol.iterator] = markNative(function* () { yield* mimeTypes; });

  Object.defineProperty(nav, 'mimeTypes', {
    get: markNative(function mimeTypes() { return mimeTypeArray; }),
    configurable: true, enumerable: true,
  });
}
```

### 4. document.hasFocus()

**问题**：jsdom 的 `document.hasFocus()` 始终返回 `false`，真实浏览器活动标签页返回 `true`。

```javascript
doc.hasFocus = markNative(function hasFocus() { return true; });
```

### 5. DOM 布局属性（offsetHeight/Width/getBoundingClientRect）

**问题**：jsdom 无渲染引擎，所有布局属性返回 0。JSVMP 创建不可见元素测量布局值来检测。

```javascript
function patchDOMLayout(win) {
  const HTMLElement = win.HTMLElement;
  if (!HTMLElement) return;

  function parseStyleDimension(el, prop) {
    try {
      const style = el.getAttribute && el.getAttribute('style');
      if (style) {
        const m = style.match(new RegExp(prop + '\\s*:\\s*(\\d+)'));
        if (m) return parseInt(m[1], 10);
      }
    } catch (e) {}
    return 0;
  }

  const layoutProps = ['offsetHeight', 'offsetWidth', 'clientHeight', 'clientWidth',
                       'scrollHeight', 'scrollWidth', 'offsetTop', 'offsetLeft'];
  for (const prop of layoutProps) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      get: markNative(function () {
        const dim = prop.includes('Height') || prop.includes('Top') ? 'height' : 'width';
        const fromStyle = parseStyleDimension(this, dim);
        if (fromStyle > 0) return fromStyle;
        const defaults = { offsetHeight: 150, offsetWidth: 300, clientHeight: 150,
          clientWidth: 300, scrollHeight: 150, scrollWidth: 300, offsetTop: 0, offsetLeft: 0 };
        return defaults[prop] || 0;
      }),
      configurable: true, enumerable: true,
    });
  }

  HTMLElement.prototype.getBoundingClientRect = markNative(function getBoundingClientRect() {
    const w = parseStyleDimension(this, 'width') || 300;
    const h = parseStyleDimension(this, 'height') || 150;
    return { x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, width: w, height: h,
      toJSON: markNative(function toJSON() { return this; }) };
  });

  HTMLElement.prototype.getClientRects = markNative(function getClientRects() {
    return [this.getBoundingClientRect()];
  });
}
```

---

## 高危级补丁（可能参与指纹哈希）

... (truncated for brevity - full content from Nexus was loaded)