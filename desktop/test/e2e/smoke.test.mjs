/**
 * 烟雾测试套件 —— 在做任何 app.js 重构之前先建立 baseline
 *
 * 策略：先测最便宜的（进程能起来），再测最关键的（CSS 变量能更新）。
 * 详细 E2E 测试在 Step 3 拆 app.js 时按需补充。
 */
import { test, expect, _electron as electron } from "@playwright/test";

// ── 共享环境 ──────────────────────────────────────
// AIDEAGENT_TEST_MODE=1 → main.mjs 跳过 MCP/WeChat 慢启动
// 这样 app.quit() 5s 内能优雅退出
const testEnv = {
  ...process.env,
  ELECTRON_DISABLE_SANDBOX: "1",
  NODE_ENV: "test",
  AIDEAGENT_TEST_MODE: "1",
};

// 强制 kill Electron 进程（备选，close 失败时用）
const killApp = (app) => {
  try {
    const proc = app?.process?.();
    if (proc && !proc.killed) proc.kill("SIGKILL");
  } catch (e) {
    /* 已退出 */
  }
};

// 带超时的关闭：5s 没完就强制 kill
const closeApp = async (app) => {
  if (!app) return;
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("close-timeout")), 5000)
      ),
    ]);
  } catch (e) {
    killApp(app);
  }
};

// ── 共享启动器 ──────────────────────────────────────
const launchApp = async () => {
  const app = await electron.launch({
    args: ["."],
    env: testEnv,
    timeout: 30_000,
  });
  const window = await app.firstWindow({ timeout: 15_000 });
  await window.waitForLoadState("domcontentloaded", { timeout: 10_000 });
  // 等 1s 让 bg-settings 等模块完成 init
  await window.waitForTimeout(1000);
  // 清空 localStorage，确保每个测试从干净状态开始。
  // bg-settings 在 init 时会读 localStorage 恢复主题；不清理会导致
  // test 6 (gray) 的状态泄漏到下一次 run，让 test 4 (click gray) 看到
  // 已经是 gray 状态，点了无变化。
  await window.evaluate(() => localStorage.clear());
  await window.reload();
  await window.waitForLoadState("domcontentloaded", { timeout: 10_000 });
  await window.waitForTimeout(500);
  return { app, window };
};

// ── 1. 进程能起来（最便宜） ────────────────────────
test("sanity: Electron launches and process is alive", async () => {
  const app = await electron.launch({ args: ["."], env: testEnv, timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 3000));
  expect(app.process().pid).toBeGreaterThan(0);
  await closeApp(app);
});

// ── 2. 主窗口 + 关键元素 ───────────────────────────
test("main window loads and prompt input is visible", async () => {
  const { app, window } = await launchApp();
  await expect(window.locator("#prompt-input")).toBeVisible();
  await closeApp(app);
});

// ── 打开设置面板（用侧边栏按钮，Ctrl+I 没实现） ─────────
const openAppearance = async (window) => {
  // 1) 点侧边栏的设置按钮
  await window.locator("#settings-btn").click();
  await window.waitForTimeout(400);
  // 2) 确认 modal 真的 active
  const modalActive = await window.evaluate(
    () => document.getElementById("settings-modal")?.classList.contains("active")
  );
  if (!modalActive) throw new Error("settings modal did not open after #settings-btn click");
  // 3) 切到外观 tab
  await window.locator('#settings-modal [data-tab="appearance"]').click();
  await window.waitForTimeout(400);
};

// ── 3. 设置面板 + 外观 tab + 6 个预设 ──────────────
test("settings: appearance tab shows 6 preset swatches", async () => {
  const { app, window } = await launchApp();
  await openAppearance(window);
  await expect(window.locator(".bg-preset-swatch")).toHaveCount(6);
  await closeApp(app);
});

// ── 4. 点击预设 → CSS 变量实际更新 ─────────────────
test("clicking gray preset updates --bg CSS variable", async () => {
  const { app, window } = await launchApp();
  await openAppearance(window);

  const before = await window.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
  );
  await window.locator('[data-preset="gray"]').click();
  await window.waitForTimeout(300);
  const after = await window.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
  );
  expect(after).not.toBe(before);
  expect(after.toLowerCase()).toBe("#f3f4f6");
  await closeApp(app);
});

// ── 5. 2D 色板：点击 → 预览 → 应用 ────────────────
test("2D color picker: click → preview → apply writes --bg", async () => {
  const { app, window } = await launchApp();
  await openAppearance(window);

  const square = window.locator("#bg-color-square");
  await expect(square).toBeVisible();

  const box = await square.boundingBox();
  if (!box) throw new Error("bg-color-square has no bounding box");
  await window.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.2);

  const previewText = await window.locator("#bg-color-pending-hex").textContent();
  expect(previewText).toMatch(/^#[0-9a-f]{6}$/i);
  expect(previewText?.toLowerCase()).not.toBe("#ffffff");

  const bgBeforeApply = await window.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
  );
  await window.locator("#bg-color-apply-btn").click();
  await window.waitForTimeout(300);

  const bgAfterApply = await window.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
  );
  expect(bgAfterApply).not.toBe(bgBeforeApply);
  expect(bgAfterApply.toLowerCase()).toBe(previewText?.toLowerCase());
  await closeApp(app);
});

// ── 6. localStorage 持久化 ────────────────────────
test("theme persists to localStorage with correct shape", async () => {
  const { app, window } = await launchApp();
  await openAppearance(window);

  await window.locator('[data-preset="gray"]').click();
  await window.waitForTimeout(300);

  const stored = await window.evaluate(() => localStorage.getItem("AideAgent_theme"));
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored);
  expect(parsed.preset).toBe("gray");
  expect(parsed.bg.toLowerCase()).toBe("#f3f4f6");
  await closeApp(app);
});
