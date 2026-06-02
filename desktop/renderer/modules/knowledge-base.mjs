let _kbPanelLoaded = false;

function escapeHtml(s) {
  if (!s || typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function loadKnowledgeBasePanel() {
  if (_kbPanelLoaded) return;
  _kbPanelLoaded = true;

  const vaultPath = document.getElementById("kb-vault-path");
  const embeddingSelect = document.getElementById("kb-embedding-provider");
  const statusEl = document.getElementById("kb-status");
  const scanBtn = document.getElementById("kb-scan-btn");
  const testSearchBtn = document.getElementById("kb-test-search-btn");
  const testArea = document.getElementById("kb-test-area");
  const testQuery = document.getElementById("kb-test-query");
  const testResults = document.getElementById("kb-test-results");
  const maxNotes = document.getElementById("kb-max-notes");
  const maxChars = document.getElementById("kb-max-chars");
  const maxBodyChars = document.getElementById("kb-max-body-chars");
  const maxBodyCharsSaveBtn = document.getElementById("kb-max-body-chars-save-btn");
  const autoDetectedSpan = document.getElementById("kb-auto-detected-chars");
  const pickBtn = document.getElementById("kb-pick-vault-btn");
  const ollamaModelRow = document.getElementById("kb-ollama-model-row");
  const ollamaModelSelect = document.getElementById("kb-ollama-model");

  async function fetchOllamaModels(selectedModel) {
    if (!ollamaModelSelect) return;
    ollamaModelSelect.replaceChildren();
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = "检测中…";
    ollamaModelSelect.appendChild(opt);
    try {
      const models = await window.goodAgent.kbOllamaModels();
      ollamaModelSelect.replaceChildren();
      const list = models.length > 0 ? models : ["nomic-embed-text"];
      for (const m of list) {
        const o = document.createElement("option");
        o.value = m; o.textContent = m;
        ollamaModelSelect.appendChild(o);
      }
    } catch {
      ollamaModelSelect.replaceChildren();
      const o = document.createElement("option");
      o.value = "nomic-embed-text"; o.textContent = "nomic-embed-text";
      ollamaModelSelect.appendChild(o);
    }
    if (selectedModel) ollamaModelSelect.value = selectedModel;
  }

  try {
    const vault = await window.goodAgent.kbGetVault();
    if (vaultPath) vaultPath.value = vault || "";
    const cfg = await window.goodAgent.kbConfig();
    if (embeddingSelect) embeddingSelect.value = cfg.embeddingProvider || "local";
    const savedModel = cfg.ollamaEmbedModel || "nomic-embed-text";
    if (cfg.embeddingProvider === "ollama") {
      if (ollamaModelRow) ollamaModelRow.style.display = "block";
      await fetchOllamaModels(savedModel);
    } else if (ollamaModelRow) {
      ollamaModelRow.style.display = "none";
    }
    if (maxNotes) maxNotes.value = cfg.maxNotes || 5;
    if (maxChars) maxChars.value = cfg.maxChars || 500;
    if (maxBodyChars) maxBodyChars.value = cfg.maxBodyChars || 0;
    const status = await window.goodAgent.kbStatus();
    if (autoDetectedSpan) {
      // Show auto-detected value as a hint next to the input
      if (status.autoDetectedMaxBodyChars > 0) {
        autoDetectedSpan.textContent = t("kb.auto_chars").replace("{n}", status.autoDetectedMaxBodyChars);
      }
    }
    if (statusEl) {
      statusEl.textContent = status.noteCount > 0
        ? t("kb.indexed").replace("{count}", status.noteCount).replace("{embedded}", status.embeddedCount)
        : t("kb.not_indexed");
    }
  } catch {}

  pickBtn?.addEventListener("click", async () => {
    try {
      const result = await window.goodAgent.kbPickVault();
      if (result?.canceled) return;
      if (result?.ok && result.vault) {
        vaultPath.value = result.vault;
        scanBtn?.click();
      } else if (result?.error) {
        statusEl.textContent = t("kb.error").replace("{error}", result.error);
      }
    } catch (e) {
      console.error("[kb] pick vault error:", e);
      statusEl.textContent = t("kb.pick_fail").replace("{error}", e.message);
    }
  });

  embeddingSelect?.addEventListener("change", async () => {
    const isOllama = embeddingSelect.value === "ollama";
    if (ollamaModelRow) ollamaModelRow.style.display = isOllama ? "block" : "none";
    if (isOllama) await fetchOllamaModels();
    await window.goodAgent.kbSetConfig({ embeddingProvider: embeddingSelect.value });
  });
  ollamaModelSelect?.addEventListener("change", async () => {
    await window.goodAgent.kbSetConfig({ ollamaEmbedModel: ollamaModelSelect.value || "nomic-embed-text" });
  });
  maxNotes?.addEventListener("change", async () => {
    await window.goodAgent.kbSetConfig({ maxNotes: parseInt(maxNotes.value) || 5 });
  });
  maxChars?.addEventListener("change", async () => {
    await window.goodAgent.kbSetConfig({ maxChars: parseInt(maxChars.value) || 500 });
  });
  maxBodyCharsSaveBtn?.addEventListener("click", async () => {
    const val = parseInt(maxBodyChars.value) || 0;
    await window.goodAgent.kbSetConfig({ maxBodyChars: val });
    // Brief visual feedback
    const orig = maxBodyCharsSaveBtn.textContent;
    maxBodyCharsSaveBtn.textContent = "✓";
    setTimeout(() => { maxBodyCharsSaveBtn.textContent = t("common.save"); }, 1500);
  });

  scanBtn?.addEventListener("click", async () => {
    if (!vaultPath.value) { statusEl.textContent = t("kb.select_vault"); return; }
    scanBtn.disabled = true;
    scanBtn.textContent = t("kb.indexing");
    statusEl.textContent = t("kb.scanning");
    try {
      const result = await window.goodAgent.kbScan();
      if (result.error) {
        statusEl.textContent = t("kb.error").replace("{error}", result.error);
      } else {
        statusEl.textContent = t("kb.index_success").replace("{count}", result.indexed).replace("{embedded}", result.embedded);
      }
    } catch (e) {
      statusEl.textContent = t("kb.error").replace("{error}", e.message);
    }
    scanBtn.disabled = false;
    scanBtn.textContent = t("kb.scan_btn");
  });

  testSearchBtn?.addEventListener("click", () => {
    testArea.style.display = testArea.style.display === "none" ? "block" : "none";
    if (testArea.style.display === "block") testQuery?.focus();
  });

  testQuery?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const query = testQuery.value.trim();
      if (!query) return;
      testResults.textContent = ""; // clear
      const statusDiv = document.createElement("div");
      statusDiv.style.cssText = "color:var(--text-muted);font-size:12px;";
      statusDiv.textContent = t("kb.searching");
      testResults.appendChild(statusDiv);
      try {
        const results = await window.goodAgent.kbSearch(query, 5);
        testResults.replaceChildren();
        if (results.length === 0) {
          const noDiv = document.createElement("div");
          noDiv.style.cssText = "color:var(--text-muted);font-size:12px;";
          noDiv.textContent = t("kb.no_results");
          testResults.appendChild(noDiv);
          return;
        }
        for (const r of results) {
          const item = document.createElement("div");
          item.className = "kb-result-item";

          const titleDiv = document.createElement("div");
          titleDiv.className = "kb-result-title";
          titleDiv.textContent = r.title || r.rel_path;
          item.appendChild(titleDiv);

          const pathDiv = document.createElement("div");
          pathDiv.className = "kb-result-path";
          pathDiv.textContent = r.rel_path;
          item.appendChild(pathDiv);

          const snippetDiv = document.createElement("div");
          snippetDiv.className = "kb-result-snippet";
          snippetDiv.textContent = r.snippet || "";
          item.appendChild(snippetDiv);

          testResults.appendChild(item);
        }
      } catch (e) {
        testResults.replaceChildren();
        const errDiv = document.createElement("div");
        errDiv.style.cssText = "color:var(--danger);font-size:12px;";
        errDiv.textContent = e.message;
        testResults.appendChild(errDiv);
      }
    }
  });
}

