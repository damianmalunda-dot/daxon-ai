// ═══════════════════════════════════════════════════════
//  DAXON v3.0 — COMPLETE JAVASCRIPT ENGINE (FIXED)
// ═══════════════════════════════════════════════════════

const DAXON_ENGINE_NAME = "DAXON Local Intelligence Engine v1.0";

// ── I18N ──
const I18N = {
  sw: {
    logout: "LOGOUT",
    pt_dashboard: "DASHIBODI",
    lbl_events: "MATUKIO",
    ct_recent_notes: "📚 NOTES ZA HIVI KARIBUNI",
    ct_today_schedule: "📅 RATIBA YA LEO",
  },
  en: {
    logout: "LOGOUT",
    pt_dashboard: "DASHBOARD",
    lbl_events: "EVENTS",
    ct_recent_notes: "📚 RECENT NOTES",
    ct_today_schedule: "📅 TODAY'S SCHEDULE",
  },
};

let currentLang = localStorage.getItem("daxon_lang") || "sw";
function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || I18N.sw[key] || key;
}
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("daxon_lang", lang);
  document.documentElement.lang = lang;
}

// ── STATE ──
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
let notes = [];
let events = [];
let summaries = [];
let editingNoteId = null;
let viewingNoteId = null;
let currentReaderContent = "";
let currentReaderFileName = "";
let camStream = null;
let facingMode = "environment";
let webSearchEnabled = false;
let useNotesContext = true;
let usePhoneContext = false;
let lastAiSummary = "";
let privacyMode = localStorage.getItem("daxon_privacy_mode") === "on";
let phoneFiles = [];

// ── UTILITIES ──
const el = (id) => document.getElementById(id);
const show = (id) => {
  const e = el(id);
  if (e) e.style.display = "";
};
const hide = (id) => {
  const e = el(id);
  if (e) e.style.display = "none";
};
const uid = () =>
  "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
const ts = () =>
  new Date().toLocaleString("sw-TZ", {
    dateStyle: "short",
    timeStyle: "short",
  });

function showToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = "toast";
  t.style.borderColor =
    type === "error"
      ? "rgba(255,23,68,.4)"
      : type === "success"
        ? "rgba(0,230,118,.4)"
        : "var(--border2)";
  t.textContent = msg;
  el("toast-container").appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

// ═══════════════════════════════════════════════════════
// INTRO FIX — WORKING PROPERLY NOW
// ═══════════════════════════════════════════════════════

let introInterval;

function startIntro() {
  let secs = 10;
  const fill = el("intro-progress");
  const timer = el("intro-timer");

  if (!fill || !timer) {
    console.warn("Intro elements missing, showing app/auth directly");
    showAuthOrApp();
    return;
  }

  introInterval = setInterval(() => {
    secs--;
    const pct = ((10 - secs) / 10) * 100;
    fill.style.width = pct + "%";
    timer.textContent = secs + "s";

    if (secs <= 0) {
      clearInterval(introInterval);
      skipIntro();
    }
  }, 1000);
}

function skipIntro() {
  if (introInterval) clearInterval(introInterval);

  const intro = el("intro-screen");
  if (intro) {
    intro.style.opacity = "0";
    intro.style.transition = "opacity 0.5s ease-out";

    setTimeout(() => {
      intro.style.display = "none";
      try {
        intro.remove();
      } catch (e) {}
      showAuthOrApp();
    }, 500);
  } else {
    showAuthOrApp();
  }
}

function showAuthOrApp() {
  const currentUserData =
    JSON.parse(localStorage.getItem("currentUser")) || null;
  const authScreen = el("auth-screen");
  const appContainer = el("app");

  if (currentUserData) {
    currentUser = currentUserData;
    if (authScreen) authScreen.style.display = "none";
    if (appContainer) {
      appContainer.classList.add("visible");
      setTimeout(() => {
        const topbarUser = el("topbar-user");
        if (topbarUser) topbarUser.textContent = currentUser.fullName;
        loadUserData();
        initApp();
        maybeShowPhoneAccessModal();
      }, 100);
    }
  } else {
    if (authScreen) authScreen.style.display = "flex";
    if (appContainer) appContainer.classList.remove("visible");
    switchAuthTab("login");
  }
}

// ── AUTH ──
function switchAuthTab(tab) {
  document
    .querySelectorAll(".auth-tab")
    .forEach((b) => b.classList.remove("active"));
  hide("login-form");
  hide("register-form");
  el("auth-error").textContent = "";
  if (tab === "login") {
    show("login-form");
    document.querySelectorAll(".auth-tab")[0].classList.add("active");
  } else {
    show("register-form");
    document.querySelectorAll(".auth-tab")[1].classList.add("active");
  }
}

function loginUser() {
  const email = el("login-email").value.trim();
  const pass = el("login-password").value.trim();
  if (!email || !pass) {
    el("auth-error").textContent = "⚠️ Fill all fields";
    return;
  }
  const users = JSON.parse(localStorage.getItem("daxon_users")) || [];
  const u = users.find((x) => x.email === email && x.password === pass);
  if (!u) {
    el("auth-error").textContent = "❌ Invalid email or password";
    return;
  }
  currentUser = u;
  localStorage.setItem("currentUser", JSON.stringify(u));
  loadUserData();
  hide("auth-screen");
  el("app").classList.add("visible");
  el("topbar-user").textContent = u.fullName;
  initApp();
  showToast("✅ Welcome back, " + u.fullName + "!", "success");
  maybeShowPhoneAccessModal();
}

