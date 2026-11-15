const API = "/api";
const $ = (sel) => document.querySelector(sel);

// Enforce Dark Navy theme exclusively
document.documentElement.setAttribute("data-theme", "navy");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function formatPoints(pts) {
  return Number(pts).toLocaleString("en-US");
}

const session = {
  get token() { try { return localStorage.getItem("ecg_token"); } catch { return null; } },
  set token(v) { try { v ? localStorage.setItem("ecg_token", v) : localStorage.removeItem("ecg_token"); } catch {} },
  get user() { try { return localStorage.getItem("ecg_user"); } catch { return null; } },
  set user(v) { try { v ? localStorage.setItem("ecg_user", v) : localStorage.removeItem("ecg_user"); } catch {} },
};
const adminToken = {
  get() { try { return sessionStorage.getItem("ecg_admin"); } catch { return null; } },
  set(v) { try { v ? sessionStorage.setItem("ecg_admin", v) : sessionStorage.removeItem("ecg_admin"); } catch {} },
};

async function api(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function setMsg(el, text, ok = false) {
  el.textContent = text;
  el.className = "msg " + (text ? (ok ? "ok" : "err") : "");
}

// ---------- Tabs & 3-Dots Menu (Admin) ----------
const kebabBtn = $("#kebab-btn");
const kebabMenu = $("#kebab-menu");

if (kebabBtn && kebabMenu) {
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = kebabMenu.hidden;
    kebabMenu.hidden = !isHidden;
    kebabBtn.setAttribute("aria-expanded", String(isHidden));
  });

  document.addEventListener("click", (e) => {
    if (!kebabMenu.contains(e.target) && !kebabBtn.contains(e.target)) {
      kebabMenu.hidden = true;
      kebabBtn.setAttribute("aria-expanded", "false");
    }
  });
}

function activateTab(tabId) {
  document.querySelectorAll(".tabs .tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === tabId);
  });

  if (kebabBtn) {
    kebabBtn.classList.toggle("on", tabId === "admin");
    kebabBtn.setAttribute("aria-expanded", "false");
  }
  if (kebabMenu) {
    kebabMenu.hidden = true;
  }

  if (tabId === "admin" && adminToken.get()) loadAdmin();
  if (tabId === "leaderboard") loadLeaderboard();
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

