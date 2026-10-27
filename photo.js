import { API_BASE } from "./config.js";

const PW_KEY = "hamilton-photo-password";
const MAX_EDGE = 1000;

export function photoSrc(item) {
  if (item.photoVersion && API_BASE) {
    return `${API_BASE}/img/${encodeURIComponent(item.name)}?v=${item.photoVersion}`;
  }
  return item.image ? `images/${item.image}` : null;
}

// Shrink to a ~1000px JPEG so phone photos (several MB) upload quickly and fit in the database.
async function toJpeg(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82)
  );
}

function getPassword(forcePrompt) {
  let pw = null;
  try { pw = localStorage.getItem(PW_KEY); } catch {}
  if (!pw || forcePrompt) {
    pw = prompt("Password to change photos:");
    if (!pw) return null;
    try { localStorage.setItem(PW_KEY, pw); } catch {}
  }
  return pw;
}

async function upload(name, blob, forcePrompt = false) {
  const pw = getPassword(forcePrompt);
  if (!pw) return null;
  const res = await fetch(`${API_BASE}/api/photo/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${pw}`, "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (res.status === 401) {
    try { localStorage.removeItem(PW_KEY); } catch {}
    return upload(name, blob, true);
  }
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).photoVersion;
}

/**
 * Tap a card's camera button -> take/choose a photo -> it replaces that ingredient's picture.
 * `findItem(name)` returns the ingredient object; `onChange()` re-renders.
 */
export function initPhotoCapture(host, findItem, onChange) {
  if (!API_BASE) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment"; // opens the rear camera on phones; a file picker on desktop
  input.hidden = true;
  document.body.append(input);

  let target = null;
  host.addEventListener("click", (e) => {
    const btn = e.target.closest(".photo-btn");
    if (!btn) return;
    e.preventDefault();
    target = btn.dataset.name;
    input.value = "";
    input.click();
  });

  input.addEventListener("change", async () => {
    const file = input.files[0];
    const name = target;
    if (!file || !name) return;
    const btn = [...host.querySelectorAll(".photo-btn")].find((b) => b.dataset.name === name);
    if (btn) { btn.textContent = "…"; btn.disabled = true; }
    try {
      const version = await upload(name, await toJpeg(file));
      if (version) findItem(name).photoVersion = version;
    } catch (err) {
      alert("Couldn't save photo: " + err.message);
    }
    onChange();
  });
}