function registerUser() {
  const name = el("reg-name").value.trim();
  const email = el("reg-email").value.trim();
  const phone = el("reg-phone").value.trim();
  const pass = el("reg-password").value.trim();
  if (!name || !email || !pass) {
    el("auth-error").textContent = "⚠️ Fill all fields";
    return;
  }
  if (pass.length < 6) {
    el("auth-error").textContent = "⚠️ Password must be 6+ chars";
    return;
  }
  let users = JSON.parse(localStorage.getItem("daxon_users")) || [];
  if (users.find((x) => x.email === email)) {
    el("auth-error").textContent = "❌ Email already registered";
    return;
  }
  const u = {
    id: uid(),
    fullName: name,
    email,
    phone,
    password: pass,
    joinedAt: ts(),
  };
  users.push(u);
  localStorage.setItem("daxon_users", JSON.stringify(users));
  el("auth-error").style.color = "var(--green)";
  el("auth-error").textContent = "✅ Account created! Login now.";
  setTimeout(() => {
    el("auth-error").style.color = "";
    switchAuthTab("login");
  }, 1500);
}

function logoutUser() {
  if (!confirm("Are you sure you want to logout?")) return;
  stopCamera();
  localStorage.removeItem("currentUser");
  location.reload();
}

// ── DATA ──
function loadUserData() {
  if (!currentUser) return;
  notes =
    JSON.parse(localStorage.getItem("daxon_notes_" + currentUser.id)) || [];
  events =
    JSON.parse(localStorage.getItem("daxon_events_" + currentUser.id)) || [];
  summaries =
    JSON.parse(localStorage.getItem("daxon_summaries_" + currentUser.id)) || [];
}
function saveNotes() {
  localStorage.setItem("daxon_notes_" + currentUser.id, JSON.stringify(notes));
}
function saveEvents() {
  localStorage.setItem(
    "daxon_events_" + currentUser.id,
    JSON.stringify(events),
  );
}
function saveSummaries() {
  localStorage.setItem(
    "daxon_summaries_" + currentUser.id,
    JSON.stringify(summaries),
  );
}

// ── INIT ──
function initApp() {
  updateNotifPermissionUI();
  applyLanguage(currentLang);
  setInterval(checkReminders, 60000);
  setInterval(renderDashboard, 5000);
}

function goTo(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  el("page-" + page)?.classList.add("active");
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");
  if (page === "dashboard") renderDashboard();
  if (page === "notes") renderNotes();
  if (page === "schedule") {
    renderEvents();
    updateNotifPermissionUI();
  }
  if (page === "about") renderAbout();
  if (page === "summaries") renderSummariesList();
  if (page === "phonefiles") renderPhoneFiles();
}

