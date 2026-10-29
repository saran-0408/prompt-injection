/* ═══════════════════════════════════════════════════════════════
   SKAR — app.js  |  Claude-Style Chat Engine & Persistent History
═══════════════════════════════════════════════════════════════ */

// ─── Local Storage Keys ───────────────────────────────────────────────────────
const LS_SESSIONS_KEY = "skar_local_sessions_v2";
const LS_MSGS_PREFIX  = "skar_local_msgs_v2_";
const LS_SETTINGS_KEY = "skar_settings_v1";
const LS_CURRENT_SESS = "skar_current_session";

// ─── Local Persistence Layer ──────────────────────────────────────────────────
function getLocalSessions() {
  try {
    const raw = localStorage.getItem(LS_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSession(sessionId, titleText) {
  const sessions = getLocalSessions();
  const cleanTitle = (titleText || "New Conversation").slice(0, 45) + (titleText?.length > 45 ? "..." : "");
  const existingIdx = sessions.findIndex(s => s.id === sessionId);

  if (existingIdx >= 0) {
    sessions[existingIdx].updated_at = new Date().toISOString();
    if (titleText && (!sessions[existingIdx].title || sessions[existingIdx].title === "New Conversation")) {
      sessions[existingIdx].title = cleanTitle;
    }
    const [updated] = sessions.splice(existingIdx, 1);
    sessions.unshift(updated);
  } else {
    sessions.unshift({
      id: sessionId,
      title: cleanTitle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  try {
    localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn("Storage quota notice:", e);
  }
  return sessions;
}

function getLocalMessages(sessionId) {
  try {
    const raw = localStorage.getItem(LS_MSGS_PREFIX + sessionId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendLocalMessage(sessionId, messageObj) {
  const msgs = getLocalMessages(sessionId);
  msgs.push({
    ...messageObj,
    created_at: messageObj.created_at || new Date().toISOString()
  });

  try {
    localStorage.setItem(LS_MSGS_PREFIX + sessionId, JSON.stringify(msgs));
  } catch (e) {
    console.warn("Storage quota warning on message save:", e);
  }

  // Update session title and timestamp
  saveLocalSession(sessionId, messageObj.role === "user" ? messageObj.content : undefined);
}

function deleteLocalSession(sessionId) {
  const sessions = getLocalSessions().filter(s => s.id !== sessionId);
  try {
    localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(sessions));
    localStorage.removeItem(LS_MSGS_PREFIX + sessionId);
  } catch {}
}

// ─── User Settings & Preferences ─────────────────────────────────────────────
function getSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {
      hfToken: "",
      openaiKey: "",
      modelPreference: "auto",
      responseDepth: "exhaustive"
    };
  } catch {
    return { hfToken: "", openaiKey: "", modelPreference: "auto", responseDepth: "exhaustive" };
  }
}

function saveSettings() {
  const hfToken = (document.getElementById("hf-token-input")?.value || "").trim();
  const openaiKey = (document.getElementById("openai-key-input")?.value || "").trim();
  const modelPreference = document.getElementById("image-model-select")?.value || "auto";
  const responseDepth = document.getElementById("response-depth-select")?.value || "exhaustive";

  const cfg = { hfToken, openaiKey, modelPreference, responseDepth };
  localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(cfg));
  closeSettingsModal();

  const btn = document.getElementById("save-settings-btn");
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "Saved ✓";
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }
}

function populateSettingsUI() {
  const s = getSettings();
  const hfInput = document.getElementById("hf-token-input");
  const oaiInput = document.getElementById("openai-key-input");
  const imgSelect = document.getElementById("image-model-select");
  const depthSelect = document.getElementById("response-depth-select");

  if (hfInput) hfInput.value = s.hfToken || "";
  if (oaiInput) oaiInput.value = s.openaiKey || "";
  if (imgSelect) imgSelect.value = s.modelPreference || "auto";
  if (depthSelect) depthSelect.value = s.responseDepth || "exhaustive";
}

// ─── Current Active Session ───────────────────────────────────────────────────
let SESSION_ID = localStorage.getItem(LS_CURRENT_SESS);
if (!SESSION_ID) {
  SESSION_ID = "session_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem(LS_CURRENT_SESS, SESSION_ID);
}

let allSessionsCache = [];

// ─── DOM References ───────────────────────────────────────────────────────────
const appLayout          = document.getElementById("app-layout");
const appSidebar         = document.getElementById("app-sidebar");
const sidebarToggleBtn    = document.getElementById("sidebar-toggle-btn");
const sidebarCloseBtn     = document.getElementById("sidebar-close-btn");
const sidebarBackdrop    = document.getElementById("sidebar-backdrop");
const sidebarNewChatBtn   = document.getElementById("sidebar-new-chat-btn");
const searchHistoryInput = document.getElementById("search-history-input");
const historyList        = document.getElementById("history-list");

const settingsBtn        = document.getElementById("settings-btn");
const settingsModal      = document.getElementById("settings-modal");

const chatArea           = document.getElementById("chat-area");
const messages           = document.getElementById("messages");
const welcomeScr         = document.getElementById("welcome-screen");
const userInput          = document.getElementById("user-input");
const sendBtn            = document.getElementById("send-btn");
const clearBtn           = document.getElementById("clear-btn");
const voiceBtn           = document.getElementById("voice-btn");
const charCount          = document.getElementById("char-count");
const statusBadge        = document.getElementById("status-indicator");
const statusText         = statusBadge.querySelector(".status-text");

const lightbox           = document.getElementById("lightbox");
const lightboxImg        = document.getElementById("lightbox-img");
const lightboxDl         = document.getElementById("lightbox-download");

let isThinking = false;

// ─── Sidebar Toggle Logic ─────────────────────────────────────────────────────
function isMobile() {
  return window.innerWidth <= 768;
}

if (!isMobile() && localStorage.getItem("skar_sidebar_collapsed") === "true") {
  appLayout.classList.add("sidebar-collapsed");
}

function toggleSidebar() {
  if (isMobile()) {
    appLayout.classList.toggle("sidebar-open");
  } else {
    appLayout.classList.toggle("sidebar-collapsed");
    const isCollapsed = appLayout.classList.contains("sidebar-collapsed");
    localStorage.setItem("skar_sidebar_collapsed", isCollapsed ? "true" : "false");
  }
}

function closeMobileSidebar() {
  appLayout.classList.remove("sidebar-open");
}

if (sidebarToggleBtn) sidebarToggleBtn.addEventListener("click", toggleSidebar);
if (sidebarCloseBtn) {
  sidebarCloseBtn.addEventListener("click", () => {
    if (isMobile()) {
      closeMobileSidebar();
    } else {
      appLayout.classList.add("sidebar-collapsed");
      localStorage.setItem("skar_sidebar_collapsed", "true");
    }
  });
}
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeMobileSidebar);

// ─── Settings Modal Handlers ──────────────────────────────────────────────────
function openSettingsModal() {
  populateSettingsUI();
  if (settingsModal) {
    settingsModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
}

function closeSettingsModal() {
  if (settingsModal) {
    settingsModal.style.display = "none";
    document.body.style.overflow = "";
  }
}

window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.fillInput = fillInput;
window.copyCode = copyCode;

if (settingsBtn) settingsBtn.addEventListener("click", openSettingsModal);

// ─── Status indicator helper ──────────────────────────────────────────────────
function setStatus(mode, text = "") {
  if (mode === "online") {
    statusBadge.className = "model-badge";
    statusText.textContent = text || "GPT-OSS 120B";
  } else if (mode === "thinking") {
    statusBadge.className = "model-badge thinking";
    statusText.textContent = text || "Thinking...";
  }
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
  // Clean raw LaTeX tags that look like random code
  let clean = String(text || "")
    .replace(/\\\[\s*/g, "")
    .replace(/\s*\\\]/g, "")
    .replace(/\\\(\s*/g, "")
    .replace(/\s*\\\)/g, "")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathcal\{([^}]+)\}/g, "$1")
    .replace(/\\mathbf\{([^}]+)\}/g, "$1")
    .replace(/\\rightarrow/g, "->")
    .replace(/\\exists/g, "exists")
    .replace(/\\neg/g, "NOT ")
    .replace(/\\;/g, " ")
    .replace(/\\,/g, " ");

  return clean
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const language = lang || "code";
      return `<div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${language}</span>
          <button class="copy-code-btn" onclick="copyCode(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
        </div>
        <pre><code class="lang-${language}">${escHtml(code.trim())}</code></pre>
      </div>`;
    })
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\s*[-*•] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^---$/gm, "<hr>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

function escHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function copyCode(btn) {
  const code = btn.closest(".code-block-wrapper").querySelector("code").innerText;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = `✓ Copied!`;
    setTimeout(() => {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
    }, 2000);
  });
}

// ─── Bubble Builders (NO ID COLLISIONS - Guaranteed Never Vanishes) ────────────
function appendUserMessage(text) {
  welcomeScr.style.display = "none";

  const div = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = `
    <div class="msg-avatar"><span class="icon-mark">◉</span></div>
    <div class="msg-bubble">${escHtml(text).replace(/\n/g,"<br>")}</div>
  `;
  messages.appendChild(div);
  scrollToBottom();
}

/**
 * Creates an assistant bubble that returns a discrete controller.
 * NO ID queries like getElementById("active-bubble") that cause overwriting!
 */
function createAssistantBubble() {
  welcomeScr.style.display = "none";

  const div = document.createElement("div");
  div.className = "msg assistant";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerHTML = `<div class="chrome-shape-sprite sprite-starburst-avatar"></div>`;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  const content = document.createElement("div");
  content.className = "msg-text-content";
  content.innerHTML = '<span class="typing-cursor"></span>';

  bubble.appendChild(content);
  div.appendChild(avatar);
  div.appendChild(bubble);
  messages.appendChild(div);
  scrollToBottom();

  return {
    root: div,
    bubble: bubble,
    content: content,
    thinkBox: null,
    thinkContent: null,
    appendReasoning(text) {
      if (!this.thinkBox) {
        this.thinkBox = document.createElement("details");
        this.thinkBox.className = "think-box";
        this.thinkBox.innerHTML = `<summary><span class="icon-mark">✦</span> Thought Process</summary><div class="think-content"></div>`;
        this.bubble.insertBefore(this.thinkBox, this.content);
        this.thinkContent = this.thinkBox.querySelector(".think-content");
      }
      this.thinkContent.textContent += text;
      scrollToBottom();
    },
    updateText(markdown) {
      this.content.innerHTML = `<p>${renderMarkdown(markdown)}</p><span class="typing-cursor"></span>`;
      scrollToBottom();
    },
    finish(finalMarkdown) {
      if (finalMarkdown !== undefined) {
        this.content.innerHTML = `<p>${renderMarkdown(finalMarkdown)}</p>`;
      } else {
        const cur = this.content.querySelector(".typing-cursor");
        if (cur) cur.remove();
      }
    }
  };
}

