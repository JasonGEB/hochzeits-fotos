// ─────────────────────────────────────────────────────────────
// Konfiguration: hier deine Apps-Script-URL und den geheimen
// Schlüssel eintragen. Beides bekommst du im Setup (README.md).
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  scriptUrl: "https://script.google.com/macros/s/AKfycbz3tre5AfadPo5DUBTYgdWuA3GXcksi27vBotA9_sT8a-1yelt2gJZthOxugrlTeNt-/exec",
  uploadKey: "5f7101f04f47d4528eb1db5411a961c4",
  maxFileBytes: 40 * 1024 * 1024, // 40 MB pro Datei
  parallelUploads: 2,             // 2 gleichzeitige Uploads
  partnerName: "Katharina",       // anpassen
  weddingDate: "11. Juli 2026",
};

// ─────────────────────────────────────────────────────────────
// Ranks (Gamification)
// ─────────────────────────────────────────────────────────────
const RANKS = [
  { threshold: 0,  name: "Hochzeitsgast",          icon: "spark"  },
  { threshold: 5,  name: "Foto-Sammler:in",        icon: "bloom"  },
  { threshold: 10, name: "Hochzeits-Fotograf:in",  icon: "camera" },
  { threshold: 20, name: "Tag-Chronist:in",        icon: "book"   },
  { threshold: 30, name: "Paparazzo",              icon: "lens"   },
  { threshold: 50, name: "Foto-Royalty",           icon: "crown"  },
];
const STORAGE_KEY = "jk_wedding_upload_count";

// ─────────────────────────────────────────────────────────────
// DOM refs
// ─────────────────────────────────────────────────────────────
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const uploadList = document.getElementById("uploadList");
const rankCard = document.getElementById("rankCard");
const rankEmblem = document.getElementById("rankEmblem");
const rankName = document.getElementById("rankName");
const rankProgressBar = document.getElementById("rankProgressBar");
const rankProgressText = document.getElementById("rankProgressText");
const rankProgress = document.getElementById("rankProgress");
const successCountEl = document.getElementById("successCount");
const successPluralEl = document.getElementById("successPlural");
const resetButton = document.getElementById("resetButton");
const partnerNameEl = document.getElementById("partnerName");
const weddingDateEl = document.getElementById("weddingDate");
const levelupToast = document.getElementById("levelupToast");
const levelupEmblem = document.getElementById("levelupEmblem");
const levelupName = document.getElementById("levelupName");

partnerNameEl.textContent = CONFIG.partnerName;
weddingDateEl.textContent = CONFIG.weddingDate;

let successCount = loadCount();
let activeUploads = 0;
const queue = [];

renderRank(successCount, { animate: false });
rankCard.hidden = false;

// ─────────────────────────────────────────────────────────────
// File selection (click + drag&drop)
// ─────────────────────────────────────────────────────────────
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragover");
  })
);

["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
  })
);

dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
});

resetButton.addEventListener("click", () => {
  uploadList.innerHTML = "";
  fileInput.value = "";
  // Hinweis: Rang + Counter bleiben erhalten, damit der Gast seinen
  // Fortschritt sieht, auch wenn er mehrere Upload-Wellen macht.
});

// ─────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────
function handleFiles(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    const item = renderItem(file);
    if (file.size > CONFIG.maxFileBytes) {
      setError(item, `zu groß (max. ${formatBytes(CONFIG.maxFileBytes)})`);
      continue;
    }
    queue.push({ file, item });
  }
  pump();
}

function pump() {
  while (activeUploads < CONFIG.parallelUploads && queue.length > 0) {
    const job = queue.shift();
    activeUploads++;
    uploadFile(job.file, job.item)
      .catch(() => {})
      .finally(() => {
        activeUploads--;
        pump();
      });
  }
}

async function uploadFile(file, item) {
  try {
    setStatus(item, "wird gelesen…");
    const base64 = await fileToBase64(file);

    setStatus(item, "wird hochgeladen…");
    setProgress(item, 30);

    const res = await fetch(CONFIG.scriptUrl, {
      method: "POST",
      // text/plain → "simple request", kein CORS-Preflight nötig
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        key: CONFIG.uploadKey,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: base64,
      }),
    });

    setProgress(item, 90);
    const json = await res.json();

    if (!res.ok || !json.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    setProgress(item, 100);
    setSuccess(item);
    const prevRank = getCurrentRank(successCount);
    successCount++;
    saveCount(successCount);
    const newRank = getCurrentRank(successCount);
    rankCard.hidden = false;
    renderRank(successCount, { animate: true });
    if (newRank && (!prevRank || newRank.threshold !== prevRank.threshold)) {
      showLevelUp(newRank);
    }
  } catch (err) {
    console.error(err);
    setError(item, err.message || "Upload fehlgeschlagen");
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers: DOM rendering
// ─────────────────────────────────────────────────────────────
function renderItem(file) {
  const li = document.createElement("li");
  li.className = "upload-item";

  const thumb = document.createElement(file.type.startsWith("image/") ? "img" : "div");
  thumb.className = "upload-thumb";
  if (file.type.startsWith("image/")) {
    thumb.src = URL.createObjectURL(file);
    thumb.onload = () => URL.revokeObjectURL(thumb.src);
    thumb.alt = "";
  }

  const meta = document.createElement("div");
  meta.className = "upload-meta";

  const name = document.createElement("p");
  name.className = "upload-name";
  name.textContent = file.name;

  const status = document.createElement("p");
  status.className = "upload-status";
  status.textContent = "wartet…";

  const progress = document.createElement("div");
  progress.className = "progress";
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  progress.appendChild(bar);

  meta.append(name, status, progress);
  li.append(thumb, meta);
  uploadList.appendChild(li);

  return { li, status, bar, progress };
}

function setStatus(item, text) {
  item.status.textContent = text;
  item.status.classList.remove("is-error", "is-success");
}

function setProgress(item, pct) {
  item.bar.style.width = `${pct}%`;
}

function setSuccess(item) {
  item.status.textContent = "hochgeladen ✓";
  item.status.classList.add("is-success");
  item.progress.style.display = "none";
}

function setError(item, message) {
  item.status.textContent = message;
  item.status.classList.add("is-error");
  item.progress.style.display = "none";
}

// ─────────────────────────────────────────────────────────────
// Helpers: file -> base64 (ohne data:... prefix)
// ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result;
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// ─────────────────────────────────────────────────────────────
// Rank logic
// ─────────────────────────────────────────────────────────────
function loadCount() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveCount(n) {
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* ignore (private mode, quota, ...) */
  }
}

