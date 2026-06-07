// @ts-nocheck — typecheck deferred. These modules will be revisited when
// they get their own focused refactor (Step 3 of the app.js split plan).
// @ts-nocheck — 类型检查暂缓。这些模块会在 Step 3（拆分 app.js 计划）中获得各自的 JSDoc 改造。
export function sanitize(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "em", "strong", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "code", "pre", "blockquote", "hr", "table", "thead", "tbody",
      "tr", "th", "td", "span", "div", "img", "hr", "del", "input",
    ],
    ALLOWED_ATTR: ["href", "target", "class", "id", "src", "alt", "type", "checked", "disabled", "data-m"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i,
  });
}

export function renderMarkdown(text) {
  // 1. $$...$$ → display math
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, '<span class="kp" data-m="d">$1</span>');
  // 2. \[...\] → display math (greedy to capture multiline)
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, '<span class="kp" data-m="d">$1</span>');
  // 3. \(...\) → inline math
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, '<span class="kp" data-m="i">$1</span>');
  // 4. \begin{env}...\end{env} → display math (cases, aligned, gather, etc.)
  text = text.replace(/\\begin\{([^}]+)\}([\s\S]+?)\\end\{\1\}/g, (m, env, body) => {
    return `<span class="kp" data-m="d">\\begin{${env}}${body}\\end{${env}}</span>`;
  });
  // 5. Dangling \[ without \] (streaming edge case) — wrap rest of line
  text = text.replace(/\\\[(?![\s\S]*\\\])([^\n]*)/g, '<span class="kp" data-m="d">$1</span>');
  // 6. Dangling \( without \) (streaming edge case) — wrap rest of line
  text = text.replace(/\\\((?![\s\S]*\\\))([^\n]*)/g, '<span class="kp" data-m="i">$1</span>');
  // 7. $...$ → inline math (with content detection)
  text = text.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (m, inner) => {
    const t = inner.trim();
    if (/^\d+[.,]?\d*%?$/.test(t)) return m;
    if (/[\\{}_^]/.test(t)) return `<span class="kp" data-m="i">${t}</span>`;
    if (/[a-zA-Z]/.test(t) && /[=+\-*/^()\[\]<>]/.test(t)) return `<span class="kp" data-m="i">${t}</span>`;
    return m;
  });
  let html = marked.parse(text);
  html = sanitize(html);
  return html;
}

export function renderLatexInElement(el) {
  if (typeof katex !== "undefined" && typeof katex.render === "function") {
    el.querySelectorAll("span.kp").forEach((span) => {
      const tex = span.textContent;
      const displayMode = span.dataset.m === "d";
      try {
        katex.render(tex, span, { displayMode, throwOnError: true });
      } catch (_e) {
        span.outerHTML = displayMode
          ? `<div class="katex-raw">\\[${tex.replace(/</g, "&lt;")}\\]</div>`
          : `<span class="katex-raw">\\(${tex.replace(/</g, "&lt;")}\\)</span>`;
      }
    });
  }
}

export function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function scrollToBottom() {
  const el = document.getElementById("message-list");
  if (el) el.scrollTop = el.scrollHeight;
}

export function setStatus(text) {
  const el = document.getElementById("status-text");
  if (el) el.textContent = text;
}

export function loadReasoningEnabled() {
  return localStorage.getItem("AideAgent_reasoning_enabled") !== "false";
}

export function saveReasoningEnabled(enabled) {
  localStorage.setItem("AideAgent_reasoning_enabled", enabled);
}