function createStatusBubble(text) {
  const div = document.createElement("div");
  div.className = "status-bubble";
  div.id = "status-bubble-indicator";
  div.innerHTML = `<div class="spinner"></div><span class="status-bubble-text">${escHtml(text)}</span>`;
  messages.appendChild(div);
  scrollToBottom();
  return div;
}

function updateStatusBubble(text) {
  const el = document.getElementById("status-bubble-indicator");
  if (el) {
    const span = el.querySelector(".status-bubble-text");
    if (span) span.textContent = text;
  }
}

function removeStatusBubble() {
  const el = document.getElementById("status-bubble-indicator");
  if (el) el.remove();
}

function appendErrorMessage(text) {
  removeStatusBubble();
  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `
    <div class="msg-avatar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
    </div>
    <div class="msg-bubble"><div class="error-bubble">[ERROR] ${escHtml(text)}</div></div>
  `;
  messages.appendChild(div);
  scrollToBottom();
}

function appendSourcesRow(bubbleEl, sources) {
  if (!sources?.length) return;
  const header = document.createElement("div");
  header.className = "sources-header";
  header.innerHTML = `<span class="sources-label">VERIFIED SOURCES</span>`;
  const row = document.createElement("div");
  row.className = "sources-row";
  sources.forEach(s => {
    const a = document.createElement("a");
    a.className = "source-tag";
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    // Extract domain for display
    let domain = s.url;
    try { domain = new URL(s.url).hostname.replace("www.", ""); } catch {}
    const title = s.title || domain;
    a.innerHTML = `<span class="source-domain">[${domain}]</span><span class="source-title-text">${escHtml(title.slice(0, 55))}</span>`;
    a.title = s.url;
    row.appendChild(a);
  });
  bubbleEl.appendChild(header);
  bubbleEl.appendChild(row);
}

