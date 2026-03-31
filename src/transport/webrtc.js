const socket = io();

// STATE MANAGEMENT
let pc = null; // RTCPeerConnection instance representing the P2P tunnel
window.myRoom = null;
let dataChannel = null; // SCTP protocol channel for transferring raw byte arrays

// MEMORY AND FILE STATE
let isReceiving = false;
let incomingMeta = null;
let fileStream = null; // Pointer for the File System Access API (Direct-to-Disk streaming)
let writeQueue = Promise.resolve();
let receiveBuffer = []; // Fallback memory array for browsers without Direct-to-Disk access
let receivedSize = 0;
let transferCount = 0;

let activeSendFile = null;
let pendingHuffmanMeta = null;

// RECEIVER TELEMETRY
let rxLastReportTime = 0;
let rxBytesSinceLastReport = 0;
let rxPeakSpeed = 0;

// TUNING CONSTANTS
// Chunk limits safely bypass the SCTP protocol's 64KB message size limitations
const RAW_CHUNK_SIZE = 65536;
const COMP_CHUNK_SIZE = 16384;

// SIGNALING (Matchmaker Communication)
socket.on("connect", () => {
  console.log("✅ Connected! My ID:", socket.id);
  $("connDot").className = "conn-dot searching";
  $("connText").textContent = "Waiting for peer…";
});

// Peer 2 generates the initial WebRTC Offer
socket.on("ready", async () => {
  console.log("🔔 Room ready. I am the initiator — creating offer...");
  pc = createPC();
  dataChannel = pc.createDataChannel("eco-transfer");
  setupDataChannel(dataChannel);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { code: window.myRoom, data: offer });
});

// Peer 1 receives the Offer and replies with an Answer
socket.on("offer", async (offer) => {
  console.log("🔔 Received offer. Creating answer...");
  if (pc) return;
  pc = createPC();
  pc.ondatachannel = (e) => {
    dataChannel = e.channel;
    setupDataChannel(dataChannel);
  };
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { code: window.myRoom, data: answer });
});