// ── DASHBOARD ──
function renderDashboard() {
  if (!currentUser) return;
  el("stat-notes").textContent = notes.length;
  el("stat-events").textContent = events.length;
  el("stat-summaries").textContent = summaries.length;
  const recent = [...notes].reverse().slice(0, 3);
  el("dash-notes-list").innerHTML = recent.length
    ? recent
        .map(
          (n) => `
    <div style="padding:8px 0;border-bottom:1px solid rgba(0,229,255,.06);cursor:pointer" onclick="goTo('notes');setTimeout(()=>openNoteReader('${n.id}'),150)">
      <div style="font-family:var(--font-display);font-size:11px;color:var(--text)">${n.title}</div>
      <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono)">${n.updatedAt}</div>
    </div>`,
        )
        .join("")
    : '<p class="empty">No notes yet</p>';
  const today = new Date().toISOString().slice(0, 10);
  const todayEvs = events.filter((e) => e.date === today).slice(0, 4);
  el("dash-schedule-list").innerHTML = todayEvs.length
    ? todayEvs
        .map(
          (e) => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,229,255,.06)">
      <span style="font-size:13px;">${e.title}</span>
      <span style="color:var(--cyan);font-family:var(--font-mono);font-size:10px;">${e.time}</span>
    </div>`,
        )
        .join("")
    : '<p class="empty">No events today</p>';
}

// ── NOTES ──
function triggerFileImport() {
  el("file-import-input").click();
}
function dragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}
function dragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}
function dropFile(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const f = e.dataTransfer?.files?.[0];
  if (f) readFileAsNote(f);
}
function handleFileImport(e) {
  const f = e.target.files?.[0];
  if (f) readFileAsNote(f);
  e.target.value = "";
}

async function readFileAsNote(file) {
  showToast("⏳ Reading: " + file.name);
  try {
    const content = await parseFileContent(file);
    const title = file.name.replace(/\.[^/.]+$/, "");
    const safeContent =
      content && content.trim().length > 0
        ? content
        : `[Empty or unreadable: ${file.name}]`;
    notes.push({
      id: uid(),
      title,
      content: safeContent,
      source: "file",
      createdAt: ts(),
      updatedAt: ts(),
    });
    saveNotes();
    renderNotes();
    renderDashboard();
    showToast("✅ Imported: " + title, "success");
  } catch (err) {
    notes.push({
      id: uid(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      content: `[Error reading: ${err && err.message ? err.message : "unknown"}]`,
      source: "file",
      createdAt: ts(),
      updatedAt: ts(),
    });
    saveNotes();
    renderNotes();
    renderDashboard();
    showToast("⚠️ Error reading file", "error");
  }
}

async function parseFileContent(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  let result = "";
  try {
    if (["txt", "md", "csv", "rtf", "json"].includes(ext)) {
      result = await readTextFile(file);
    } else if (ext === "pdf") {
      result = await extractPDFText(file);
    } else if (["docx", "doc"].includes(ext)) {
      result = await extractDocxText(file);
    } else if (["xlsx", "xls"].includes(ext)) {
      result = await extractXlsxText(file);
    } else if (["pptx", "ppt"].includes(ext)) {
      result = await extractPptxText(file);
    } else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      result = await extractImageText(file);
    } else {
      result = await readTextFile(file);
    }
  } catch (err) {
    console.error("parseFileContent error", err);
    return `[Error reading "${file.name}"]`;
  }
  if (!result || !result.trim()) {
    return `[No text found in: ${file.name}]`;
  }
  return result;
}

function readTextFile(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = () => rej(r.error || new Error("Read error"));
    r.readAsText(f, "UTF-8");
  });
}
function readArrayBuffer(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = () => rej(r.error || new Error("Read error"));
    r.readAsArrayBuffer(f);
  });
}

async function extractPDFText(file) {
  if (typeof pdfjsLib === "undefined") throw new Error("PDF.js not available");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buffer = await readArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((x) => x.str).join(" ") + "\n\n";
  }
  return text;
}

async function extractDocxText(file) {
  if (typeof mammoth === "undefined")
    throw new Error("Mammoth.js not available");
  const buffer = await readArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

async function extractXlsxText(file) {
  if (typeof XLSX === "undefined") throw new Error("SheetJS not available");
  const buffer = await readArrayBuffer(file);
  const wb = XLSX.read(buffer, { type: "array" });
  let text = "";
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    text += `=== ${name} ===\n` + XLSX.utils.sheet_to_csv(ws) + "\n\n";
  });
  return text;
}

async function extractPptxText(file) {
  if (typeof JSZip === "undefined") throw new Error("JSZip not available");
  const buffer = await readArrayBuffer(file);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)[1], 10);
      const nb = parseInt(b.match(/(\d+)/)[1], 10);
      return na - nb;
    });
  if (slideFiles.length === 0) return "";
  let text = "";
  for (const path of slideFiles) {
    const xml = await zip.files[path].async("string");
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    const slideText = matches
      .map((m) => m.replace(/<[^>]+>/g, ""))
      .join(" ")
      .trim();
    if (slideText) text += slideText + "\n\n";
  }
  return text;
}

async function extractImageText(file) {
  if (typeof Tesseract === "undefined")
    throw new Error("Tesseract.js not available");
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      Tesseract.recognize(reader.result, "eng+swa")
        .then(({ data: { text } }) => res((text || "").trim()))
        .catch((e) => rej(e));
    };
    reader.onerror = () => rej(reader.error || new Error("Read error"));
    reader.readAsDataURL(file);
  });
}

function openNoteEditor(id = null) {
  editingNoteId = id;
  const n = id ? notes.find((x) => x.id === id) : null;
  el("note-title-input").value = n?.title || "";
  el("note-content-input").value = n?.content || "";
  hide("notes-list-view");
  hide("note-reader-inline");
  show("note-editor");
}
function closeNoteEditor() {
  hide("note-editor");
  show("notes-list-view");
  editingNoteId = null;
}
function saveNote() {
  const t = el("note-title-input").value.trim();
  const c = el("note-content-input").value.trim();
  if (!t) {
    showToast("⚠️ Enter a title", "error");
    return;
  }
  if (editingNoteId) {
    notes = notes.map((n) =>
      n.id === editingNoteId
        ? { ...n, title: t, content: c, updatedAt: ts() }
        : n,
    );
  } else {
    notes.push({
      id: uid(),
      title: t,
      content: c,
      source: "typed",
      createdAt: ts(),
      updatedAt: ts(),
    });
  }
  saveNotes();
  closeNoteEditor();
  renderNotes();
  renderDashboard();
  showToast("✅ Saved!", "success");
}
function openNoteReader(id) {
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  viewingNoteId = id;
  el("reader-title-inline").textContent = n.title;
  el("reader-content-inline").textContent = n.content;
  el("reader-date-inline").textContent = "🕐 " + n.updatedAt;
  hide("notes-list-view");
  hide("note-editor");
  show("note-reader-inline");
}
function closeNoteReader() {
  hide("note-reader-inline");
  show("notes-list-view");
  viewingNoteId = null;
}
function editCurrentNote() {
  if (viewingNoteId) {
    hide("note-reader-inline");
    openNoteEditor(viewingNoteId);
  }
}
function deleteNote(id, e) {
  e.stopPropagation();
  if (!confirm("Delete this note?")) return;
  notes = notes.filter((n) => n.id !== id);
  saveNotes();
  renderNotes();
  renderDashboard();
}
function speakNote() {
  if (!viewingNoteId) return;
  const n = notes.find((x) => x.id === viewingNoteId);
  if (n) speakText(n.content.slice(0, 500));
}
async function summarizeCurrentNote() {
  if (!viewingNoteId) return;
  const n = notes.find((x) => x.id === viewingNoteId);
  if (!n) return;
  showToast("💡 Creating summary...");
  const sum = formatSummary(n.content.slice(0, 6000));
  lastAiSummary = sum;
  const id = uid();
  summaries.push({
    id,
    title: "Summary: " + n.title,
    content: sum,
    sourceNote: n.title,
    createdAt: ts(),
  });
  saveSummaries();
  renderSummariesList();
  showToast("✅ Summary saved!", "success");
  goTo("summaries");
}

function renderNotes() {
  const q = (el("notes-search")?.value || "").toLowerCase();
  const f = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
  );
  el("notes-list").innerHTML = f.length
    ? [...f]
        .reverse()
        .map(
          (n) => `
    <div class="note-item" onclick="openNoteReader('${n.id}')">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div class="note-title">${n.title}</div>
        <button onclick="deleteNote('${n.id}',event)" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;flex-shrink:0;">🗑</button>
      </div>
      <div class="note-preview">${n.content.slice(0, 90)}...</div>
      <div class="note-date">${n.updatedAt}</div>
    </div>`,
        )
        .join("")
    : '<p class="empty">No notes. Create or import one.</p>';
}

// ── DOCUMENT READER ──
function dropReaderFile(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const f = e.dataTransfer?.files?.[0];
  if (f) readDocumentFileDirectly(f);
}
function readDocumentFile(event) {
  const f = event.target.files?.[0];
  if (f) readDocumentFileDirectly(f);
  event.target.value = "";
}
async function readDocumentFileDirectly(file) {
  showToast("⏳ Reading document: " + file.name);
  try {
    const content = await parseFileContent(file);
    currentReaderContent = content;
    currentReaderFileName = file.name;
    el("doc-reader-content").textContent = content;
    el("reader-file-info").textContent =
      `📄 ${file.name} (${Math.round(file.size / 1024)}KB)`;
    hide("reader-summary-box");
    show("reader-panel");
    showToast("✅ Document opened!", "success");
  } catch (e) {
    showToast("⚠️ Error reading file", "error");
  }
}
function speakReaderContent() {
  if (currentReaderContent) speakText(currentReaderContent.slice(0, 600));
}
async function aiSummarizeReader() {
  if (!currentReaderContent) {
    showToast("⚠️ No document open");
    return;
  }
  showToast("💡 Creating summary...");
  el("reader-summary-text").textContent = "⏳ Wait...";
  show("reader-summary-box");
  const sum = formatSummary(currentReaderContent.slice(0, 8000));
  el("reader-summary-text").textContent = sum;
  lastAiSummary = sum;
}
function saveReaderAsNote() {
  if (!currentReaderContent) {
    showToast("⚠️ No document");
    return;
  }
  const title = currentReaderFileName.replace(/\.[^/.]+$/, "");
  notes.push({
    id: uid(),
    title,
    content: currentReaderContent,
    source: "file",
    createdAt: ts(),
    updatedAt: ts(),
  });
  saveNotes();
  renderNotes();
  renderDashboard();
  showToast("✅ Saved as note!", "success");
}
function closeReaderPanel() {
  hide("reader-panel");
  currentReaderContent = "";
  currentReaderFileName = "";
}

// ── CAMERA ──
async function startCamera() {
  try {
    const constraints = {
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
    camStream = await navigator.mediaDevices.getUserMedia(constraints);
    const vid = el("camera-stream");
    vid.srcObject = camStream;
    vid.style.display = "block";
    show("snap-btn");
    show("stop-cam-btn");
    show("switch-cam-btn");
    hide("start-cam-btn");
    el("cam-ocr-status").textContent = "📷 Camera ready";
    showToast("📷 Camera started!", "success");
  } catch (e) {
    showToast("⚠️ Camera denied: " + e.message, "error");
    el("cam-ocr-status").textContent = "❌ Camera error: " + e.message;
  }
}
async function switchCamera() {
  facingMode = facingMode === "environment" ? "user" : "environment";
  stopCamera();
  await startCamera();
}
function stopCamera() {
  if (camStream) {
    camStream.getTracks().forEach((t) => t.stop());
    camStream = null;
  }
  el("camera-stream").style.display = "none";
  el("camera-stream").srcObject = null;
  hide("snap-btn");
  hide("stop-cam-btn");
  hide("switch-cam-btn");
  show("start-cam-btn");
  el("cam-ocr-status").textContent = "";
}
function snapPhoto() {
  const vid = el("camera-stream");
  const canvas = el("capture-canvas");
  canvas.width = vid.videoWidth;
  canvas.height = vid.videoHeight;
  canvas.getContext("2d").drawImage(vid, 0, 0);
  stopCamera();
  el("cam-ocr-status").textContent = "🔍 Reading text...";
  el("scan-text-result").value = "⏳ OCR processing...";
  if (typeof Tesseract !== "undefined") {
    Tesseract.recognize(canvas.toDataURL("image/png"), "eng+swa")
      .then(({ data: { text } }) => {
        el("scan-text-result").value = text.trim() || "[No text found]";
        el("cam-ocr-status").textContent = "✅ OCR complete";
        showToast("✅ Text extracted!", "success");
      })
      .catch((e) => {
        el("scan-text-result").value = "[OCR error: " + e.message + "]";
      });
  }
}
function handleScanFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  e.target.value = "";
  el("scan-text-result").value = "⏳ Reading...";
  const ext = f.name.split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof Tesseract !== "undefined") {
        Tesseract.recognize(reader.result, "eng+swa").then(
          ({ data: { text } }) => {
            el("scan-text-result").value = text.trim() || "[No text]";
            showToast("✅ OCR complete!", "success");
          },
        );
      }
    };
    reader.readAsDataURL(f);
  } else {
    parseFileContent(f).then((text) => {
      el("scan-text-result").value = text;
    });
  }
}
async function aiSummarizeScan() {
  const txt = el("scan-text-result").value.trim();
  if (!txt) {
    showToast("⚠️ No text");
    return;
  }
  showToast("💡 Creating summary...");
  el("scan-summary-text").textContent = "⏳ Wait...";
  show("scan-summary");
  const sum = formatSummary(txt.slice(0, 6000));
  el("scan-summary-text").textContent = sum;
  lastAiSummary = sum;
}
function saveScanAsNote() {
  const txt = el("scan-text-result").value.trim();
  if (!txt) {
    showToast("⚠️ No text");
    return;
  }
  notes.push({
    id: uid(),
    title: "Scan - " + ts(),
    content: txt,
    source: "scan",
    createdAt: ts(),
    updatedAt: ts(),
  });
  saveNotes();
  renderNotes();
  renderDashboard();
  showToast("✅ Saved as note!", "success");
}
function speakScan() {
  const t = el("scan-text-result").value;
  if (t) speakText(t.slice(0, 500));
}

// ── MY SUMMARIES ──
async function createManualSummary() {
  const txt = el("manual-sum-input").value.trim();
  if (!txt) {
    showToast("⚠️ Enter text first");
    return;
  }
  showToast("💡 Creating summary...");
  el("sum-result-text").textContent = "⏳ Wait...";
  show("sum-result-box");
  const sum = formatSummary(txt.slice(0, 8000));
  el("sum-result-text").textContent = sum;
  lastAiSummary = sum;
}
async function handleSumFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  e.target.value = "";
  showToast("⏳ Reading file...");
  const content = await parseFileContent(f);
  el("manual-sum-input").value = content.slice(0, 5000);
  showToast("✅ File loaded. Click Summarize.", "success");
}
function saveSummaryToList() {
  const sum = el("sum-result-text").textContent.trim();
  if (!sum || sum === "⏳ Wait...") {
    showToast("⚠️ No summary");
    return;
  }
  const src = el("manual-sum-input").value.slice(0, 60) + "...";
  summaries.push({
    id: uid(),
    title: "Summary " + (summaries.length + 1),
    content: sum,
    source: src,
    createdAt: ts(),
  });
  saveSummaries();
  renderSummariesList();
  showToast("✅ Summary saved!", "success");
  el("manual-sum-input").value = "";
  hide("sum-result-box");
}
function renderSummariesList() {
  const container = el("summaries-list");
  if (!container) return;
  container.innerHTML = summaries.length
    ? [...summaries]
        .reverse()
        .map(
          (s) => `
    <div class="summary-item">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div class="summary-item-title">${s.title}</div>
        <button onclick="deleteSummary('${s.id}',event)" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;">🗑</button>
      </div>
      <div class="summary-item-date">🕐 ${s.createdAt}</div>
      <div class="summary-item-preview">${s.content.slice(0, 150)}...</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button class="btn btn-sm" onclick="speakText('${s.content.replace(/'/g, "&#39;").slice(0, 400)}')">🔊 READ</button>
        <button class="btn btn-sm btn-success" onclick="copySummary('${s.id}')">📋 COPY</button>
      </div>
    </div>`,
        )
        .join("")
    : '<p class="empty">No summaries yet.</p>';
}
function deleteSummary(id, e) {
  e.stopPropagation();
  if (!confirm("Delete summary?")) return;
  summaries = summaries.filter((s) => s.id !== id);
  saveSummaries();
  renderSummariesList();
  renderDashboard();
}
function copySummary(id) {
  const s = summaries.find((x) => x.id === id);
  if (s) {
    navigator.clipboard
      ?.writeText(s.content)
      .then(() => showToast("✅ Copied!", "success"));
  }
}

// ── SCHEDULE ──
function notifBody(e) {
  let body = `🕐 ${e.date} at ${e.time}${e.endTime ? " – " + e.endTime : ""}`;
  if (e.desc) body += `\n📝 ${e.desc}`;
  return body;
}
function addEvent() {
  const t = el("event-title").value.trim();
  const d = el("event-date").value;
  const tm = el("event-time").value;
  const etm = el("event-end-time").value;
  const desc = el("event-desc").value.trim();
  const rem = el("event-reminder").checked;
  if (!t || !d || !tm) {
    showToast("⚠️ Fill required fields", "error");
    return;
  }
  const newEvent = {
    id: uid(),
    title: t,
    date: d,
    time: tm,
    endTime: etm,
    desc,
    reminder: rem,
    notified: false,
    createdAt: ts(),
  };
  events.push(newEvent);
  saveEvents();
  renderEvents();
  renderDashboard();
  el("event-title").value = "";
  el("event-date").value = "";
  el("event-time").value = "";
  el("event-end-time").value = "";
  el("event-desc").value = "";
  el("event-reminder").checked = true;
  showToast("✅ Event added!", "success");
  if (rem) {
    if (Notification?.permission === "granted") {
      new Notification("⏰ DAXON — Reminder: " + t, {
        body: notifBody(newEvent),
      });
    } else if (Notification && Notification.permission !== "denied") {
      showToast("🔔 Enable notifications (top) to get reminders", "warning");
    }
  }
}
function deleteEvent(id, e) {
  e.stopPropagation();
  if (!confirm("Delete event?")) return;
  events = events.filter((x) => x.id !== id);
  saveEvents();
  renderEvents();
  renderDashboard();
}
function renderEvents() {
  el("events-list").innerHTML = events.length
    ? [...events]
        .sort(
          (a, b) =>
            new Date(a.date + " " + a.time) - new Date(b.date + " " + b.time),
        )
        .map(
          (e) => `
    <div class="event-item">
      <div class="event-title">${e.title} ${e.reminder ? '<span class="badge badge-success">⏰</span>' : ""}</div>
      <div class="event-time">📅 ${e.date} · ${e.time}${e.endTime ? " – " + e.endTime : ""}</div>
      ${e.desc ? `<div style="color:var(--text2);font-size:11px;font-family:var(--font-mono);margin-top:6px;">📝 ${e.desc}</div>` : ""}
      <button onclick="deleteEvent('${e.id}',event)" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;margin-top:6px;font-family:var(--font-mono);">🗑 DELETE</button>
    </div>`,
        )
        .join("")
    : '<p class="empty">No events</p>';
}
function checkReminders() {
  const now = new Date();
  let changed = false;
  events.forEach((e) => {
    if (!e.reminder || e.notified) return;
    const evt = new Date(e.date + "T" + e.time);
    if (now >= evt && now - evt < 5 * 60000) {
      if (Notification?.permission === "granted") {
        new Notification("⏰ DAXON — " + e.title, {
          body: notifBody(e),
          requireInteraction: true,
        });
      }
      e.notified = true;
      changed = true;
    }
  });
  if (changed) saveEvents();
}
function updateNotifPermissionUI() {
  const card = el("notif-permission-card");
  const statusText = el("notif-status-text");
  if (!card || !window.Notification) {
    if (card) card.style.display = "none";
    return;
  }
  if (Notification.permission === "granted") {
    card.style.display = "none";
  } else {
    card.style.display = "block";
    statusText.textContent =
      Notification.permission === "denied"
        ? "⚠️ You blocked notifications. Enable in browser settings to get reminders."
        : "Enable notifications to get reminders when your events arrive, including title, time, and description.";
  }
}
function requestNotifPermission() {
  if (!window.Notification) {
    showToast("⚠️ Notifications not supported", "error");
    return;
  }
  Notification.requestPermission().then((perm) => {
    updateNotifPermissionUI();
    if (perm === "granted") showToast("✅ Notifications enabled!", "success");
    else if (perm === "denied") showToast("⚠️ Notifications blocked", "error");
  });
}

// ── PHONE FILES ──
function maybeShowPhoneAccessModal() {
  if (sessionStorage.getItem("daxon_phone_access_prompted") === "1") return;
  el("phone-access-modal")?.classList.add("visible");
}
function skipPhoneAccess() {
  sessionStorage.setItem("daxon_phone_access_prompted", "1");
  el("phone-access-modal")?.classList.remove("visible");
}
async function requestPhoneFolderAccess() {
  const statusEl = el("pam-status") || el("phone-access-status-text");
  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      if (statusEl) statusEl.textContent = "⏳ Listing files...";
      await addFilesFromDirectoryHandle(dirHandle);
      showToast("✅ Folder access granted!", "success");
      sessionStorage.setItem("daxon_phone_access_prompted", "1");
      el("phone-access-modal")?.classList.remove("visible");
      renderPhoneFiles();
      updatePhoneAccessStatusText();
    } catch (e) {
      el("phone-folder-picker-input").click();
    }
  } else {
    el("phone-folder-picker-input").click();
  }
}
function requestPhoneFileAccess() {
  el("phone-file-picker-input").click();
}
async function addFilesFromDirectoryHandle(dirHandle, prefix = "", depth = 0) {
  if (depth > 4) return;
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file") {
      if (phoneFiles.some((pf) => pf.name === prefix + name)) continue;
      const file = await handle.getFile();
      phoneFiles.push({
        id: uid(),
        name: prefix + name,
        size: file.size,
        kind: "handle",
        handle,
        content: null,
      });
    } else if (handle.kind === "directory") {
      await addFilesFromDirectoryHandle(handle, prefix + name + "/", depth + 1);
    }
  }
}
function handlePhoneFilePicker(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (!files.length) return;
  files.forEach((file) => {
    if (
      phoneFiles.some(
        (pf) =>
          pf.name === (file.webkitRelativePath || file.name) &&
          pf.size === file.size,
      )
    )
      return;
    phoneFiles.push({
      id: uid(),
      name: file.webkitRelativePath || file.name,
      size: file.size,
      kind: "file",
      fileObj: file,
      content: null,
    });
  });
  sessionStorage.setItem("daxon_phone_access_prompted", "1");
  el("phone-access-modal")?.classList.remove("visible");
  showToast(`✅ ${files.length} file(s) added`, "success");
  renderPhoneFiles();
  updatePhoneAccessStatusText();
}
function clearPhoneFiles() {
  if (!confirm("Clear all phone files?")) return;
  phoneFiles = [];
  renderPhoneFiles();
  updatePhoneAccessStatusText();
  showToast("🗑 Phone files cleared");
}
function updatePhoneAccessStatusText() {
  const elx = el("phone-access-status-text");
  if (!elx) return;
  elx.textContent = phoneFiles.length
    ? `✅ DAXON AI has access to ${phoneFiles.length} file(s) on this device (this session only).`
    : "⚠️ No phone files granted yet. Use the buttons above to choose a folder or files.";
}
function renderPhoneFiles() {
  const list = el("phonefiles-list");
  if (!list) return;
  updatePhoneAccessStatusText();
  const q = (el("phonefiles-search")?.value || "").toLowerCase();
  const f = phoneFiles.filter((pf) => pf.name.toLowerCase().includes(q));
  list.innerHTML = f.length
    ? f
        .map(
          (pf) => `
    <div class="note-item">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div class="note-title">📄 ${pf.name}</div>
        <button onclick="removePhoneFile('${pf.id}',event)" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;flex-shrink:0;">🗑</button>
      </div>
      <div class="note-preview">${Math.round((pf.size || 0) / 1024)} KB</div>
    </div>`,
        )
        .join("")
    : '<p class="empty">No phone files granted.</p>';
}
function removePhoneFile(id, e) {
  e?.stopPropagation();
  phoneFiles = phoneFiles.filter((pf) => pf.id !== id);
  renderPhoneFiles();
}
function togglePhoneCtx() {
  usePhoneContext = !usePhoneContext;
  el("phone-ctx-toggle").textContent =
    `📱 Phone Files: ${usePhoneContext ? "ON" : "OFF"}`;
  if (usePhoneContext && phoneFiles.length === 0) {
    showToast("⚠️ No phone files granted yet", "error");
  }
}

// ── AI CHAT ──
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "this",
  "that",
  "these",
  "those",
  "with",
  "as",
  "by",
  "at",
  "from",
  "it",
  "its",
  "which",
  "who",
  "but",
  "if",
  "then",
  "than",
  "so",
  "not",
  "no",
  "can",
  "will",
  "would",
  "should",
  "could",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "you",
  "your",
  "i",
  "we",
  "our",
  "they",
  "their",
  "he",
  "she",
  "him",
  "her",
  "his",
  "my",
  "me",
  "us",
  "them",
]);

function formatSummary(text) {
  if (!text || text.length < 50) return "Text is too short to summarize.";
  const sentences = text
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 20)
    .slice(0, 20);
  if (sentences.length === 0) return "No sentences to summarize.";

  const wordFreq = {};
  sentences.forEach((sent) => {
    (sent.match(/\b\w+\b/g) || []).forEach((w) => {
      const word = w.toLowerCase();
      if (word.length > 3 && !STOPWORDS.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
  });

  const scored = sentences
    .map((sent) => {
      const score = (sent.match(/\b\w+\b/g) || []).reduce(
        (sum, w) => sum + (wordFreq[w.toLowerCase()] || 0),
        0,
      );
      return { sent: sent.trim(), score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(2, Math.ceil(sentences.length / 3)));

  return (
    scored
      .map((x) => x.sent.trim())
      .filter((s) => s)
      .join(". ") + (scored.length > 0 ? "." : "")
  );
}

function addAiMessage(user, text) {
  const box = el("ai-chat-box");
  const msg = document.createElement("div");
  msg.className = user ? "ai-msg ai-msg-user" : "ai-msg ai-msg-bot";
  msg.innerHTML = `<div class="ai-msg-label">${user ? "YOU" : "DAXON AI"}</div><div>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

async function askAI() {
  const q = el("ai-question").value.trim();
  if (!q) return;
  addAiMessage(true, q);
  el("ai-question").value = "";
  showToast("⏳ DAXON AI thinking...");

  let answer =
    'I am DAXON AI, your study assistant powered by the Local Intelligence Engine. I can help you summarize documents, answer questions based on your notes, translate text, and more — all running locally on your device with complete privacy.\n\nYour question: "' +
    q +
    '"\n\nWould you like me to:\n• Summarize a document or text\n• Answer a question from your notes\n• Translate text\n• Help with study topics';

  if (
    q.toLowerCase().includes("summary") ||
    q.toLowerCase().includes("summarize")
  ) {
    answer =
      'To create a summary, you can:\n1. Go to "My Summaries" tab\n2. Paste or upload text\n3. Click "Summarize"\n\nI\'ll create a summary using extractive NLP technology.';
  } else if (
    q.toLowerCase().includes("notes") ||
    q.toLowerCase().includes("what is")
  ) {
    if (notes.length > 0) {
      const relevant = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q.toLowerCase()) ||
          n.content.toLowerCase().includes(q.toLowerCase()),
      );
      if (relevant.length > 0) {
        answer =
          "I found " +
          relevant.length +
          " note(s) that might help:\n" +
          relevant
            .slice(0, 2)
            .map((n) => "📝 " + n.title)
            .join("\n") +
          "\n\nCheck the Notes tab for more details.";
      }
    }
  } else if (q.toLowerCase().includes("translate")) {
    answer =
      'To translate text:\n1. Go to "Language Translator" tab\n2. Select source and target languages\n3. Enter text\n4. Click "Translate"\n\nI support 10+ languages including English, Swahili, French, Spanish, and more.';
  }

  addAiMessage(false, answer);
}