// ================= LEADERBOARD =================
async function loadLeaderboard() {
  const podiumEl = $("#podium-area");
  const listEl = $("#ranking-list");
  const countEl = $("#members-count");
  const msgEl = $("#leaderboard-msg");

  try {
    const data = await api("leaderboard").catch(() => ({ rows: [] }));
    const rows = (data && data.rows && Array.isArray(data.rows)) ? data.rows : [];

    setMsg(msgEl, "");
    if (countEl) {
      countEl.textContent = `${rows.length} participant${rows.length !== 1 ? "s" : ""}`;
    }

    if (rows.length === 0) {
      // Empty state: empty podium waiting for players
      if (podiumEl) {
        podiumEl.innerHTML = `
          <!-- 2nd Place: Left (Snow White) -->
          <div class="podium-col col-2">
            <div class="podium-user">
              <b class="user-name">-</b>
              <span class="user-pts">0</span>
            </div>
            <div class="podium-pillar pillar-2">2</div>
          </div>

          <!-- 1st Place: Center (Leaf Green) -->
          <div class="podium-col col-1">
            <div class="podium-user">
              <b class="user-name">-</b>
              <span class="user-pts">0</span>
            </div>
            <div class="podium-pillar pillar-1">1</div>
          </div>

          <!-- 3rd Place: Right (Fire Red) -->
          <div class="podium-col col-3">
            <div class="podium-user">
              <b class="user-name">-</b>
              <span class="user-pts">0</span>
            </div>
            <div class="podium-pillar pillar-3">3</div>
          </div>
        `;
      }
      if (listEl) {
        listEl.innerHTML = `
          <p class="hint" style="text-align:center; padding: 24px 0 12px; margin: 0;">
            No confirmed scores yet.<br>Scan a winning code and get confirmed to take the podium!
          </p>
        `;
      }
      return;
    }

    // Top 3 participants for podium
    const top1 = rows[0] || null;
    const top2 = rows.length > 1 ? rows[1] : null;
    const top3 = rows.length > 2 ? rows[2] : null;

    if (podiumEl) {
      podiumEl.innerHTML = `
        <!-- 2nd Place: Left (Snow White) -->
        <div class="podium-col col-2">
          <div class="podium-user">
            <b class="user-name">${escapeHtml(top2 ? top2.name : "-")}</b>
            <span class="user-pts">${top2 ? formatPoints(top2.points) : "0"}</span>
          </div>
          <div class="podium-pillar pillar-2">2</div>
        </div>

        <!-- 1st Place: Center (Leaf Green) -->
        <div class="podium-col col-1">
          <div class="podium-user">
            <b class="user-name">${escapeHtml(top1 ? top1.name : "-")}</b>
            <span class="user-pts">${top1 ? formatPoints(top1.points) : "0"}</span>
          </div>
          <div class="podium-pillar pillar-1">1</div>
        </div>

        <!-- 3rd Place: Right (Fire Red) -->
        <div class="podium-col col-3">
          <div class="podium-user">
            <b class="user-name">${escapeHtml(top3 ? top3.name : "-")}</b>
            <span class="user-pts">${top3 ? formatPoints(top3.points) : "0"}</span>
          </div>
          <div class="podium-pillar pillar-3">3</div>
        </div>
      `;
    }

    // Ranks 4+ in the list below the podium
    if (listEl) {
      listEl.innerHTML = "";
      const remaining = rows.slice(3);

      if (remaining.length === 0) {
        // All participants fit in the podium
        listEl.innerHTML = "";
      } else {
        const maxPts = (top1 && top1.points) ? top1.points : 1;
        remaining.forEach((r) => {
          const pct = Math.max(5, Math.min(100, Math.round((r.points / maxPts) * 100)));
          const item = document.createElement("div");
          item.className = "rank-item";
          item.innerHTML = `
            <span class="rank-num">${r.place}</span>
            <div class="rank-info">
              <div class="rank-header">
                <span class="rank-name">${escapeHtml(r.name)}</span>
                <span class="rank-pts">${formatPoints(r.points)}</span>
              </div>
              <div class="rank-bar-track">
                <div class="rank-bar-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
          listEl.append(item);
        });
      }
    }
  } catch (err) {
    setMsg(msgEl, err.message);
  }
}
$("#refresh-leaderboard").addEventListener("click", loadLeaderboard);

// ================= VISITOR =================
function renderVisitor() {
  const loggedIn = !!session.token;
  $("#auth").hidden = loggedIn;
  $("#scanner-area").hidden = !loggedIn;
  $("#who").textContent = session.user || "";
}

$("#go-to-register")?.addEventListener("click", () => switchAuth("register"));
$("#go-to-login")?.addEventListener("click", () => switchAuth("login"));
function switchAuth(mode) {
  const login = mode === "login";
  const loginView = $("#login-view");
  const regView = $("#register-view");
  if (loginView) loginView.hidden = !login;
  if (regView) regView.hidden = login;
  setMsg($("#auth-msg"), "");
}

// Password visibility toggling
document.querySelectorAll(".toggle-pass").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    const openIcon = btn.querySelector(".eye-open");
    const closedIcon = btn.querySelector(".eye-closed");
    if (openIcon) openIcon.classList.toggle("hidden", isPass);
    if (closedIcon) closedIcon.classList.toggle("hidden", !isPass);
  });
});

async function authSubmit(form, path, msgEl) {
  const fd = new FormData(form);
  try {
    const data = await api(path, {
      method: "POST",
      body: { username: fd.get("username"), password: fd.get("password") },
    });
    session.token = data.token;
    session.user = data.username;
    form.reset();
    renderVisitor();
  } catch (err) {
    setMsg(msgEl, err.message);
  }
}
$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  authSubmit(e.target, "login", $("#auth-msg"));
});
$("#register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  authSubmit(e.target, "register", $("#auth-msg"));
});

$("#logout").addEventListener("click", () => {
  stopCamera();
  session.token = null;
  session.user = null;
  renderVisitor();
});

// ================= CODE VERIFICATION RESULT =================
function showCodeResult(valid, data = {}) {
  const card = $("#code-result");
  const successState = $("#result-success");
  const errorState = $("#result-error");
  if (!card) return;

  card.hidden = false;
  card.className = "code-result-card " + (valid ? "is-valid" : "is-invalid");

  if (valid) {
    if (successState) {
      successState.hidden = false;
      successState.style.display = "flex";
    }
    if (errorState) {
      errorState.hidden = true;
      errorState.style.display = "none";
    }
    const tag = successState?.querySelector(".result-tag");
    const title = successState?.querySelector(".result-title");
    const desc = $("#success-desc");
    const pts = $("#success-points");

    if (data.status === "pending") {
      if (tag) tag.textContent = "AWAITING HOST CONFIRMATION";
      if (title) title.textContent = "CODE SCANNED!";
      if (pts) pts.textContent = `+${data.points || 0} Points Pending Host Approval`;
    } else {
      if (tag) tag.textContent = "CODE VERIFIED";
      if (title) title.textContent = "CONGRATULATIONS!";
      if (pts) pts.textContent = `+${data.points || 0} Points Confirmed!`;
    }

    if (desc) {
      desc.textContent = data.message || `Completed "${data.challenge}". Awaiting host confirmation.`;
    }
  } else {
    if (successState) {
      successState.hidden = true;
      successState.style.display = "none";
    }
    if (errorState) {
      errorState.hidden = false;
      errorState.style.display = "flex";
    }
    const desc = $("#error-desc");
    if (desc) {
      desc.textContent = data.error || data.message || "Invalid code! The entered code does not match any challenge.";
    }
  }

  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

$("#close-result")?.addEventListener("click", () => {
  const card = $("#code-result");
  if (card) card.hidden = true;
});

// ---- Submitting a code ----
async function submitCode(code) {
  setMsg($("#scan-msg"), "Checking code…", true);
  try {
    const data = await api("scan", {
      method: "POST",
      body: { code },
      headers: { Authorization: `Bearer ${session.token}` },
    });
    setMsg($("#scan-msg"), "");
    showCodeResult(true, data);
    if ($("#manual-code")) $("#manual-code").value = "";
    loadLeaderboard();
  } catch (err) {
    if (/log in/i.test(err.message)) {
      session.token = null;
      session.user = null;
      renderVisitor();
    }
    setMsg($("#scan-msg"), "");
    showCodeResult(false, { error: err.message });
  }
}

$("#check-win")?.addEventListener("click", async () => {
  setMsg($("#scan-msg"), "Checking your win status…", true);
  try {
    const { wins } = await api("my-wins", { headers: { Authorization: `Bearer ${session.token}` } });
    const confirmed = wins.filter((w) => w.status === "confirmed");
    const pending = wins.filter((w) => w.status === "pending");

    if (pending.length && !confirmed.length) {
      const latest = pending[0];
      showCodeResult(true, {
        challenge: latest.challenge,
        points: latest.points,
        status: "pending",
        message: `You have ${pending.length} submission(s) pending host confirmation. The host will confirm before points are added to the leaderboard!`,
      });
      setMsg($("#scan-msg"), "");
    } else if (confirmed.length) {
      const latest = confirmed[0];
      const pendingText = pending.length ? ` (${pending.length} more pending host confirmation)` : "";
      showCodeResult(true, {
        challenge: latest.challenge,
        points: latest.points,
        status: "confirmed",
        message: `You have ${confirmed.length} confirmed win${confirmed.length > 1 ? "s" : ""}${pendingText}! Active on the leaderboard.`,
      });
      setMsg($("#scan-msg"), "");
    } else {
      setMsg($("#scan-msg"), "No submissions yet. Scan or enter a challenge code above!", true);
    }
  } catch (err) {
    if (/log in/i.test(err.message)) {
      session.token = null;
      session.user = null;
      renderVisitor();
    }
    setMsg($("#scan-msg"), err.message);
  }
});

$("#manual-submit").addEventListener("click", () => {
  const code = $("#manual-code").value.trim();
  if (code) submitCode(code);
});

// ---- Camera scanning ----
let stream = null;
let rafId = null;
let scanning = false;

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMsg($("#scan-msg"), "Camera is not available here. Use the paste option below.");
    return;
  }
  if (typeof jsQR === "undefined") {
    setMsg($("#scan-msg"), "Scanner is still loading. Please try again in a moment.");
    return;
  }
  try {
    // Ask for the back camera first; fall back to any camera (laptops have only a front one).
    stream = await navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .catch((err) => {
        if (err.name === "OverconstrainedError" || err.name === "NotFoundError") {
          return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        throw err;
      });
  } catch {
    setMsg($("#scan-msg"), "Camera permission was denied. Use the paste option below.");
    return;
  }
  const video = $("#video");
  video.srcObject = stream;
  await video.play();
  $(".video-wrap").hidden = false;
  $("#start-scan").hidden = true;
  setMsg($("#scan-msg"), "");
  scanning = true;
  tick();
}

function stopCamera() {
  scanning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  const video = $("#video");
  if (video) video.srcObject = null;
  $(".video-wrap").hidden = true;
  $("#start-scan").hidden = false;
}

function tick() {
  if (!scanning) return;
  const video = $("#video");
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    if (found && found.data) {
      stopCamera();
      submitCode(found.data);
      return;
    }
  }
  rafId = requestAnimationFrame(tick);
}

$("#start-scan").addEventListener("click", startCamera);
$("#stop-scan").addEventListener("click", stopCamera);

renderVisitor();

// ================= ADMIN =================
$("#admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = new FormData(e.target).get("token");
  setMsg($("#admin-login-msg"), "");
  try {
    await api("admin/challenges", { headers: { "X-Admin-Token": token } });
    adminToken.set(token);
    e.target.reset();
    loadAdmin();
  } catch (err) {
    setMsg($("#admin-login-msg"), err.message);
  }
});

$("#admin-logout").addEventListener("click", () => {
  adminToken.set(null);
  renderAdmin();
});

function renderAdmin() {
  const on = !!adminToken.get();
  $("#admin-login").hidden = on;
  $("#admin-area").hidden = !on;
}

function adminHeaders() {
  return { "X-Admin-Token": adminToken.get() };
}

async function loadAdmin() {
  renderAdmin();
  if (!adminToken.get()) return;
  await Promise.all([loadChallenges(), loadWins()]);
}

// ---- Challenges ----
$("#generate-code-btn")?.addEventListener("click", () => {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const input = $("#ref-code-input");
  if (input) {
    input.value = `ECO-${rand}`;
    input.focus();
  }
});

$("#challenge-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  setMsg($("#challenge-msg"), "");
  try {
    await api("admin/challenges", {
      method: "POST",
      headers: adminHeaders(),
      body: {
        name: fd.get("name").trim(),
        points: Number(fd.get("points")),
        referenceCode: (fd.get("referenceCode") || "").trim(),
      },
    });
    e.target.reset();
    setMsg($("#challenge-msg"), "Challenge created with reference QR code!", true);
    loadChallenges();
  } catch (err) {
    if (/token/i.test(err.message)) { adminToken.set(null); renderAdmin(); }
    setMsg($("#challenge-msg"), err.message);
  }
});

async function loadChallenges() {
  const list = $("#challenge-list");
  try {
    const { challenges } = await api("admin/challenges", { headers: adminHeaders() });
    list.innerHTML = "";
    if (!challenges.length) {
      list.innerHTML = '<p class="hint">No challenges yet. Add one above to generate its game QR code.</p>';
      return;
    }
    challenges.forEach((c) => {
      const card = document.createElement("div");
      card.className = "qr-card";

      const qrWrap = document.createElement("div");
      qrWrap.className = "qr-preview-wrap";
      const img = document.createElement("img");
      img.alt = `QR code for ${c.name}`;
      img.width = 180;
      img.height = 180;

      const title = document.createElement("strong");
      title.className = "qr-title";
      title.textContent = c.name;

      const pts = document.createElement("span");
      pts.className = "qr-pts-badge";
      pts.textContent = `${c.points} Points`;

      const codeBox = document.createElement("div");
      codeBox.className = "ref-code-box";
      const codeVal = c.referenceCode || c.payload;
      const codeText = document.createElement("code");
      codeText.textContent = codeVal;
      codeText.title = "Reference QR Code Value";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "chip mini-chip";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard?.writeText(codeVal);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
      });
      codeBox.append(codeText, copyBtn);

      const actions = document.createElement("div");
      actions.className = "qr-card-actions";

      const dl = document.createElement("button");
      dl.type = "button";
      dl.className = "btn small";
      dl.textContent = "Download QR";
      dl.addEventListener("click", () => {
        const a = document.createElement("a");
        a.download = `qr-${c.name.replace(/\W+/g, "-").toLowerCase()}.png`;
        a.href = img.src;
        a.click();
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn small secondary delete-btn";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        if (!confirm(`Delete challenge "${c.name}"?`)) return;
        try {
          await api(`admin/challenges/${c.id}`, { method: "DELETE", headers: adminHeaders() });
          loadChallenges();
        } catch (err) {
          setMsg($("#challenge-msg"), err.message);
        }
      });

      actions.append(dl, del);
      qrWrap.append(img);
      card.append(qrWrap, title, pts, codeBox, actions);
      list.append(card);

      // Render the QR code using vendor/qrcode.js
      try {
        const qr = qrcode(0, "M");
        qr.addData(codeVal);
        qr.make();
        img.src = qr.createDataURL(6, 4);
      } catch (err) {
        console.error("QR render error:", err);
      }
    });
  } catch (err) {
    list.innerHTML = "";
    setMsg($("#challenge-msg"), err.message);
  }
}

// ---- Wins ----
$("#win-filter").addEventListener("change", loadWins);

async function loadWins() {
  const status = $("#win-filter").value;
  const box = $("#win-list");
  try {
    const { wins } = await api(`admin/wins${status ? `?status=${status}` : ""}`, { headers: adminHeaders() });
    box.innerHTML = "";
    if (!wins.length) box.innerHTML = '<p class="hint">No wins here.</p>';
    wins.forEach((w) => box.append(winRow(w)));
  } catch (err) {
    box.innerHTML = "";
    setMsg($("#win-msg"), err.message);
  }
}

function winRow(w) {
  const row = document.createElement("div");
  row.className = "win";

  const info = document.createElement("div");
  const who = document.createElement("strong");
  who.textContent = w.username;
  const what = document.createElement("div");
  what.textContent = `${w.challenge} · ${w.points} pts`;
  const when = document.createElement("small");
  when.className = "hint";
  when.textContent = new Date(w.createdAt).toLocaleString();
  info.append(who, document.createElement("br"), what, when);

  const right = document.createElement("div");
  right.className = "win-actions";
  const badge = document.createElement("span");
  badge.className = `badge ${w.status}`;
  badge.textContent = w.status;
  right.append(badge);

  if (w.status === "pending") {
    right.append(
      actionBtn("Confirm", "confirmed", w.id),
      actionBtn("Reject", "rejected", w.id, true),
    );
  }
  row.append(info, right);
  return row;
}

function actionBtn(label, status, id, danger = false) {
  const b = document.createElement("button");
  b.className = "btn small" + (danger ? " secondary" : "");
  b.textContent = label;
  b.addEventListener("click", async () => {
    try {
      await api(`admin/wins/${id}`, { method: "POST", headers: adminHeaders(), body: { status } });
      loadWins();
    } catch (err) {
      setMsg($("#win-msg"), err.message);
    }
  });
  return b;
}

renderAdmin();
if (adminToken.get()) loadAdmin();

// ---- Atmosphere: rising glowing embers on every page ----
(function atmosphere() {
  const canvas = document.getElementById("atmosphere-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width, height;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // Responsive ember count — denser on wider screens
  const EMBER_COUNT = Math.max(60, Math.round(window.innerWidth / 18));

  // Particle types: ember (small dot), wisp (larger soft orb), trail (tiny spark)
  const TYPES = ["ember", "ember", "ember", "wisp", "spark"];

  // Brand Palette: Fire Red #DF3331 (55%), Leaf Green #79AE44 (30%), Snow White #F8FAF9 (15%)
  function pickColor() {
    const roll = Math.random();
    if (roll < 0.55) return { r: 223, g: 51, b: 49 };
    if (roll < 0.85) return { r: 121, g: 174, b: 68 };
    return { r: 248, g: 250, b: 249 };
  }

  class Particle {
    constructor(initialSpread) { this.reset(initialSpread); }

    reset(initialSpread = false) {
      this.type = TYPES[Math.floor(Math.random() * TYPES.length)];
      this.x = Math.random() * width;
      this.y = initialSpread ? Math.random() * height : height + Math.random() * 40;

      if (this.type === "wisp") {
        this.radius = 2.5 + Math.random() * 3.5;
        this.speedY = 0.15 + Math.random() * 0.3;
        this.baseAlpha = 0.25 + Math.random() * 0.3;
        this.shadowBlur = 18;
        this.wanderAmp = 0.5 + Math.random() * 1.0;
      } else if (this.type === "spark") {
        this.radius = 0.6 + Math.random() * 1.0;
        this.speedY = 0.5 + Math.random() * 0.9;
        this.baseAlpha = 0.7 + Math.random() * 0.3;
        this.shadowBlur = 5;
        this.wanderAmp = 0.2 + Math.random() * 0.5;
      } else { // ember
        this.radius = 1.0 + Math.random() * 2.2;
        this.speedY = 0.25 + Math.random() * 0.55;
        this.baseAlpha = 0.55 + Math.random() * 0.4;
        this.shadowBlur = 10;
        this.wanderAmp = 0.35 + Math.random() * 0.75;
      }

      this.wanderSpeed = 0.003 + Math.random() * 0.009;
      this.flickerSpeed = 0.025 + Math.random() * 0.06;
      this.phase = Math.random() * Math.PI * 2;
      this.step = Math.random() * 200;
      this.flick = Math.random() * 200;
      // Slight horizontal drift for organic feel
      this.driftX = (Math.random() - 0.5) * 0.06;

      const c = pickColor();
      this.r = c.r; this.g = c.g; this.b = c.b;
    }

    update() {
      this.step += this.wanderSpeed;
      this.flick += this.flickerSpeed;
      this.y -= this.speedY;
      this.x += Math.sin(this.step + this.phase) * this.wanderAmp + this.driftX;
      if (this.y < -20 || this.x < -40 || this.x > width + 40) this.reset();
    }

    draw() {
      const flicker = 0.8 + Math.sin(this.flick + this.phase) * 0.2;

      // Soft fade: full opacity through 90% of journey, gentle fade in top 10% and bottom 3%
      const topFade   = Math.min(1, this.y / (height * 0.10));
      const bottomFade = Math.min(1, (height - this.y) / (height * 0.03));
      const fade = Math.min(topFade, bottomFade);

      const a = Math.max(0, Math.min(1, this.baseAlpha * flicker * fade));
      if (a < 0.01) return;

      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${a})`;
      ctx.shadowBlur = this.shadowBlur;
      ctx.shadowColor = `rgba(${this.r},${this.g},${this.b},${a * 0.9})`;
      ctx.fill();
      ctx.restore();
    }
  }

  let particles = Array.from({ length: EMBER_COUNT }, () => new Particle(true));

  // Rebuild on resize so density stays correct
  window.addEventListener("resize", () => {
    resize();
    const newCount = Math.max(60, Math.round(window.innerWidth / 18));
    if (Math.abs(newCount - particles.length) > 10) {
      particles = Array.from({ length: newCount }, () => new Particle(true));
    }
  });

  function animate() {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) { p.update(); p.draw(); }
    requestAnimationFrame(animate);
  }
  animate();
})();