export function initKnowledgeBase() {
  document.querySelector('.settings-tab[data-tab="knowledge-base"]')
    ?.addEventListener("click", loadKnowledgeBasePanel);

  document.getElementById("kb-pick-vault-btn")?.addEventListener("click", async () => {
    try {
      const result = await window.goodAgent.kbPickVault();
      if (result?.canceled) return;
      if (result?.ok && result.vault) {
        const vp = document.getElementById("kb-vault-path");
        if (vp) vp.value = result.vault;
        document.getElementById("kb-scan-btn")?.click();
      }
    } catch (e) {
      console.error("[kb] pick vault fallback error:", e);
    }
  });

  document.getElementById("kb-clear-vault-btn")?.addEventListener("click", async () => {
    try {
      await window.goodAgent.kbSetVault("");
      const vp = document.getElementById("kb-vault-path");
      if (vp) vp.value = "";
      const st = document.getElementById("kb-status");
      if (st) st.textContent = t("kb.unconfigured");
    } catch (e) {
      console.error("[kb] clear vault error:", e);
    }
  });

  const _kbToggle = document.getElementById("kb-toggle");
  if (_kbToggle) {
    _kbToggle.checked = localStorage.getItem("goodagent_kb_enabled") === "true";
    _kbToggle.addEventListener("change", () => {
      localStorage.setItem("goodagent_kb_enabled", _kbToggle.checked);
    });
  }

  const _webSearchToggle = document.getElementById("web-search-toggle");
  if (_webSearchToggle) {
    const saved = localStorage.getItem("goodagent_web_search_enabled");
    _webSearchToggle.checked = saved === null ? true : saved === "true";
    _webSearchToggle.addEventListener("change", () => {
      localStorage.setItem("goodagent_web_search_enabled", _webSearchToggle.checked);
    });
  }
}