function appendImageCard(bubbleEl, imageData, caption, prompt, modelBadge = "FLUX.1-SCHNELL") {
  const card = document.createElement("div");
  card.className = "image-card";
  card.innerHTML = `
    <div class="image-badge">${escHtml(modelBadge)} · 1024×1024</div>
    <img src="${imageData}" alt="${escHtml(prompt)}" loading="lazy" />
    <div class="image-caption">${escHtml(caption || "High-resolution output generated.")}</div>
  `;
  card.addEventListener("click", () => openLightbox(imageData, prompt));
  bubbleEl.appendChild(card);
}

// ─── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(src, caption) {
  lightboxImg.src = src;
  lightboxImg.alt = caption;
  lightboxDl.href = src;
  lightbox.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.remove("open");
  document.body.style.overflow = "";
}

document.addEventListener("keydown", e => { 
  if (e.key === "Escape") {
    closeLightbox();
    closeSettingsModal();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault();
    toggleSidebar();
  }
});

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

// ─── Send Message Engine ───────────────────────────────────────────────────────
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isThinking) return;

  isThinking = true;
  sendBtn.disabled = true;
  setStatus("thinking", "Synthesizing...");

  userInput.value = "";
  userInput.style.height = "auto";
  charCount.textContent = "0/4000";

  // 1. Immediately persist user message to localStorage
  appendLocalMessage(SESSION_ID, {
    role: "user",
    content: text,
    type: "text",
    created_at: new Date().toISOString()
  });

  appendUserMessage(text);
  createStatusBubble("Connecting to SKAR 120B...");
  loadHistoryList(); // Update sidebar active list

  let assistantCtrl = null;
  let fullText = "";
  let imageOutput = null;

  try {
    const localMsgs = getLocalMessages(SESSION_ID);
    // Exclude the current user message that was just appended above, take previous 10 messages
    const historyPayload = localMsgs.slice(0, -1).slice(-10).map(m => ({ role: m.role, content: m.content }));
    const settingsPayload = getSettings();

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: text, 
        sessionId: SESSION_ID,
        history: historyPayload,
        settings: settingsPayload
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }

        switch (evt.type) {
          case "search_status":
            updateStatusBubble(evt.text);
            break;

          case "status":
            updateStatusBubble(evt.text);
            break;

          case "model_badge":
            updateStatusBubble(evt.model);
            break;

          case "reasoning_chunk":
            if (!assistantCtrl) {
              removeStatusBubble();
              assistantCtrl = createAssistantBubble();
            }
            assistantCtrl.appendReasoning(evt.text);
            break;

          case "text_chunk":
            if (!assistantCtrl) {
              removeStatusBubble();
              assistantCtrl = createAssistantBubble();
              fullText = "";
            }
            fullText += evt.text;
            assistantCtrl.updateText(fullText);
            break;

          case "image":
            removeStatusBubble();
            if (!assistantCtrl) assistantCtrl = createAssistantBubble();
            assistantCtrl.content.innerHTML = "";
            appendImageCard(assistantCtrl.content, evt.imageData, evt.caption, evt.prompt, evt.model || "FLUX.1-SCHNELL");
            imageOutput = evt;
            scrollToBottom();
            break;

          case "sources":
            if (assistantCtrl) appendSourcesRow(assistantCtrl.bubble, evt.sources);
            break;

          case "error":
            appendErrorMessage(evt.text);
            break;

          case "done":
            if (assistantCtrl) {
              assistantCtrl.finish();
            }
            break;
        }
      }
    }
  } catch (err) {
    console.error(err);
    appendErrorMessage(err.message || "Connection lost. Please try again.");
  } finally {
    // 2. Persist assistant response to localStorage unconditionally
    if (imageOutput) {
      appendLocalMessage(SESSION_ID, {
        role: "assistant",
        content: imageOutput.prompt,
        type: "image",
        image_data: imageOutput.imageData,
        model: imageOutput.model || "FLUX.1",
        created_at: new Date().toISOString()
      });
    } else if (fullText) {
      appendLocalMessage(SESSION_ID, {
        role: "assistant",
        content: fullText,
        type: "text",
        model: "GPT-OSS 120B",
        created_at: new Date().toISOString()
      });
    }

    if (assistantCtrl) {
      assistantCtrl.finish();
    }
    removeStatusBubble();

    isThinking = false;
    sendBtn.disabled = false;
    setStatus("online");
    userInput.focus();
    scrollToBottom();
    loadHistoryList();
  }
}

