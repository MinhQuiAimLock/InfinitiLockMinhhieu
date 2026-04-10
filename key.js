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

  function renderGate() {
    if (state.mounted) return;
    state.mounted = true;

    const style = ce("style");
    style.textContent = `
      #vgGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(15,8,8,.85);backdrop-filter:blur(10px)}
      #vgGate .vg-panel{width:min(620px,92vw);border:1px solid rgba(255,51,51,0.4);border-radius:18px;overflow:hidden;color:#ffe7e7;font-family:Inter,system-ui,Arial;background:linear-gradient(180deg,rgba(40,10,10,0.95),rgba(15,5,5,0.98));box-shadow:0 0 40px rgba(255,0,0,0.25), inset 0 0 20px rgba(255,51,51,0.1)}
      #vgGate .vg-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(255,51,51,0.2);background:rgba(255,0,0,0.05)}
      #vgGate .vg-brand{font-weight:900;letter-spacing:1px;white-space:nowrap;color:#ff3333;text-shadow:0 0 10px rgba(255,51,51,0.6)}
      #vgGate .vg-hd-rt{display:flex;gap:8px}
      #vgGate .vg-btn{padding:10px 16px;border-radius:12px;border:1px solid #563a3a;background:#2a1919;color:#ffe7e7;cursor:pointer;font-weight:700;transition:all 0.2s}
      #vgGate .vg-btn:hover{filter:brightness(1.2);box-shadow:0 0 10px rgba(255,51,51,0.2)}
      #vgGate .vg-btn--pri{background:linear-gradient(135deg,#ff3333,#cc0000);border:none;color:#fff;box-shadow:0 4px 15px rgba(255,51,51,0.4)}
      #vgGate .vg-btn--pri:hover{box-shadow:0 4px 20px rgba(255,51,51,0.7);transform:translateY(-1px)}
      #vgGate .vg-btn--pri:active{transform:scale(0.96)}
      #vgGate .vg-btn--ghost{background:#241414;border-color:rgba(255,51,51,0.3);color:#ff9f9f}
      #vgGate .vg-bd{padding:20px}
      #vgGate .vg-label{font-size:12px;font-weight:700;letter-spacing:1px;color:#ff9f9f;margin:0 0 8px 0}
      #vgGate .vg-field{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center}
      #vgGate .vg-input{padding:12px 14px;border-radius:12px;border:1px solid rgba(255,51,51,0.3);background:#170808;color:#ffcfcf;width:100%;font-weight:600;transition:all 0.2s;box-shadow:inset 0 0 10px rgba(255,0,0,0.1)}
      #vgGate .vg-input:focus{outline:none;border-color:#ff3333;box-shadow:0 0 0 3px rgba(255,51,51,0.25), inset 0 0 15px rgba(255,51,51,0.2)}
      #vgGate .vg-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
      #vgGate .vg-msg{margin-top:16px;padding:12px 16px;border-radius:12px;border:1px solid #3f2a2a;background:#180b0b;font-size:13px;line-height:1.5;font-weight:600}
      #vgGate .vg-msg.ok{border-color:#2f9e44;background:#0d1a12;color:#b9ffd1;box-shadow:0 0 15px rgba(47,158,68,0.15)}
      #vgGate .vg-msg.warn{border-color:#b8860b;background:#1b1607;color:#ffe9b0;box-shadow:0 0 15px rgba(184,134,11,0.15)}
      #vgGate .vg-msg.err{border-color:#ff3333;background:#2a0a0a;color:#ffcfcf;box-shadow:0 0 15px rgba(255,51,51,0.2)}
      #vgGate .vg-foot{display:flex;justify-content:space-between;align-items:center;margin-top:16px;color:#d09fb0;font-size:12px;font-weight:600}
      #vgGate details{margin-top:16px;border:1px dashed rgba(255,51,51,0.3);border-radius:12px;overflow:hidden}
      #vgGate summary{padding:12px;cursor:pointer;list-style:none;background:#150808;color:#ff9f9f;font-weight:600}
      #vgGate summary::-webkit-details-marker{display:none}
      #vgGate .vg-pre{margin:0;padding:12px;background:#100505;color:#ffcfcf;max-height:220px;overflow:auto;font-family:monospace;font-size:12px}
      #vgGate .vg-icon{display:inline-flex;align-items:center;gap:6px;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,51,51,0.3);background:#240c0c;cursor:pointer;color:#ff9f9f;font-weight:600;transition:all 0.2s}
      #vgGate .vg-icon:hover{background:#3a1414;color:#fff;border-color:#ff3333}
      body.vg-locked{overflow:hidden}
      body.vg-locked>*:not(#vgGate){filter:blur(6px);pointer-events:none !important;user-select:none !important}
      @media (max-width:520px){ #vgGate .vg-field{grid-template-columns:1fr} #vgGate .vg-hd{flex-wrap:wrap} }
    `;
    document.head.appendChild(style);

    const wrap = ce("div", { id: "vgGate" }, `
      <div class="vg-panel">
        <div class="vg-hd">
          <div class="vg-brand">Infinity Lock API CHECK KEY</div>
          <div class="vg-hd-rt"><button class="vg-btn vg-btn--ghost" id="vgReset">Nhập lại</button></div>
        </div>
        <div class="vg-bd">
          <div><div class="vg-label">Mã Kích Hoạt</div><div class="vg-field"><input id="vgKey" class="vg-input" type="text" placeholder="XXXX-XXXX" autocomplete="one-time-code" inputmode="latin"><button class="vg-icon" id="vgPasteKey">Dán</button><button class="vg-icon" id="vgDelKey">Delete</button></div></div>
          <div style="margin-top:16px"><div class="vg-label">Mã Thiết Bị</div><div class="vg-field"><input id="vgDev" class="vg-input" type="text" readonly><button class="vg-icon" id="vgCopyDev">Sao chép</button></div></div>
          <div class="vg-actions">
            <button class="vg-btn vg-btn--pri" id="vgCheck" style="flex:1">Kiểm tra</button>
            <button class="vg-btn vg-btn--pri" id="vgActive" style="flex:1">Kích Hoạt</button>
          </div>
          <div class="vg-msg" id="vgMsg">Sẵn sàng kiểm tra key.</div>
          <details id="vgDtl" hidden><summary>Chi tiết kỹ thuật</summary><pre class="vg-pre" id="vgRaw"></pre></details>
          <div class="vg-foot"><span id="vgSta">Chưa kích hoạt</span><button class="vg-btn vg-btn--ghost" id="vgContact">Get Key</button></div>
        </div>
      </div>
    `);
    document.body.appendChild(wrap);

    qs("#vgKey").value = loadSavedKey();
    qs("#vgDev").value = state.deviceId;
    updateFooter("");

    qs("#vgPasteKey").onclick = async () => { try { const text = await navigator.clipboard.readText(); qs("#vgKey").value = (text || "").trim(); toast("Đã dán.", "ok"); } catch { qs("#vgKey").value = (prompt("Dán mã kích hoạt tại đây:", "") || "").trim(); } qs("#vgKey").focus(); };
    qs("#vgDelKey").onclick = () => { qs("#vgKey").value = ""; clearKey(); state.verified = false; updateFooter(""); toast("Đã xoá mã.", "ok"); if (CONFIG.relockWhenInvalid) lockUI(); };
    qs("#vgCopyDev").onclick = async () => { try { await navigator.clipboard.writeText(state.deviceId); toast("Đã sao chép Mã Thiết Bị.", "ok"); } catch { toast("Không copy được.", "warn"); } };
    qs("#vgReset").onclick = () => { qs("#vgKey").value = ""; clearKey(); state.verified = false; updateFooter(""); lockUI(); toast("Đã reset trạng thái.", "ok"); };
    qs("#vgContact").onclick = () => { window.open(CONFIG.contactUrl, "_blank"); };
    qs("#vgCheck").onclick = onCheck;
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