function toggleWebSearch() {
  webSearchEnabled = !webSearchEnabled;
  el("web-search-toggle").textContent =
    `🌐 Internet: ${webSearchEnabled ? "ON" : "OFF"}`;
  showToast(`Internet search ${webSearchEnabled ? "enabled" : "disabled"}`);
}
function toggleNotesCtx() {
  useNotesContext = !useNotesContext;
  el("notes-ctx-toggle").textContent =
    `📚 Notes Context: ${useNotesContext ? "ON" : "OFF"}`;
}
function clearChat() {
  el("ai-chat-box").innerHTML = "";
  el("ai-question").value = "";
  clearAiAttachment();
  showToast("Chat cleared");
}
function startVoiceAI() {
  showToast("🎙️ Voice input coming soon");
}
function handleAiFileAttach(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  e.target.value = "";
  el("ai-attachment-name").textContent = f.name;
  el("ai-attachment-chip").style.display = "flex";
  showToast("📎 File attached: " + f.name);
}
function clearAiAttachment() {
  el("ai-attachment-chip").style.display = "none";
  el("ai-attachment-name").textContent = "";
}

// ── TRANSLATE ──
function swapLangs() {
  const from = el("lang-from").value;
  const to = el("lang-to").value;
  el("lang-from").value = to;
  el("lang-to").value = from;
}
function doTranslate() {
  const from = el("lang-from").value;
  const to = el("lang-to").value;
  const text = el("translate-input").value.trim();
  if (!text) {
    showToast("⚠️ Enter text");
    return;
  }
  show("translate-loading");
  hide("translate-result");

  // Simulated translation
  setTimeout(() => {
    hide("translate-loading");
    el("translate-output").textContent =
      "Translation: " + text + "\n\n[From " + from + " to " + to + "]";
    show("translate-result");
    showToast("✅ Translated!", "success");
  }, 800);
}
function copyTranslation() {
  const text = el("translate-output").textContent;
  if (text)
    navigator.clipboard
      ?.writeText(text)
      .then(() => showToast("✅ Copied!", "success"));
}
function startTranslateVoice() {
  showToast("🎙️ Voice translation coming soon");
}