// ─── Input & Event Listeners ──────────────────────────────────────────────────
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 200) + "px";
  charCount.textContent = `${userInput.value.length}/4000`;
});

sendBtn.addEventListener("click", sendMessage);

// ─── New Chat Functionality ────────────────────────────────────────────────────
function startNewChat(preserveTranscript = true) {
  if (isThinking) return;

  const hasVisibleMessages = messages.querySelector(".msg");
  if (!preserveTranscript) {
    messages.innerHTML = "";
    welcomeScr.style.display = "flex";
  } else if (hasVisibleMessages) {
    welcomeScr.style.display = "none";
    if (!messages.lastElementChild?.classList.contains("conversation-divider")) {
      const divider = document.createElement("div");
      divider.className = "conversation-divider";
      divider.setAttribute("role", "separator");
      divider.textContent = "New conversation";
      messages.appendChild(divider);
      scrollToBottom();
    }
  }

  SESSION_ID = "session_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem(LS_CURRENT_SESS, SESSION_ID);
  userInput.focus();
  loadHistoryList();
  if (isMobile()) closeMobileSidebar();
}

clearBtn.addEventListener("click", startNewChat);
sidebarNewChatBtn.addEventListener("click", startNewChat);

// ─── Claude-Style History Categorization ────────────────────────────────────────
function groupSessionsClaudeStyle(sessions) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const sevenDaysAgo = startOfToday - 7 * 86400000;
  const thirtyDaysAgo = startOfToday - 30 * 86400000;

  const groups = [
    { title: "Today", items: [] },
    { title: "Yesterday", items: [] },
    { title: "Previous 7 Days", items: [] },
    { title: "Previous 30 Days", items: [] },
    { title: "Older", items: [] }
  ];

  sessions.forEach(s => {
    const time = new Date(s.updated_at || s.created_at || Date.now()).getTime();
    if (time >= startOfToday) {
      groups[0].items.push(s);
    } else if (time >= startOfYesterday) {
      groups[1].items.push(s);
    } else if (time >= sevenDaysAgo) {
      groups[2].items.push(s);
    } else if (time >= thirtyDaysAgo) {
      groups[3].items.push(s);
    } else {
      groups[4].items.push(s);
    }
  });

  return groups.filter(g => g.items.length > 0);
}