socket.on("answer", async (answer) => {
  console.log("🔔 Received answer. Establishing connection...");
  if (pc && pc.signalingState === "have-local-offer") {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// ICE Resolution: Exchanging routing paths to bypass home NATs and Firewalls
socket.on("ice-candidate", async (candidate) => {
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("ICE error:", e);
    }
  }
});

socket.on("room-full", () => onRoomFull());

socket.on("peer-joined", () => {
  $("bridge-caption").textContent = "Friend found! Connecting…";
});

socket.on("peer-left", () => {
  toast("⚠️", "Peer left", "The other person disconnected.");
  // Sever connection fully if the other peer leaves
  setTimeout(() => window.location.reload(), 1500);
});

// CONNECTION FACTORY
function createPC() {
  const peer = new RTCPeerConnection({
    // STUN: A lightweight server that reflects the user's public IP back to them
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  peer.onicecandidate = ({ candidate }) => {
    if (candidate)
      socket.emit("ice-candidate", { code: window.myRoom, data: candidate });
  };
  peer.onconnectionstatechange = () => {
    console.log("PeerConnection state:", peer.connectionState);
    if (
      peer.connectionState === "disconnected" ||
      peer.connectionState === "failed"
    ) {
      toast("⚠️", "Disconnected", "Connection lost.");
      setTimeout(() => window.location.reload(), 1500);
    }
  };
  return peer;
}

function setupDataChannel(channel) {
  // Enforces ArrayBuffer mode to bypass slow string serialization
  channel.binaryType = "arraybuffer";
  channel.onmessage = handleMessage;
  channel.onopen = () => {
    console.log("🚀 DataChannel is OPEN!");
    S.connected = true;
    $("connDot").className = "conn-dot live";
    $("connText").textContent = "Connected";
    activateBridge();
    onPeerConnected();
    $("peer-input").value = "";
    $("peer-input").disabled = true;
    toast("🔗", "Connected!", "Direct encrypted link established.");
    if (S.files.length > 0) updateSendSection();
  };
  channel.onclose = () => {
    console.log("DataChannel closed.");
    setTimeout(() => window.location.reload(), 1000);
  };
}

// TWO-SIDED ABORT: Expose abort function to UI so it can notify the peer over the network
window.notifyAbort = function () {
  if (dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(JSON.stringify({ type: "abort" }));
  }
  activeSendFile = null;
  isReceiving = false;
  receiveBuffer = [];

  // If streaming to disk, safely abort and discard the incomplete file
  if (fileStream) {
    fileStream.abort().catch(() => {});
    fileStream = null;
  }
};

// THE INBOX (DATA ROUTER)
async function handleMessage(e) {
  // DATA LANE 1: JSON STRINGS (For File Metadata and System Commands)
  if (typeof e.data === "string") {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }

    if (msg.type === "start") {
      isReceiving = true;
      incomingMeta = msg.meta;
      receivedSize = 0;
      receiveBuffer = [];
      transferCount++;

      // Initialize Receiver Speedometer Metrics
      rxLastReportTime = performance.now();
      rxBytesSinceLastReport = 0;
      rxPeakSpeed = 0;
      $("peak-spd").textContent = "0";

      console.log(
        "📥 Incoming file:",
        incomingMeta.name,
        "transfer #" + transferCount,
      );
      showReceiveUI(incomingMeta);

      // DIRECT-TO-DISK: Prompts the user for a save location to stream data directly to their SSD
      if ("showSaveFilePicker" in window) {
        $("prog-sub").textContent = "Waiting for you to accept...";
        document.querySelector(".prog-track").style.display = "none";
        document.querySelector(".speedo").style.display = "none";

        const acceptBtn = document.createElement("button");
        acceptBtn.className = "btn btn-primary btn-full";
        acceptBtn.id = "accept-save-btn";
        acceptBtn.style.marginTop = "15px";
        acceptBtn.innerHTML = "💾 Choose save location";

        acceptBtn.onclick = async () => {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: incomingMeta.name,
            });
            fileStream = await handle.createWritable();
            acceptBtn.remove();
            document.querySelector(".prog-track").style.display = "block";
            document.querySelector(".speedo").style.display = "flex";
            $("prog-sub").textContent = "Receiving…";
            dataChannel.send(JSON.stringify({ type: "ready" }));
          } catch (err) {
            console.warn("User cancelled save:", err);
            isReceiving = false;
            dataChannel.send(JSON.stringify({ type: "abort" }));
            if (typeof window.onRemoteAbort === "function")
              window.onRemoteAbort();
          }
        };
        $("send-active").insertBefore(acceptBtn, $("prog-sub").nextSibling);
      } else {
        console.log("⚠️ Privacy Browser detected. Falling back to RAM buffer.");
        $("prog-sub").textContent = "Receiving…";
        dataChannel.send(JSON.stringify({ type: "ready" }));
      }
    }

    if (msg.type === "ready") startSendingChunks();

    // Remote Peer Abort Listener
    if (msg.type === "abort") {
      activeSendFile = null;
      isReceiving = false;
      receiveBuffer = [];
      if (fileStream) {
        fileStream.abort().catch(() => {});
        fileStream = null;
      }
      if (typeof window.onRemoteAbort === "function") window.onRemoteAbort();
      return;
    }

    // Telemetry Sync: Triggers when the sender successfully finishes the entire file queue
    if (msg.type === "batch-done") {
      if (typeof window.showSuccessScreen === "function") {
        window.showSuccessScreen(msg.orig, msg.comp, msg.count, "receiver");
      }
      return;
    }

    // Tracks the compression dictionary required to decode the incoming binary payload
    if (msg.type === "huffman-meta") pendingHuffmanMeta = msg;
    return;
  }

  // DATA LANE 2: RAW BINARY PAYLOADS (Uint8Array)
  if (!isReceiving || !incomingMeta) return;

  if (pendingHuffmanMeta) {
    // Reconstruct the compressed payload using the previously received dictionary
    const huffmanBytes = HuffmanCoder.decode(
      e.data,
      pendingHuffmanMeta.bitLength,
      pendingHuffmanMeta.tree,
    );
    const decodedBytes = RLEncoder.decode(huffmanBytes);
    saveReceivedData(decodedBytes);
    pendingHuffmanMeta = null;
  } else {
    // Process uncompressed payload natively
    saveReceivedData(new Uint8Array(e.data));
  }
}

