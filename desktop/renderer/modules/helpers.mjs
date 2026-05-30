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
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, '<span class="kp" data-m="d">$1</span>');
  text = text.replace(/\\\(/g, '<span class="kp" data-m="i">');
  text = text.replace(/\\\)/g, '</span>');
  text = text.replace(/\\\[/g, '<span class="kp" data-m="d">');
  text = text.replace(/\\\]/g, '</span>');
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
  return localStorage.getItem("goodagent_reasoning_enabled") !== "false";
}

export function saveReasoningEnabled(enabled) {
  localStorage.setItem("goodagent_reasoning_enabled", enabled);
}