function getCurrentRank(count) {
  let current = null;
  for (const r of RANKS) {
    if (count >= r.threshold) current = r;
  }
  return current;
}

function getNextRank(count) {
  return RANKS.find((r) => count < r.threshold) || null;
}

function renderRank(count, { animate }) {
  successCountEl.textContent = String(count);
  successPluralEl.textContent = count === 1 ? "" : "s";

  const current = getCurrentRank(count);
  const next = getNextRank(count);

  rankEmblem.innerHTML = svgIcon(current ? current.icon : "spark");
  rankName.textContent = current ? current.name : "Du sammelst Momente";

  if (next) {
    const prevThreshold = current ? current.threshold : 0;
    const span = next.threshold - prevThreshold;
    const progressed = count - prevThreshold;
    const pct = Math.min(100, Math.round((progressed / span) * 100));
    rankProgress.hidden = false;
    rankProgressBar.style.width = pct + "%";
    rankProgressText.textContent = `noch ${next.threshold - count} bis ${next.name}`;
  } else {
    rankProgress.hidden = true;
  }

  if (animate) {
    rankEmblem.classList.remove("is-pulse");
    void rankEmblem.offsetWidth;
    rankEmblem.classList.add("is-pulse");
  }
}

function showLevelUp(rank) {
  levelupEmblem.innerHTML = svgIcon(rank.icon);
  levelupName.textContent = rank.name;
  levelupToast.hidden = false;
  levelupToast.classList.remove("is-show");
  void levelupToast.offsetWidth;
  levelupToast.classList.add("is-show");
  clearTimeout(showLevelUp._timer);
  showLevelUp._timer = setTimeout(() => {
    levelupToast.classList.remove("is-show");
    setTimeout(() => { levelupToast.hidden = true; }, 400);
  }, 3200);
}

// ─────────────────────────────────────────────────────────────
// SVG-Icons (inline, single color via currentColor)
// ─────────────────────────────────────────────────────────────
function svgIcon(name) {
  const ICONS = {
    spark: `<svg width="42" height="42" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4 L17.2 13 L26 16 L17.2 19 L16 28 L14.8 19 L6 16 L14.8 13 Z" fill="currentColor" fill-opacity="0.12"/>
      <path d="M16 4 L17.2 13 L26 16 L17.2 19 L16 28 L14.8 19 L6 16 L14.8 13 Z"/>
    </svg>`,
    bloom: `<svg width="42" height="42" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="16" cy="16" r="3" fill="currentColor" fill-opacity="0.25"/>
      <path d="M16 13 Q14 6 18 4 Q22 6 19 13"/>
      <path d="M19 16 Q26 14 28 18 Q26 22 19 19"/>
      <path d="M16 19 Q18 26 14 28 Q10 26 13 19"/>
      <path d="M13 16 Q6 18 4 14 Q6 10 13 13"/>
    </svg>`,
    camera: `<svg width="42" height="42" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 10 H10 L12 7 H20 L22 10 H27 V25 H5 Z"/>
      <circle cx="16" cy="17" r="5" fill="currentColor" fill-opacity="0.12"/>
      <circle cx="16" cy="17" r="5"/>
      <circle cx="23" cy="13" r="0.8" fill="currentColor"/>
    </svg>`,
    book: `<svg width="42" height="42" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 6 Q14 5 16 8 Q18 5 26 6 V25 Q18 24 16 27 Q14 24 6 25 Z" fill="currentColor" fill-opacity="0.08"/>
      <path d="M16 8 V27"/>
      <path d="M9 11 L13 10.5"/>
      <path d="M9 15 L13 14.5"/>
      <path d="M19 11 L23 10.5"/>
      <path d="M19 15 L23 14.5"/>
    </svg>`,
    lens: `<svg width="42" height="42" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="14" cy="16" r="9" fill="currentColor" fill-opacity="0.1"/>
      <circle cx="14" cy="16" r="9"/>
      <circle cx="14" cy="16" r="4.5"/>
      <path d="M21 23 L27 28"/>
      <path d="M9 13 Q11 11 14 11"/>
    </svg>`,
    crown: `<svg width="42" height="42" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 22 L7 11 L13 16 L16 8 L19 16 L25 11 L27 22 Z" fill="currentColor" fill-opacity="0.18"/>
      <path d="M5 22 L7 11 L13 16 L16 8 L19 16 L25 11 L27 22 Z"/>
      <path d="M5 26 H27"/>
      <circle cx="7" cy="11" r="1.2" fill="currentColor"/>
      <circle cx="16" cy="8" r="1.2" fill="currentColor"/>
      <circle cx="25" cy="11" r="1.2" fill="currentColor"/>
    </svg>`,
  };
  return ICONS[name] || ICONS.spark;
}
