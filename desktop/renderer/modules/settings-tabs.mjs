// @ts-nocheck — typecheck deferred. These modules will be revisited when
// they get their own focused refactor (Step 3 of the app.js split plan).
// @ts-nocheck — 类型检查暂缓。这些模块会在 Step 3（拆分 app.js 计划）中获得各自的 JSDoc 改造。
/**
 * Settings tab switching
 * --------------------------------------------------------------------------
 * 通用 12 个 settings tab 的切换逻辑。点击 tab 元素会切到对应 panel，
 * 其他模块（如 prompt tab 加载 profile）可在自己的 click listener 里
 * 主动调 switchSettingsTab。
 *
 * 元素约定（与 index.html 保持一致）：
 *   - Tab 元素：.settings-tab，且带 data-tab="<name>"
 *   - Panel 元素：#panel-<name>
 */

export function switchSettingsTab(tabName) {
  document.querySelectorAll(".settings-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".settings-panel").forEach(p => p.classList.remove("active"));
  const tab = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
  const panel = document.getElementById(`panel-${tabName}`);
  if (tab) tab.classList.add("active");
  if (panel) panel.classList.add("active");
}

export function initSettingsTabs() {
  document.querySelectorAll(".settings-tab").forEach(tab => {
    const tabEl = /** @type {HTMLElement} */ (tab);
    tabEl.addEventListener("click", () => switchSettingsTab(tabEl.dataset.tab));
  });
}