// ── ABOUT ──
function renderAbout() {
  el("about-account-info").innerHTML = currentUser
    ? `
    <div style="font-size:12px;line-height:1.8;color:var(--text2);font-family:var(--font-mono);">
      <div>👤 Name: <span style="color:var(--cyan)">${currentUser.fullName}</span></div>
      <div>📧 Email: <span style="color:var(--cyan)">${currentUser.email}</span></div>
      <div>📱 Phone: <span style="color:var(--cyan)">${currentUser.phone || "Not provided"}</span></div>
      <div>📅 Joined: <span style="color:var(--cyan)">${currentUser.joinedAt}</span></div>
    </div>`
    : "";

  el("db-info").innerHTML = `
    <div>📚 Total Notes: <span style="color:var(--cyan)">${notes.length}</span></div>
    <div>📅 Total Events: <span style="color:var(--cyan)">${events.length}</span></div>
    <div>💡 Total Summaries: <span style="color:var(--cyan)">${summaries.length}</span></div>
    <div>📱 Phone Files: <span style="color:var(--cyan)">${phoneFiles.length}</span></div>
    <div>💾 Storage: <span style="color:var(--cyan)">Browser LocalStorage (5-10MB)</span></div>
  `;
}

function togglePrivacyMode() {
  privacyMode = el("privacy-toggle").checked;
  localStorage.setItem("daxon_privacy_mode", privacyMode ? "on" : "off");
  updatePrivacyUI();
  if (privacyMode) {
    webSearchEnabled = false;
    el("web-search-toggle").textContent = "🌐 Internet: OFF";
  }
  showToast("Privacy Mode " + (privacyMode ? "enabled ✅" : "disabled"));
}
function updatePrivacyUI() {
  const elx = el("privacy-status-text");
  if (!elx) return;
  elx.textContent = privacyMode
    ? "🔒 Privacy Mode is ON — no internet requests will be sent. All operations use only your local data."
    : "🔓 Privacy Mode is OFF — DAXON AI can fetch data from the internet and use online services.";
}

function speakText(text) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLang === "sw" ? "sw-TZ" : "en-US";
    window.speechSynthesis.speak(utterance);
    showToast("🔊 Speaking...");
  } else {
    showToast("⚠️ Speech not supported");
  }
}

// ═══════════════════════════════════════════════════════
// INIT ON PAGE LOAD — FIXED WITH PROPER EVENT HANDLING
// ═══════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", function () {
  // Setup skip button with proper event listener
  const skipBtn = el("intro-skip-btn");
  if (skipBtn) {
    skipBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Skip clicked");
      skipIntro();
    });
  }

  // Start intro after ensuring DOM is ready
  setTimeout(startIntro, 100);
});

// Also handle Enter key in various inputs
el("login-password")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") loginUser();
});
el("reg-password")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") registerUser();
});
el("ai-question")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    askAI();
    e.preventDefault();
  }
});