// ─── Load & Render Sidebar ─────────────────────────────────────────────────────
async function loadHistoryList() {
  let localSessions = getLocalSessions();

  // Background fetch to sync from SQLite if available
  try {
    const res = await fetch("/api/sessions");
    if (res.ok) {
      const data = await res.json();
      const serverSessions = data.sessions || [];
      
      serverSessions.forEach(ss => {
        if (!localSessions.some(ls => ls.id === ss.id)) {
          localSessions.push(ss);
        }
      });
      localSessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(localSessions));
    }
  } catch {}

  allSessionsCache = localSessions;
  renderSessions(allSessionsCache);
}

function renderSessions(sessions) {
  if (!sessions || sessions.length === 0) {
    historyList.innerHTML = `<div class="history-empty">No conversations stored yet</div>`;
    return;
  }

  const groups = groupSessionsClaudeStyle(sessions);
  historyList.innerHTML = "";

  groups.forEach(group => {
    const groupEl = document.createElement("div");
    groupEl.className = "history-category-group";

    const labelEl = document.createElement("div");
    labelEl.className = "history-category-label";
    labelEl.textContent = group.title;
    groupEl.appendChild(labelEl);

    group.items.forEach(s => {
      const item = document.createElement("div");
      item.className = "history-item" + (s.id === SESSION_ID ? " active" : "");
      
      item.innerHTML = `
        <div class="history-item-content">
          <span class="history-item-title">${escHtml(s.title || "Conversation")}</span>
        </div>
        <button class="history-delete-btn" title="Delete conversation">✕</button>
      `;

      item.querySelector(".history-item-content").addEventListener("click", () => {
        switchSession(s.id);
        if (isMobile()) closeMobileSidebar();
      });

      item.querySelector(".history-delete-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (isThinking) return;
        if (confirm("Delete this conversation?")) {
          deleteLocalSession(s.id);
          try { await fetch(`/api/sessions/${s.id}`, { method: "DELETE" }); } catch {}
          if (s.id === SESSION_ID) {
            startNewChat(false);
          } else {
            loadHistoryList();
          }
        }
      });

      groupEl.appendChild(item);
    });

    historyList.appendChild(groupEl);
  });
}

// Search in conversation history
searchHistoryInput.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) {
    renderSessions(allSessionsCache);
    return;
  }
  const filtered = allSessionsCache.filter(s => (s.title || "").toLowerCase().includes(q));
  renderSessions(filtered);
});

// ─── Switch Conversation Session ──────────────────────────────────────────────
async function switchSession(sessionId) {
  if (isThinking) return;

  SESSION_ID = sessionId;
  localStorage.setItem(LS_CURRENT_SESS, SESSION_ID);
  messages.innerHTML = "";

  // Highlight active session
  document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active"));
  loadHistoryList();

  // 1. Instant render from localStorage
  const localMsgs = getLocalMessages(sessionId);
  if (localMsgs.length > 0) {
    welcomeScr.style.display = "none";
    localMsgs.forEach(m => renderStaticMessage(m));
    scrollToBottom();
    return;
  }

  // 2. Fallback to server SQLite fetch if local storage was empty
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const data = await res.json();
    const serverMsgs = data.messages || [];

    if (serverMsgs.length === 0) {
      welcomeScr.style.display = "flex";
      return;
    }

    welcomeScr.style.display = "none";
    serverMsgs.forEach(m => appendLocalMessage(sessionId, m));
    serverMsgs.forEach(m => renderStaticMessage(m));
    scrollToBottom();
  } catch (err) {
    console.error("Error loading session:", err);
  }
}

