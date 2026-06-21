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
// DOM refs
// ─────────────────────────────────────────────────────────────
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const uploadList = document.getElementById("uploadList");
const summary = document.getElementById("summary");
const successCountEl = document.getElementById("successCount");
const resetButton = document.getElementById("resetButton");
const partnerNameEl = document.getElementById("partnerName");
const weddingDateEl = document.getElementById("weddingDate");

partnerNameEl.textContent = CONFIG.partnerName;
weddingDateEl.textContent = CONFIG.weddingDate;

let successCount = 0;
let activeUploads = 0;
const queue = [];

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
  summary.hidden = true;
  successCount = 0;
  successCountEl.textContent = "0";
  fileInput.value = "";
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
    successCount++;
    successCountEl.textContent = String(successCount);
    summary.hidden = false;
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