// DISK WRITING LOGIC
function saveReceivedData(bytes) {
  if (incomingMeta.size === 0) {
    isReceiving = false;
    updateReceiveProgress(100, 0, 0);
    $("prog-sub").textContent = "Done! Waiting for next file…";
    setTimeout(() => onTransferComplete("receiver"), 400);
    return;
  }

  // INDEPENDENT RECEIVER SPEEDOMETER MATH
  rxBytesSinceLastReport += bytes.byteLength;
  const now = performance.now();
  const timeDiff = now - rxLastReportTime;

  if (timeDiff > 250 || receivedSize + bytes.byteLength >= incomingMeta.size) {
    const safeTimeDiff = timeDiff > 0 ? timeDiff : 1;
    const speedBps = rxBytesSinceLastReport / (safeTimeDiff / 1000);
    const speedMbps = (speedBps / (1024 * 1024)).toFixed(1);

    if (
      receivedSize + bytes.byteLength >= incomingMeta.size &&
      timeDiff < 50 &&
      speedMbps > 100
    ) {
      $("speedo-val").textContent = "Fast ⚡";
    } else {
      $("speedo-val").textContent = speedMbps + " MB/s";
    }

    if (speedMbps > rxPeakSpeed && speedMbps < 10000) {
      rxPeakSpeed = speedMbps;
      $("peak-spd").textContent = rxPeakSpeed;
    }

    const remainingBytes = incomingMeta.size - receivedSize;
    const secsRemaining = speedBps > 0 ? remainingBytes / speedBps : 0;
    $("s-time").textContent =
      secsRemaining < 3 ? "< 3 sec" : "~" + Math.ceil(secsRemaining) + "s";

    rxLastReportTime = now;
    rxBytesSinceLastReport = 0;
  }

  if (fileStream) {
    // Promises are queued sequentially to prevent out-of-order disk writes
    writeQueue = writeQueue.then(async () => {
      await fileStream.write(bytes);
      receivedSize += bytes.byteLength;
      updateReceiveProgress(
        Math.floor((receivedSize / incomingMeta.size) * 100),
        receivedSize,
        incomingMeta.size,
      );
      if (receivedSize >= incomingMeta.size) {
        isReceiving = false;
        await fileStream.close();
        fileStream = null;
        $("prog-sub").textContent = "Done! Waiting for next file…";
        onTransferComplete("receiver");
      }
    });
  } else {
    // Legacy Array buffering
    receiveBuffer.push(bytes);
    receivedSize += bytes.byteLength;
    updateReceiveProgress(
      Math.floor((receivedSize / incomingMeta.size) * 100),
      receivedSize,
      incomingMeta.size,
    );
    if (receivedSize >= incomingMeta.size) {
      isReceiving = false;
      const blob = new Blob(receiveBuffer, { type: incomingMeta.type });
      const savedMeta = incomingMeta;
      receiveBuffer = [];
      receivedSize = 0;
      incomingMeta = null;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = savedMeta.name;
      a.click();
      URL.revokeObjectURL(url);
      incomingMeta = savedMeta;
      updateReceiveProgress(100, savedMeta.size, savedMeta.size);
      $("prog-sub").textContent = "Done! Waiting for next file…";
      setTimeout(() => onTransferComplete("receiver"), 400);
    }
  }
}

function sendFileOverChannel(file) {
  if (!pc || pc.connectionState !== "connected") return false;
  if (!dataChannel || dataChannel.readyState !== "open") return false;

  activeSendFile = file;
  console.log("📤 Sending START signal for:", file.name);
  const startMsg = {
    type: "start",
    meta: { name: file.name, size: file.size, type: file.type },
  };
  dataChannel.send(JSON.stringify(startMsg));
  $("prog-sub").textContent = "Waiting for friend to choose save location…";
  return true;
}