function renderStaticMessage(m) {
  if (m.role === "user") {
    appendUserMessage(m.content);
  } else {
    const ctrl = createAssistantBubble();
    if (m.type === "image" && m.image_data) {
      ctrl.content.innerHTML = "";
      appendImageCard(ctrl.content, m.image_data, "Generated render.", m.content, m.model || "FLUX.1-SCHNELL");
    } else {
      ctrl.finish(m.content);
    }
  }
}

// ─── Voice Input (Web Speech API) ──────────────────────────────────────────────
let recognition = null;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => voiceBtn.classList.add("listening");
  recognition.onend   = () => voiceBtn.classList.remove("listening");
  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript).join("");
    userInput.value = transcript;
    userInput.dispatchEvent(new Event("input"));
    if (e.results[e.results.length - 1].isFinal) {
      recognition.stop();
      setTimeout(sendMessage, 500);
    }
  };
  recognition.onerror = () => voiceBtn.classList.remove("listening");
} else {
  if (voiceBtn) {
    voiceBtn.title = "Voice not supported in this browser";
    voiceBtn.style.opacity = "0.4";
  }
}

if (voiceBtn) {
  voiceBtn.addEventListener("click", () => {
    if (!recognition) return;
    if (voiceBtn.classList.contains("listening")) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

// ─── Suggestion Chips Helper ───────────────────────────────────────────────────
function fillInput(text) {
  userInput.value = text;
  userInput.dispatchEvent(new Event("input"));
  userInput.focus();
  sendMessage();
}

// ─── Cyber Diagnostics & Status Monitor ───────────────────────────────────────
const CYBER_DIAGNOSTICS = [
  "[SYS.ONLINE] Core operating at nominal load // High-priority pipeline active",
  "[NEURAL.MATRIX] GPT-OSS 120B / Qwen 27B dual failover channels ready",
  "[QUANTUM.CACHE] Vector history persistent across local session store",
  "[RENDER.CORE] FLUX.1 neural engine standby for high-definition generation",
  "[STUDY.MATRIX] Deep learning synthesis & examination modules primed",
  "[SECURITY] Anti-anchoring context buffer enabled // Direct objective analysis"
];
let diagIdx = 0;

function triggerCyberPing() {
  diagIdx = (diagIdx + 1) % CYBER_DIAGNOSTICS.length;
  const msg = CYBER_DIAGNOSTICS[diagIdx];
  const txtEl = document.getElementById("companion-text");
  const pillEl = document.getElementById("companion-pill");
  if (txtEl) {
    txtEl.textContent = msg;
  }
  if (pillEl) {
    pillEl.classList.remove("status-ping-active");
    void pillEl.offsetWidth;
    pillEl.classList.add("status-ping-active");
  }
}

// Fallback alias for backward compatibility
function triggerCuteGreeting() {
  triggerCyberPing();
}

// ─── Study Materials Hub Engine ────────────────────────────────────────────────
let currentSelectedTool = "flashcards";

function openStudyHubModal() {
  const modal = document.getElementById("study-hub-modal");
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      document.getElementById("study-topic-input")?.focus();
    }, 100);
  }
}

