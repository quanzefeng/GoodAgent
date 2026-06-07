/**
 * Global declarations for renderer-side libraries loaded via <script> tags
 * in index.html (CDN) and translations.js (local).
 *
 * These are intentionally typed as `any` / loose signatures — the goal is
 * to silence "Cannot find name" errors so JSDoc on local code can take over.
 * For tighter types, use the actual lib type packages (@types/marked, etc.)
 * or add per-call JSDoc.
 */

// ---------- CDN libraries (index.html L813-817) ----------

/** marked.js — markdown parser. Loaded from CDN as global `marked`. */
declare const marked: {
  parse(markdown: string, options?: object): string;
  setOptions(options: object): void;
  use(extension: unknown): void;
};

/** highlight.js — syntax highlighter. Loaded from CDN as global `hljs`. */
declare const hljs: {
  highlight(code: string, options?: { language?: string }): { value: string };
  highlightAll(): void;
  highlightElement(element: Element): void;
  highlightAuto(code: string): { value: string; language: string };
  registerLanguage(name: string, language: unknown): void;
};

/** KaTeX — math rendering. Loaded from CDN as global `katex`. */
declare const katex: {
  render(expression: string, element: HTMLElement, options?: object): void;
  renderToString(expression: string, options?: object): string;
};

/** DOMPurify — HTML sanitizer. Loaded from CDN as global `DOMPurify`. */
declare const DOMPurify: {
  sanitize(dirty: string, options?: object): string;
  addHook(hookName: string, hookFn: (...args: any[]) => any): void;
};

// ---------- Local i18n (translations.js L989-1006) ----------

declare function getLang(): "zh" | "en";
declare function setLang(lang: "zh" | "en"): void;
declare function applyLang(): void;

/**
 * Translation lookup. `key` is a dot-separated path like "settings.appearance".
 * `vars` is an object whose values substitute `{name}` placeholders in the
 * resolved string. Falls back to the key itself if not found.
 */
declare function t(key: string, vars?: Record<string, string | number>): string;

// ---------- app.js internal (only when the splitter exports them) ----------

declare function updateWorkspaceDisplay(): void;
