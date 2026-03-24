/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const S = {
  file: null,
  ratio: 0.7,
  connected: false,
  peerCode: null,
  firstFile: true,
  peak: 0,
  sendTimer: null,
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DOM HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const $ = (id) => document.getElementById(id);

const show = (id, animClass = "") => {
  const el = $(id);
  el.style.display = "";
  if (animClass) {
    el.classList.remove(animClass);
    void el.offsetWidth;
    el.classList.add(animClass);
  }
};

const hide = (id) => {
  $(id).style.display = "none";
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UTILITY FUNCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function fmtBytes(b) {
  if (!b || b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function fileEmoji(type) {
  if (!type) return "📁";
  if (type.includes("image")) return "🖼️";
  if (type.includes("pdf")) return "📋";
  if (type.includes("video")) return "🎬";
  if (type.includes("audio")) return "🎵";
  if (type.includes("zip") || type.includes("rar") || type.includes("tar"))
    return "📦";
  if (
    type.includes("text") ||
    type.includes("json") ||
    type.includes("javascript") ||
    type.includes("html") ||
    type.includes("css")
  )
    return "📝";
  return "📁";
}

function fileType(type) {
  if (!type) return "File";
  const map = {
    json: "JSON",
    javascript: "JavaScript",
    "text/plain": "Text",
    html: "HTML",
    css: "CSS",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    pdf: "PDF",
    zip: "ZIP",
    "video/mp4": "MP4",
    audio: "Audio",
  };
  for (const [key, val] of Object.entries(map)) {
    if (type.includes(key)) return val;
  }
  return (type.split("/")[1] || "File").toUpperCase();
}

function compressionRatio(type) {
  if (!type) return 0.72;
  if (
    type.includes("text") ||
    type.includes("json") ||
    type.includes("javascript") ||
    type.includes("html") ||
    type.includes("css")
  )
    return 0.33 + Math.random() * 0.19;
  if (
    type.includes("image/jpeg") ||
    type.includes("video") ||
    type.includes("audio")
  )
    return 0.91 + Math.random() * 0.06;
  if (type.includes("zip") || type.includes("rar"))
    return 0.96 + Math.random() * 0.03;
  return 0.6 + Math.random() * 0.24;
}

function estTime(bytes) {
  const secs = (bytes * 8) / 1500000;
  if (secs < 3) return "< 3 sec";
  if (secs < 60) return "~" + Math.ceil(secs) + "s";
  return "~" + Math.ceil(secs / 60) + "min";
}

function wordCode() {
  const words = [
    "PINE",
    "MINT",
    "SAGE",
    "OPAL",
    "DUSK",
    "TIDE",
    "FERN",
    "DOVE",
    "WREN",
    "REEF",
    "COVE",
    "MIST",
    "GLOW",
    "LARK",
    "ARCH",
  ];
  return (
    words[Math.floor(Math.random() * words.length)] +
    "-" +
    (Math.floor(Math.random() * 9000) + 1000)
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOAST NOTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function toast(icon, title, sub = "") {
  $("toast-icon").textContent = icon;
  $("toast-title").textContent = title;
  $("toast-sub").textContent = sub;
  const t = $("toast");
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STEPPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = $("s" + i);
    el.classList.remove("active", "done");
    if (i < n) el.classList.add("done");
    else if (i === n) el.classList.add("active");
  }
  $("sc1").className =
    "step-connector" + (n > 1 ? " done" : n === 1 ? " active" : "");
  $("sc2").className =
    "step-connector" + (n > 2 ? " done" : n === 2 ? " active" : "");
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DRAG & DROP HANDLERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function onDragOver(e) {
  e.preventDefault();
  if (!S.file) $("dropzone").classList.add("drag-over");
}

function onDragLeave() {
  $("dropzone").classList.remove("drag-over");
}

function onDrop(e) {
  e.preventDefault();
  $("dropzone").classList.remove("drag-over");
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
}

function onDropzoneClick() {
  if (S.file) return;
  $("file-input").click();
}

function onFileSelect(e) {
  if (e.target.files[0]) processFile(e.target.files[0]);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROCESS FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function processFile(file) {
  // ── FIX: Force reset the UI so send button wakes up on new file drop ──
  $("sec-success").style.display = "none";
  hide("send-active");
  show("send-idle");

  const sendBtn = $("send-btn");
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send this file →";
    sendBtn.style.background = "";
    sendBtn.style.boxShadow = "";
  }

  S.file = file;
  S.ratio = compressionRatio(file.type);

  const comp = Math.floor(file.size * S.ratio);
  const saved = Math.round((1 - S.ratio) * 100);
  const emoji = fileEmoji(file.type);
  const isImg = file.type.startsWith("image/");

  $("dropzone").classList.add("loaded");
  hide("empty-state");
  $("file-row").style.display = "flex";

  if (isImg) {
    const url = URL.createObjectURL(file);
    $("drop-hero").innerHTML = `<img src="${url}" alt="preview"/>`;
    $("file-thumb").innerHTML = `<img src="${url}" alt="thumb"/>`;
  } else {
    $("drop-hero").innerHTML = `<span>${emoji}</span>`;
    $("file-thumb").innerHTML = `<span>${emoji}</span>`;
  }

  $("file-name").textContent = file.name;
  $("file-meta").textContent =
    fileType(file.type) + " · " + fmtBytes(file.size);
  $("file-chips").innerHTML = `
    <span class="chip chip-teal">✓ Loaded</span>
    <span class="chip chip-green">−${saved}% smaller</span>
  `;

  show("sec-compression");
  $("c-pct").innerHTML = saved + "<sup>%</sup>";
  $("c-detail").innerHTML =
    `<strong>${fmtBytes(file.size)}</strong> → <strong>${fmtBytes(comp)}</strong> · ${Math.round((1 / S.ratio) * 10) / 10}× faster to send`;
  $("s-orig").textContent = fmtBytes(file.size);
  $("s-comp").textContent = fmtBytes(comp);
  $("s-time").textContent = estTime(comp);
  $("s-saved").textContent = fmtBytes(file.size - comp);

  setStep(2);

  if (S.firstFile) {
    S.firstFile = false;
    setTimeout(() => $("coach1").classList.add("on"), 600);
  }

  if (S.connected) updateSendSection();

  toast(emoji, "File ready", file.name + " — shrunk by " + saved + "%");
}

function clearFile() {
  ["drop-hero", "file-thumb"].forEach((id) => {
    const img = $(id).querySelector("img");
    if (img) URL.revokeObjectURL(img.src);
  });

  S.file = null;

  $("dropzone").classList.remove("loaded");
  show("empty-state");
  hide("sec-compression");
  if (!S.connected) hide("sec-connect");
  hide("sec-send");
  if (!S.connected) show("sec-how");
  hide("file-row");
  $("file-input").value = "";
  $("drop-hero").innerHTML = '<span id="drop-emoji">📂</span>';
  $("coach1").classList.remove("on");

  setStep(1);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function jumpToConnect() {
  if (!S.file) {
    $("dropzone").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  $("peer-input").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => $("peer-input").focus(), 400);
}

function joinRoom(code) {
  myRoom = code;
  socket.emit("join-room", code);
  console.log("Joining room:", code);
}

function doConnect() {
  const code = $("peer-input").value.trim();
  if (code.length < 4) {
    const inp = $("peer-input");
    inp.classList.add("shake");
    inp.addEventListener("animationend", () => inp.classList.remove("shake"), {
      once: true,
    });
    inp.focus();
    return;
  }

  S.peerCode = code;
  $("bridge").classList.add("visible");
  $("or-sep").style.display = "none";
  $("connect-btn").textContent = "Connecting…";
  $("connect-btn").disabled = true;

  joinRoom(code);
}

function onPeerConnected() {
  const btn = $("connect-btn");
  btn.textContent = "✓ Connected";
  btn.style.background = "linear-gradient(135deg, #22C55E, #16A34A)";
  btn.style.boxShadow = "0 6px 20px rgba(34,197,94,0.32)";
  btn.disabled = false;

  $("code-display").classList.add("pulse-glow");
  setTimeout(() => $("code-display").classList.remove("pulse-glow"), 2000);
}

function onRoomFull() {
  $("bridge").classList.remove("visible");
  $("or-sep").style.display = "";
  $("connect-btn").textContent = "Connect with friend →";
  $("connect-btn").disabled = false;
  $("peer-input").value = "";
  $("peer-input").focus();
  toast("⛔", "Room full", "That code already has 2 people connected.");
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EXIT MODAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showExitModal() {
  $("exit-modal").style.display = "grid";
}

function closeExitModal() {
  $("exit-modal").style.display = "none";
}

function confirmExit() {
  closeExitModal();
  doReset();
}

function exitWarning(e) {
  if (S.connected) {
    e.preventDefault();
    e.returnValue = "";
  }
}

window.addEventListener("beforeunload", exitWarning);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UPDATE SEND SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function updateSendSection() {
  if (!S.file || !S.connected) return;

  const comp = Math.floor(S.file.size * S.ratio);
  const saved = Math.round((1 - S.ratio) * 100);

  $("send-file-desc").textContent =
    `${S.file.name} · ${fmtBytes(S.file.size)} → ${fmtBytes(comp)} (−${saved}%)`;
  $("send-peer-desc").textContent = `Peer ${S.peerCode} is ready to receive`;

  show("sec-send", "reveal");
  setStep(3);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SEND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function doSend(btn) {
  if (!S.file) return;

  hide("send-idle");
  show("send-active");

  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("prog-sub").textContent = "Starting…";
  $("speedo-val").textContent = "0.0 MB/s";
  $("speedo-sub").textContent = "0 B of " + fmtBytes(S.file.size);
  $("speedo-bar").style.width = "0%";

  const ok = sendFileOverChannel(S.file);
  if (!ok) {
    show("send-idle");
    hide("send-active");
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ABORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function doAbort() {
  if (S.sendTimer) {
    clearInterval(S.sendTimer);
    S.sendTimer = null;
  }
  hide("send-active");
  show("send-idle");
  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("speedo-bar").style.width = "0%";
  toast("⛔", "Transfer stopped", "You can try again.");
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TRANSFER COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function onTransferComplete(role = "sender") {
  hide("send-active");
  show("send-idle");

  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("speedo-bar").style.width = "0%";

  const sendBtn = $("send-btn");
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "✓ File sent";
    sendBtn.style.background = "linear-gradient(135deg, #22C55E, #16A34A)";
    sendBtn.style.boxShadow = "0 6px 20px rgba(34,197,94,0.32)";
  }

  const el = $("sec-success");
  el.style.display = "block";

  if (role === "sender") {
    document.querySelector(".success-title").textContent = "Delivered!";
    document.querySelector(".success-emoji").textContent = "🎉";
    $("success-sub").textContent = S.file
      ? `"${S.file.name}" delivered — ${fmtBytes(S.file.size)} sent.`
      : "File delivered successfully.";
    toast("🎉", "Delivered!", "File sent successfully.");
  } else {
    document.querySelector(".success-title").textContent = "Received!";
    document.querySelector(".success-emoji").textContent = "📥";
    $("success-sub").textContent = incomingMeta
      ? `"${incomingMeta.name}" received — ${fmtBytes(incomingMeta.size)} saved to your device.`
      : "File received successfully.";
    toast("📥", "Received!", "File saved to your device.");
  }

  launchConfetti();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RESET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function doReset() {
  const wasConnected = S.connected;
  clearFile();

  if (S.sendTimer) {
    clearInterval(S.sendTimer);
    S.sendTimer = null;
  }
  S.peak = 0;

  $("sec-success").style.display = "none";
  hide("send-active");
  show("send-idle");
  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("speedo-bar").style.width = "0%";
  $("peak-spd").textContent = "0";

  const sendBtn = $("send-btn");
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send this file →";
    sendBtn.style.background = "";
    sendBtn.style.boxShadow = "";
  }

  if (wasConnected) {
    show("sec-connect");
    hide("sec-how");
    hide("sec-send");
    setStep(2);
  } else {
    S.connected = false;
    S.peerCode = null;

    if (typeof pc !== "undefined" && pc) {
      pc.close();
      pc = null;
    }
    if (typeof dataChannel !== "undefined" && dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }

    $("connDot").className = "conn-dot";
    $("connText").textContent = "Not connected";

    $("peer-input").value = "";
    $("peer-input").disabled = false;
    const btn = $("connect-btn");
    btn.textContent = "Connect with friend →";
    btn.style.background = "";
    btn.style.boxShadow = "";
    btn.disabled = false;

    $("bridge").classList.remove("visible");
    $("or-sep").style.display = "";
    $("bt-line").classList.remove("drawn");
    $("bn-friend").classList.remove("lit");
    $("bridge-caption").textContent = "Establishing link…";
    $("bridge-caption").className = "bridge-caption";

    $("my-code").textContent = wordCode();
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SVG BRIDGE ANIMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function activateBridge() {
  $("bt-line").classList.add("drawn");
  $("bn-friend").classList.add("lit");

  setTimeout(() => {
    $("bridge-caption").textContent = "✓ Direct connection established";
    $("bridge-caption").classList.add("live");
  }, 1200);

  const svgW = 240;
  const particles = [
    { el: $("bt-p1"), delay: 0, speed: 0.008, phase: 0 },
    { el: $("bt-p2"), delay: 300, speed: 0.012, phase: 0.3 },
    { el: $("bt-p3"), delay: 600, speed: 0.006, phase: 0.6 },
  ];

  particles.forEach((p) => {
    setTimeout(() => {
      let t = p.phase;
      function tick() {
        if (!S.connected) return;
        t = (t + p.speed) % 1;
        const x = t * svgW;
        const y = 15 + Math.sin(t * Math.PI * 2) * 4;
        p.el.setAttribute("cx", x);
        p.el.setAttribute("cy", y);
        p.el.setAttribute("opacity", 0.15 + Math.sin(t * Math.PI) * 0.85);
        requestAnimationFrame(tick);
      }
      tick();
    }, p.delay);
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   COPY CODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function copyCode() {
  const code = $("my-code").textContent;
  navigator.clipboard.writeText(code).catch(() => {});
  const btn = $("copy-btn");
  btn.textContent = "✓ Copied!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = "Copy";
    btn.classList.remove("copied");
  }, 2200);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONFETTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function launchConfetti() {
  const canvas = $("fx");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    "#2DD4BF",
    "#22C55E",
    "#F59E0B",
    "#60A5FA",
    "#F472B6",
    "#A78BFA",
  ];
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 60,
    r: 3 + Math.random() * 5,
    dx: (Math.random() - 0.5) * 3,
    dy: 2 + Math.random() * 4,
    rot: Math.random() * 360,
    drot: (Math.random() - 0.5) * 6,
    col: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1,
  }));

  let raf;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach((p) => {
      p.x += p.dx;
      p.y += p.dy;
      p.rot += p.drot;
      if (p.y > canvas.height * 0.7) p.alpha = Math.max(0, p.alpha - 0.025);
      if (p.alpha > 0) alive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    });
    if (alive) raf = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (raf) cancelAnimationFrame(raf);
  draw();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.addEventListener("DOMContentLoaded", () => {
  $("my-code").textContent = wordCode();
  show("sec-connect");
  hide("sec-how");
});
