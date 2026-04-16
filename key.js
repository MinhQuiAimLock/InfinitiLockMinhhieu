(function () {
  "use strict";

  const CONFIG = {
    appName: "Infinity Lock",
    storageKey: "vsh_license_key",
    storageDevice: "vsh_license_device",
    checkUrl: "/check",       
    activateUrl: "/activate", 
    contactUrl: "https://zalo.me/0329505336",
    timezone: "Asia/Ho_Chi_Minh",
    autoCheckOnLoad: false, 
    relockWhenInvalid: true,
  };

  const state = { key: "", deviceId: "", verified: false, expiresAt: "", mounted: false };

  function qs(sel) { return document.querySelector(sel); }
  function ce(tag, props = {}, html = "") { const el = document.createElement(tag); Object.assign(el, props); if (html) el.innerHTML = html; return el; }
  function escapeHtml(str) { return String(str ?? "").replace(/[&<>"']/g, (m) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[m])); }

  function formatDateVN(value) {
    if (!value) return "Không giới hạn";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", { timeZone: CONFIG.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
  }

  function toast(message, type = "ok", raw = null) {
    const box = qs("#vgMsg"); const rawWrap = qs("#vgDtl"); const rawBox = qs("#vgRaw");
    if (!box) return;
    box.className = `vg-msg ${type}`; box.innerHTML = message;
    if (rawWrap && rawBox) { if (raw == null) { rawWrap.hidden = true; rawBox.textContent = ""; } else { rawWrap.hidden = false; rawBox.textContent = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2); } }
  }

  function playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx(); const gain = ctx.createGain();
      ctx.createOscillator().type = "sine"; ctx.createOscillator().frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime); gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      ctx.createOscillator().connect(gain); gain.connect(ctx.destination); ctx.createOscillator().start(); ctx.createOscillator().stop(ctx.currentTime + 0.2);
    } catch {}
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(CONFIG.storageDevice);
    if (id) return id;
    id = "DEV-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    localStorage.setItem(CONFIG.storageDevice, id);
    return id;
  }

  function saveKey(key) { localStorage.setItem(CONFIG.storageKey, key); state.key = key; }
  function clearKey() { localStorage.removeItem(CONFIG.storageKey); state.key = ""; }
  function loadSavedKey() { state.key = localStorage.getItem(CONFIG.storageKey) || ""; return state.key; }
  function updateFooter(exp = "") { const sta = qs("#vgSta"); if (sta) sta.textContent = exp ? `Hết hạn: ${formatDateVN(exp)}` : "Chưa kích hoạt"; }
  function dispatchLicenseChange(detail) { window.dispatchEvent(new CustomEvent("vsh-license-change", { detail })); }
  function lockUI() { document.body.classList.add("vg-locked"); const gate = qs("#vgGate"); if (gate) gate.style.display = "grid"; }
  function unlockUI() { document.body.classList.remove("vg-locked"); const gate = qs("#vgGate"); if (gate) gate.style.display = "none"; }

  function normalizeResponse(data) {
    const status = String(data?.status || data?.code || data?.state || "").toUpperCase();
    const valid = data?.valid === true || data?.ok === true || data?.success === true || status === "OK" || status === "VALID" || status === "SUCCESS" || status === "ACTIVATED";
    return { ok: valid, status, expiresAt: data?.expiresAt || data?.expire || data?.expired_at || data?.expiry || "", raw: data };
  }

  // --- LOGIC GỌI API SERVER THẬT 100% ---
  async function apiGet(url, params) {
    const u = new URL(url, window.location.origin);
    Object.entries(params).forEach(([k, v]) => { if (v != null) u.searchParams.set(k, v); });
    const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json, text/plain, */*" } });
    const rawText = await res.text(); let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { status: "INVALID_JSON", body: rawText, contentType: res.headers.get("content-type"), httpStatus: res.status }; }
    if (!res.ok) { return { ok: false, status: String(data?.status || `HTTP_${res.status}`).toUpperCase(), raw: { httpStatus: res.status, contentType: res.headers.get("content-type"), body: rawText, data } }; }
    return normalizeResponse(data);
  }

  async function checkLicense(key, deviceId) {
    return apiGet(CONFIG.checkUrl, { key, hwid: deviceId, deviceId });
  }

  async function activateLicense(key, deviceId) {
    const res = await fetch(CONFIG.activateUrl, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/plain, */*" },
      body: JSON.stringify({ key, hwid: deviceId, deviceId }),
    });
    const rawText = await res.text(); let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { status: "INVALID_JSON", body: rawText, httpStatus: res.status }; }
    if (!res.ok) { return { ok: false, status: String(data?.status || `HTTP_${res.status}`).toUpperCase(), raw: data }; }
    return normalizeResponse(data);
  }

  async function safeCall(fn) {
    try { return await fn(); } catch (err) { console.error(err); toast("Lỗi Kết Nối Sever⚠️", "err", String(err)); return null; }
  }

  function toast(message, type = "ok", raw = null) {
    const box = qs("#vgMsg");
    if (!box) return;
    box.className = `vg-msg show ${type}`; 
    box.innerHTML = message;
  }

  function renderGate() {
    if (state.mounted) return;
    state.mounted = true;

    const style = ce("style");
    style.textContent = `
      #vgGate{position:fixed;inset:0;z-index:2147483647;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(25px);-webkit-backdrop-filter:blur(25px);}
      #vgGate .vg-panel{width:min(420px,90vw);border:1px solid rgba(255,23,68,0.2);border-radius:24px;overflow:hidden;color:#fff;font-family:Inter,system-ui,sans-serif;background:rgba(15,10,10,0.6);box-shadow:0 20px 50px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05);animation:gatePop 0.4s cubic-bezier(0.16,1,0.3,1);}
      @keyframes gatePop { 0% { opacity: 0; transform: scale(0.9) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
      #vgGate .vg-hd{text-align:center;padding:35px 20px 10px;}
      #vgGate .vg-icon-top{font-size:40px;color:#ff1744;margin-bottom:15px;text-shadow:0 0 20px rgba(255,23,68,0.5);}
      #vgGate .vg-brand{font-size:24px;font-weight:900;letter-spacing:1px;background:linear-gradient(90deg,#fff,#ff1744);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
      #vgGate .vg-sub{font-size:12px;color:#94a3b8;margin-top:5px;font-weight:600;letter-spacing:2px;}
      #vgGate .vg-bd{padding:20px 35px 35px;}
      #vgGate .vg-label{font-size:12px;font-weight:700;color:#ff9f9f;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;}
      #vgGate .vg-input-wrap{position:relative;margin-bottom:20px;}
      #vgGate .vg-input{width:100%;padding:16px 90px 16px 16px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.4);color:#fff;font-size:15px;font-weight:600;transition:all 0.3s;box-shadow:inset 0 2px 5px rgba(0,0,0,0.5);box-sizing:border-box;}
      #vgGate .vg-input:focus{outline:none;border-color:#ff1744;box-shadow:0 0 15px rgba(255,23,68,0.2), inset 0 2px 5px rgba(0,0,0,0.5);}
     #vgGate .vg-btn-inline{position:absolute;right:8px;bottom:7px;height:38px;border:none;background:rgba(255,23,68,0.15);color:#ff1744;border-radius:10px;padding:0 16px;font-size:12px;font-weight:800;cursor:pointer;transition:0.2s;display:flex;align-items:center;justify-content:center;}
      #vgGate .vg-btn-inline:hover{background:#ff1744;color:#fff;}
      #vgGate .vg-actions{display:flex;gap:12px;margin-top:25px;}
      #vgGate .vg-btn{flex:1;padding:16px;border-radius:14px;border:none;font-size:15px;font-weight:800;cursor:pointer;transition:all 0.2s;text-transform:uppercase;letter-spacing:1px;}
      #vgGate .vg-btn--pri{background:linear-gradient(135deg,#ff1744,#d50000);color:#fff;box-shadow:0 10px 20px rgba(255,23,68,0.3);}
      #vgGate .vg-btn--pri:hover{box-shadow:0 10px 25px rgba(255,23,68,0.5);transform:translateY(-2px);}
      #vgGate .vg-btn--pri:active{transform:translateY(0) scale(0.98);}
      #vgGate .vg-btn--ghost{background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.1);}
      #vgGate .vg-btn--ghost:hover{background:rgba(255,255,255,0.1);}
      #vgGate .vg-foot{display:flex;justify-content:space-between;align-items:center;margin-top:20px;font-size:12px;color:#94a3b8;}
      #vgGate .vg-foot a{color:#ff1744;text-decoration:none;font-weight:700;}
      #vgGate .vg-msg{margin-top:20px;padding:12px;border-radius:10px;font-size:13px;text-align:center;font-weight:600;display:none;}
      #vgGate .vg-msg.show{display:block;}
      #vgGate .vg-msg.ok{background:rgba(47,158,68,0.1);border:1px solid rgba(47,158,68,0.3);color:#b9ffd1;}
      #vgGate .vg-msg.warn{background:rgba(184,134,11,0.1);border:1px solid rgba(184,134,11,0.3);color:#ffe9b0;}
      #vgGate .vg-msg.err{background:rgba(255,23,68,0.1);border:1px solid rgba(255,23,68,0.3);color:#ffcfcf;}
    `;
    document.head.appendChild(style);

    const wrap = ce("div", { id: "vgGate" }, `
      <div class="vg-panel">
        <div class="vg-hd">
          <div class="vg-icon-top"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
          <div class="vg-brand">INFINITY LOCK</div>
          <div class="vg-sub">ADMIN : MINH HIẾU</div>
        </div>
        <div class="vg-bd">
          <div class="vg-input-wrap">
            <div class="vg-label">Mã Kích Hoạt</div>
            <input id="vgKey" class="vg-input" type="text" placeholder="Nhập key của bạn..." autocomplete="off">
            <button class="vg-btn-inline" id="vgPasteKey">DÁN</button>
          </div>
          <div class="vg-input-wrap">
            <div class="vg-label">Mã Thiết Bị</div>
            <input id="vgDev" class="vg-input" type="text" readonly style="color: #94a3b8; font-size: 13px;">
            <button class="vg-btn-inline" id="vgCopyDev">COPY</button>
          </div>
          <div id="vgMsg" class="vg-msg show ok">Hệ thống sẵn sàng.</div>
          <div class="vg-actions">
            <button class="vg-btn vg-btn--ghost" id="vgReset">ĐẶT LẠI</button>
            <button class="vg-btn vg-btn--pri" id="vgActive">ĐĂNG NHẬP</button>
          </div>
          <div class="vg-foot">
            <span id="vgSta">Chưa kích hoạt</span>
            <a href="#" id="vgContact">GET KEY</a>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(wrap);

    qs("#vgKey").value = loadSavedKey();
    qs("#vgDev").value = state.deviceId;
    updateFooter("");

    qs("#vgPasteKey").onclick = async () => { try { const text = await navigator.clipboard.readText(); qs("#vgKey").value = (text || "").trim(); toast("Đã dán key.", "ok"); } catch { qs("#vgKey").value = (prompt("Dán mã kích hoạt tại đây:", "") || "").trim(); } qs("#vgKey").focus(); };
    qs("#vgCopyDev").onclick = async () => { try { await navigator.clipboard.writeText(state.deviceId); toast("Đã copy HWID.", "ok"); } catch { toast("Lỗi copy.", "warn"); } };
    qs("#vgReset").onclick = () => { qs("#vgKey").value = ""; clearKey(); state.verified = false; updateFooter(""); lockUI(); toast("Đã xóa key.", "ok"); };
    qs("#vgContact").onclick = (e) => { e.preventDefault(); window.open(CONFIG.contactUrl, "_blank"); };
    qs("#vgActive").onclick = onActivate; 
  }

  async function onCheck() {
    const key = qs("#vgKey").value.trim();
    if (!key) return toast("Vui lòng nhập Mã Kích Hoạt.", "warn");
    toast("Đang kiểm tra...", "warn");
    const result = await safeCall(() => checkLicense(key, state.deviceId));
    if (result) handleLicenseResult(result, key, false);
  }

  async function onActivate() {
    const key = qs("#vgKey").value.trim();
    if (!key) return toast("Vui lòng nhập Mã Kích Hoạt.", "warn");
    toast("Đang kích hoạt...", "warn");
    const result = await safeCall(() => activateLicense(key, state.deviceId));
    if (result) handleLicenseResult(result, key, true);
  }

  function handleLicenseResult(result, key, activated) {
    const status = result.status || "";
    const expiresAt = result.expiresAt || "";

    if (result.ok) {
      saveKey(key);
      state.expiresAt = expiresAt;
      updateFooter(expiresAt);

      if (activated) {
        state.verified = true;
        unlockUI();
        playBeep();
        toast(`✅ Đăng nhập thành công<br>Hết hạn: <b>${escapeHtml(formatDateVN(expiresAt))}</b>`, "ok", result.raw);
      } else {
        playBeep();
        toast(`Key Hợp Lệ<br>Hết hạn: <b>${escapeHtml(formatDateVN(expiresAt))}</b>`, "ok", result.raw);
      }
      dispatchLicenseChange({ state: activated ? "activated" : "verified", verified: state.verified, key, deviceId: state.deviceId, expiresAt, raw: result.raw });
      return;
    }

    state.verified = false;
    updateFooter("");
    const messageMap = { EXPIRED: "Mã đã hết hạn⛔", REVOKED: "Mã đã bị thu hồi🚫", NOT_FOUND: "Không tìm thấy mã⚠️", INVALID_KEY: "Key không tồn tại❌", HWID_MISMATCH: "Key đã đăng nhập trên thiết bị khác📱", BOUND_TO_ANOTHER_DEVICE: "Mã đã gắn với thiết bị khác.", INVALID_JSON: "Server trả dữ liệu không hợp lệ." };
    toast(messageMap[status] || `❌ Lỗi: ${escapeHtml(status || "UNKNOWN")}`, "err", result.raw);
    
    if (CONFIG.relockWhenInvalid) lockUI();
    dispatchLicenseChange({ state: "invalid", verified: false, key, deviceId: state.deviceId, expiresAt: "", raw: result.raw });
  }

  async function autoBootCheck() {
    const savedKey = loadSavedKey();
    if (!savedKey || !CONFIG.autoCheckOnLoad) { lockUI(); return; }
    const result = await safeCall(() => checkLicense(savedKey, state.deviceId));
    if (!result) { lockUI(); return; }
    handleLicenseResult(result, savedKey, false);
  }

  function init() {
    state.deviceId = getOrCreateDeviceId();
    renderGate(); 
    autoBootCheck();

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || !state.verified) return; 
      const savedKey = loadSavedKey();
      if (!savedKey) return;
      const result = await safeCall(() => checkLicense(savedKey, state.deviceId));
      if (result) handleLicenseResult(result, savedKey, false);
    });

    window.VSHKeyGate = {
      show: lockUI, hide: unlockUI,
      reset() { clearKey(); state.verified = false; updateFooter(""); lockUI(); },
      getState() { return { ...state }; },
      async check() { return onCheck(); },
      async activate() { return onActivate(); },
    };
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init, { once: true }); } 
  else { init(); }
})();