// THE OUTBOX (HIGH-THROUGHPUT STREAMING)
async function startSendingChunks() {
  if (!activeSendFile) return;
  console.log("📤 Receiver ready. Streaming chunks...");

  const file = activeSendFile;
  let offset = 0;
  let totalCompressedBytesSent = 0;
  let startTime = performance.now();
  let lastReportTime = startTime;
  let bytesSinceLastReport = 0;
  let peakSpeed = 0;

  // SMART FILTER: Bypass the compression algorithms if the file is already a dense binary format
  const skipCompression =
    file.type.startsWith("video/") ||
    file.type.startsWith("image/") ||
    file.type.startsWith("audio/") ||
    file.type.includes("zip") ||
    file.type.includes("pdf") ||
    file.type.includes("word") ||
    file.type.includes("excel") ||
    file.type.includes("powerpoint") ||
    file.type.includes("octet-stream") ||
    file.type.includes("wasm") ||
    file.type === "";

  const netChunkSize = skipCompression ? RAW_CHUNK_SIZE : COMP_CHUNK_SIZE;

  // OPTIMIZATION 1: Read-Ahead Buffer. Loads 4MB blocks from disk to minimize physical I/O bottlenecks.
  const DISK_READ_SIZE = 4 * 1024 * 1024;
  // OPTIMIZATION 2: Backpressure Limits. Forces the thread to pause if the network buffer exceeds 4MB.
  const BUFFER_MAX = 4 * 1024 * 1024;
  dataChannel.bufferedAmountLowThreshold = 2 * 1024 * 1024;

  if (skipCompression) {
    $("prog-sub").textContent = "Bypassing compression (raw transfer)…";
    console.log(
      `⚡ Smart Filter: Raw transfer @ ${netChunkSize / 1024}KB chunks`,
    );
  } else {
    $("prog-sub").textContent = "Compressing and sending…";
    console.log(
      `🗜️ Smart Filter: Compressing @ ${netChunkSize / 1024}KB chunks`,
    );
  }

  if (file.size === 0) {
    dataChannel.send(new ArrayBuffer(0));
    $("prog-bar").style.width = "100%";
    $("prog-pct").textContent = "100%";
    $("speedo-val").textContent = "Instant ⚡";
    $("s-time").textContent = "< 1 sec";
    setTimeout(() => onTransferComplete("sender", 0, 0), 300);
    return;
  }

  const sendNextDiskBlock = async () => {
    // Interruption check: Cancel the loop if the user clicked Stop Sending
    if (!activeSendFile) {
      dataChannel.onbufferedamountlow = null;
      return;
    }

    if (offset >= file.size) {
      activeSendFile = null;
      dataChannel.onbufferedamountlow = null;
      return;
    }

    // Fetch the next 4MB block into memory
    const slice = file.slice(offset, offset + DISK_READ_SIZE);
    const diskBuffer = await slice.arrayBuffer();
    let diskOffset = 0;

    while (diskOffset < diskBuffer.byteLength && activeSendFile) {
      // Stop-and-wait backpressure handling
      if (dataChannel.bufferedAmount > BUFFER_MAX) {
        await new Promise((resolve) => {
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      // Re-verify that abort was not triggered while waiting for network drain
      if (!activeSendFile) break;

      // OPTIMIZATION 3: Zero-Copy Memory View. Bypasses the need to duplicate arrays by pointing directly to the RAM address.
      const chunkLen = Math.min(
        netChunkSize,
        diskBuffer.byteLength - diskOffset,
      );
      const rawBytes = new Uint8Array(diskBuffer, diskOffset, chunkLen);

      if (!skipCompression) {
        const rleBytes = RLEncoder.encode(rawBytes);
        const compressed = HuffmanCoder.encode(rleBytes);

        // ZERO-JSON STREAMING: Transmit metadata as text, but maintain pure binary integrity for the heavy payload.
        dataChannel.send(
          JSON.stringify({
            type: "huffman-meta",
            bitLength: compressed.bitLength,
            tree: compressed.tree,
          }),
        );
        dataChannel.send(new Uint8Array(compressed.buffer));
        totalCompressedBytesSent += compressed.buffer.length;
      } else {
        dataChannel.send(rawBytes);
        totalCompressedBytesSent += rawBytes.byteLength;
      }

      diskOffset += chunkLen;
      offset += chunkLen;
      bytesSinceLastReport += chunkLen;

      // Yield execution context to prevent main thread lockups during intensive processing
      if (!skipCompression && diskOffset % (netChunkSize * 4) === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (!activeSendFile) return;

    // Telemetry updates
    const now = performance.now();
    const timeDiff = now - lastReportTime;
    const isLastChunk = offset >= file.size;

    if (timeDiff > 250 || isLastChunk) {
      const safeTimeDiff = timeDiff > 0 ? timeDiff : 1;
      const speedBps = bytesSinceLastReport / (safeTimeDiff / 1000);
      const speedMbps = (speedBps / (1024 * 1024)).toFixed(1);

      if (isLastChunk && timeDiff < 50 && speedMbps > 100)
        $("speedo-val").textContent = "Fast ⚡";
      else $("speedo-val").textContent = speedMbps + " MB/s";

      if (speedMbps > peakSpeed && speedMbps < 10000) {
        peakSpeed = speedMbps;
        $("peak-spd").textContent = peakSpeed;
      }

      $("s-comp").textContent = fmtBytes(totalCompressedBytesSent);
      const saved = offset - totalCompressedBytesSent;
      $("s-saved").textContent = saved > 0 ? fmtBytes(saved) : "0 B";

      const remainingBytes = file.size - offset;
      const secsRemaining = speedBps > 0 ? remainingBytes / speedBps : 0;
      $("s-time").textContent =
        secsRemaining < 3 ? "< 3 sec" : "~" + Math.ceil(secsRemaining) + "s";

      lastReportTime = now;
      bytesSinceLastReport = 0;
    }

    updateSendProgress(
      Math.floor((offset / file.size) * 100),
      offset,
      file.size,
    );

    if (!isLastChunk) {
      sendNextDiskBlock();
    } else {
      dataChannel.onbufferedamountlow = null;
      console.log(
        `✅ File stream complete. Sent ${totalCompressedBytesSent} real network bytes.`,
      );
      setTimeout(
        () => onTransferComplete("sender", file.size, totalCompressedBytesSent),
        600,
      );
    }
  };

  sendNextDiskBlock();
}

function updateSendProgress(pct, transferred, total) {
  $("prog-bar").style.width = pct + "%";
  $("prog-pct").textContent = pct + "%";
  $("speedo-sub").textContent =
    fmtBytes(transferred) + " of " + fmtBytes(total);
}

function updateReceiveProgress(pct, received, total) {
  $("prog-bar").style.width = pct + "%";
  $("prog-pct").textContent = pct + "%";
  $("speedo-sub").textContent = fmtBytes(received) + " of " + fmtBytes(total);
  $("prog-sub").textContent = pct < 100 ? "Receiving…" : "Done!";
}

function showReceiveUI(meta) {
  $("sec-success").style.display = "none";
  const emoji = fileEmoji(meta.type);
  $("send-file-desc").textContent = `${meta.name} · ${fmtBytes(meta.size)}`;
  $("send-peer-desc").textContent = `Receiving from peer…`;

  show("sec-send", "reveal");
  setStep(3);
  hide("send-idle");
  show("send-active");

  const oldBtn = $("accept-save-btn");
  if (oldBtn) oldBtn.remove();
  document.querySelector(".prog-track").style.display = "block";
  document.querySelector(".speedo").style.display = "flex";

  document.querySelector(".prog-label").textContent = "Receiving file…";
  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("prog-sub").textContent = `${emoji} ${meta.name}`;
  $("speedo-val").textContent = "0 MB/s";
  $("speedo-sub").textContent = `0 B of ${fmtBytes(meta.size)}`;
  toast(emoji, "Incoming file!", meta.name + " · " + fmtBytes(meta.size));
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const myCode = $("my-code").textContent;
    if (myCode && myCode !== "—") {
      window.myRoom = myCode;
      socket.emit("join-room", myCode);
    }
  }, 500);
});