function closeStudyHubModal() {
  const modal = document.getElementById("study-hub-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
}

function selectStudyTool(tool) {
  currentSelectedTool = tool;
  document.querySelectorAll(".study-card").forEach(c => c.style.borderColor = "var(--border)");
  if (window.event?.currentTarget) {
    window.event.currentTarget.style.borderColor = "#a1a1aa";
  }
}

function getStudyPrompt(toolType, topic) {
  const t = (topic || "").trim();
  switch (toolType) {
    case "flashcards":
      return `Create 10 high-yield Active Recall Flashcards for "${t}". Format as a clean, structured Markdown table with:
| Card # | Front: Concept / Exam Question | Back: Detailed Answer & Key Principle | Memory Mnemonic / Hook |
Provide thorough, accurate, and exam-ready explanations.`;
    case "cram-sheet":
      return `Generate an exhaustive, high-yield 1-Page Exam Revision Cram Sheet for "${t}". Include:
1. Executive Summary & Core Principles
2. Fundamental Laws, Theorems & Formulas (with LaTeX math formatting)
3. Essential Definitions & Key Terminology
4. Common Exam Traps, Fallacies & Edge Cases
5. High-Yield 5-Point Quick Review Checklist`;
    case "feynman":
      return `Explain "${t}" using the Feynman Technique across three distinct progressive depth levels:
1. Level 1: Everyday Analogy (Simple intuitive metaphor that anyone can grasp immediately)
2. Level 2: Core Mechanics (Rigorous technical explanation with step-by-step mechanisms & equations)
3. Level 3: Advanced Real-World System Model (Edge cases, architectural applications & industrial practice)`;
    case "quiz":
      return `Create a challenging 5-question Mock Practice Exam on "${t}".
For each question:
- State the question clearly with a practical scenario
- Provide 4 multiple-choice options: A, B, C, D
- Provide the detailed Answer Key with explicit rationales for why the correct option is right and why each distractor is wrong.`;
    case "formulas":
      return `Construct a structured Formula Cheat Sheet & Theoretical Derivation Vault for "${t}".
Include:
- Master Formula Table (Symbol, LaTeX Equation, Variable Meanings, Standard Units)
- Step-by-step mathematical proof / derivation for the most critical equation
- Boundary conditions and assumptions under which each formula holds.`;
    case "roadmap":
      return `Build an intensive, actionable 7-Day Mastery Study Roadmap for "${t}".
For each day (Day 1 to Day 7):
- Daily Objective & Sub-topics
- Key reading / conceptual focus
- 3 Practice Problems / Implementation tasks
- Daily Self-Assessment Checkpoint`;
    default:
      return `Provide comprehensive, structured study materials, flashcards, and clear technical notes on "${t}".`;
  }
}

function generateFromStudyModal() {
  const topic = (document.getElementById("study-topic-input")?.value || "").trim();
  if (!topic) {
    alert("Please enter a subject or topic to study!");
    document.getElementById("study-topic-input")?.focus();
    return;
  }
  closeStudyHubModal();
  const prompt = getStudyPrompt(currentSelectedTool, topic);
  fillInput(prompt);
}

function promptStudyMaterial(toolType) {
  const sampleTopics = {
    "flashcards": "Operating Systems: Process Synchronization & Deadlocks",
    "cram-sheet": "Machine Learning: Gradient Descent, Regularization & Backprop",
    "feynman": "Quantum Superposition & Quantum Entanglement",
    "quiz": "Computer Networks: TCP/IP, Subnetting & Handshake Protocols",
    "formulas": "Calculus: Multivariable Derivatives & Taylor Series Expansion",
    "roadmap": "Full-Stack System Design & Distributed Databases"
  };
  const topic = prompt("Enter the subject or topic you want to study:", sampleTopics[toolType] || "Data Structures and Algorithms");
  if (topic && topic.trim()) {
    const promptText = getStudyPrompt(toolType, topic.trim());
    fillInput(promptText);
  }
}

window.openStudyHubModal = openStudyHubModal;
window.closeStudyHubModal = closeStudyHubModal;
window.selectStudyTool = selectStudyTool;
window.generateFromStudyModal = generateFromStudyModal;
window.promptStudyMaterial = promptStudyMaterial;
window.triggerCuteGreeting = triggerCuteGreeting;

// ─── Auto-Load on Startup ──────────────────────────────────────────────────────
window.addEventListener("load", () => {
  userInput.focus();
  populateSettingsUI();
  loadHistoryList();
  if (SESSION_ID) {
    switchSession(SESSION_ID);
  }
});
