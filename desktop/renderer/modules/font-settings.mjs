// @ts-nocheck — typecheck deferred. These modules will be revisited when
// they get their own focused refactor (Step 3 of the app.js split plan).
// @ts-nocheck — 类型检查暂缓。这些模块会在 Step 3（拆分 app.js 计划）中获得各自的 JSDoc 改造。
const FONT_KEY = "AideAgent_font";

export function applyChatFont(fontValue) {
  document.documentElement.style.setProperty("--chat-font", fontValue);
}

export function loadChatFont() {
  return localStorage.getItem(FONT_KEY) || "'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif";
}

// Self-initializing: set up font select on load
const fontSelect = document.getElementById("font-select");
if (fontSelect) {
  fontSelect.value = loadChatFont();
  fontSelect.addEventListener("change", () => {
    const val = fontSelect.value;
    localStorage.setItem(FONT_KEY, val);
    applyChatFont(val);
  });
  Array.from(fontSelect.options).forEach(opt => {
    opt.style.fontFamily = opt.value;
  });
}
applyChatFont(loadChatFont());
