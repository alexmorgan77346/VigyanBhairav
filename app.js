"use strict";
/* Vijnana Bhairava library – vanilla JS, localStorage, no dependencies */
const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
let DATA = null, SUTRAS = [];
const state = {
  status: store.get("vbt.status", {}),     // id -> explored | practiced
  fav: store.get("vbt.fav", {}),           // id -> true
  recent: store.get("vbt.recent", []),     // ids, newest first
  fs: store.get("vbt.fs", 1),
  theme: store.get("vbt.theme", null),
  current: null, timer: null
};
const save = () => { store.set("vbt.status", state.status); store.set("vbt.fav", state.fav); store.set("vbt.recent", state.recent); };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = n => String(n).padStart(3, "0").slice(-3 === 3 ? 0 : 0);
const num = n => String(n).padStart(2, "0");
const statusOf = id => state.status[id] || "not";
const label = { not: "Not Started", explored: "Explored", practiced: "Practiced" };

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 1800); }

/* theme */
function applyTheme() {
  const t = state.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
}
$("#themeBtn").onclick = () => {
  state.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  store.set("vbt.theme", state.theme); applyTheme();
};

/* routing */
function route() {
  const h = location.hash.replace(/^#\/?/, "") || "";
  const view = h.startsWith("sutras") ? "sutras" : h.startsWith("about") ? "about" : "home";
  for (const v of ["home", "sutras", "about"]) $("#view-" + v).hidden = v !== view;
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("on", a.dataset.nav === view));
  const m = h.match(/^sutras\/(\d+)$/);
  if (m) openSutra(+m[1], true); else closeModal(true);
  if (view === "home") renderStats();
  if (view === "sutras") renderGrid();
}
addEventListener("hashchange", route);

/* stats */
function renderStats() {
  const ex = SUTRAS.filter(s => statusOf(s.id) !== "not").length;
  const pr = SUTRAS.filter(s => statusOf(s.id) === "practiced").length;
  const fv = SUTRAS.filter(s => state.fav[s.id]).length;
  $("#sExplored").textContent = ex; $("#sPracticed").textContent = pr; $("#sFav").textContent = fv;
  $("#sPct").textContent = Math.round(pr / SUTRAS.length * 100) + "%";
  $("#barExplored").style.width = (ex / SUTRAS.length * 100) + "%";
  $("#exploredText").textContent = `You have explored ${ex} of ${SUTRAS.length} sutras.`;
}

/* grid */
function matches(s, q) {
  if (!q) return true;
  q = q.trim().toLowerCase();
  if (/^\d+$/.test(q)) return s.id === +q || s.verse_refs.includes(+q);
  return [s.sanskrit_text, s.sanskrit_title, s.hindi_title, s.english_title, s.hindi_meaning, s.english_translation, s.category, s.category_hi]
    .join(" ").toLowerCase().includes(q);
}
function renderGrid() {
  const q = $("#q").value, cat = $("#cat").value, sort = $("#sort").value, st = $("#status").value;
  let list = SUTRAS.filter(s => matches(s, q) && (!cat || s.category === cat) &&
    (!st || (st === "fav" ? state.fav[s.id] : statusOf(s.id) === st)));
  if (sort === "recent") {
    list = list.filter(s => state.recent.includes(s.id)).sort((a, b) => state.recent.indexOf(a.id) - state.recent.indexOf(b.id));
  }
  $("#count").textContent = `${list.length} of ${SUTRAS.length} sutras`;
  $("#grid").innerHTML = list.map(s => `
    <article class="card">
      <div class="top"><span>Sutra ${num(s.id)}${state.fav[s.id] ? " ★" : ""}</span><span class="badge">${esc(s.category)}</span></div>
      <p class="sk">${esc(s.sanskrit_title)}</p>
      <h3 class="hi">${esc(s.hindi_title)}</h3>
      <p class="en">${esc(s.english_title)}</p>
      <p class="desc hi">${esc(s.hindi_meaning)}</p>
      ${s.verification !== "text-verified" ? `<p class="note">${s.verification === "pend" ? "Pending verification" : "Interpretations differ"}</p>` : ""}
      <div class="top"><span class="st">${label[statusOf(s.id)]}</span><a class="btn go" href="#/sutras/${s.id}">Explore Sutra</a></div>
    </article>`).join("") || `<p class="muted">No sutras match.</p>`;
}
["q", "cat", "sort", "status"].forEach(id => $("#" + id).addEventListener("input", renderGrid));

/* modal */
function openSutra(id, fromRoute) {
  const s = SUTRAS.find(x => x.id === id); if (!s) return;
  state.current = id;
  if (statusOf(id) === "not") state.status[id] = "explored";
  state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 30); save();
  const prev = id > 1 ? id - 1 : null, next = id < SUTRAS.length ? id + 1 : null;
  $("#mBody").innerHTML = `
    <p class="muted small">Sutra ${num(s.id)} · Verse ${s.verse_refs.join("–")} · ${esc(s.category)} (${esc(s.category_hi)})</p>
    <h2 id="mTitle" class="hi">${esc(s.hindi_title)}</h2>
    <p class="muted">${esc(s.english_title)}</p>
    ${s.verification === "pend" ? `<p class="warn">Verification pending: the Sanskrit text for this verse has not been confirmed.</p>` : ""}
    ${s.interpretation_note ? `<p class="warn hi">${esc(s.interpretation_note)} (Interpretations differ.)</p>` : ""}
    <h3>Sanskrit original (verse ${s.verse_refs.join(", ")})</h3>
    <div class="sloka" id="skText">${esc(s.sanskrit_text)}</div>
    <h3>Hindi transliteration</h3>
    <p class="muted small">Sanskrit is already written in Devanagari above. A separate transliteration is not added to avoid errors.</p>
    <h3>English translation (draft)</h3>
    <p id="enText">${esc(s.english_translation)}</p>
    <h3>सरल हिंदी अर्थ</h3>
    <p class="hi" id="hiText">${esc(s.hindi_meaning)}</p>
    <h3>विस्तृत व्याख्या</h3>
    <p class="hi">${esc(s.detailed_explanation)}</p>
    <h3>अभ्यास कैसे करें?</h3>
    <ol class="hi">${s.practice_steps.map(p => `<li>${esc(p.replace(/^[^:]+:\s*/, (m) => m))}</li>`).join("")}</ol>
    <h3>English explanation</h3>
    <p>${esc(s.english_translation)} <span class="muted">${esc(s.english_explanation)}</span></p>
    <h3>Practice</h3>
    <div class="timer" id="timer">00:00</div>
    <div class="row">
      <button class="primary" data-t="5">Start 5-minute timer</button>
      <button class="primary" data-t="10">Start 10-minute timer</button>
      <button class="ghost" data-t="0">Stop</button>
    </div>
    <div class="row">
      <select id="stSel" aria-label="Status">
        ${["not", "explored", "practiced"].map(k => `<option value="${k}" ${statusOf(id) === k ? "selected" : ""}>${label[k]}</option>`).join("")}
      </select>
      <button class="ghost" id="markP">Mark as Practiced</button>
      <button class="ghost" id="favB">${state.fav[id] ? "★ Favorited" : "☆ Add to Favorites"}</button>
    </div>
    <div class="row">
      <button class="ghost" data-copy="skText">Copy Sanskrit</button>
      <button class="ghost" data-copy="hiText">Copy Hindi</button>
      <button class="ghost" data-copy="enText">Copy English</button>
    </div>
    <div class="pager">
      ${prev ? `<a class="ghost" href="#/sutras/${prev}">← Sutra ${num(prev)}</a>` : "<span></span>"}
      ${next ? `<a class="ghost" href="#/sutras/${next}">Sutra ${num(next)} →</a>` : "<span></span>"}
    </div>`;
  $("#modal").hidden = false; document.body.style.overflow = "hidden";
  $("#modal").scrollTop = 0; stopTimer(); $("#timer").textContent = fmt(s.duration_minutes * 60);
  $("#stSel").onchange = e => { if (e.target.value === "not") delete state.status[id]; else state.status[id] = e.target.value; save(); toast("Status saved"); };
  $("#markP").onclick = () => { state.status[id] = "practiced"; $("#stSel").value = "practiced"; save(); toast("Marked as practiced"); };
  $("#favB").onclick = e => { state.fav[id] ? delete state.fav[id] : state.fav[id] = true; save(); e.target.textContent = state.fav[id] ? "★ Favorited" : "☆ Add to Favorites"; };
  $("#mBody").querySelectorAll("[data-t]").forEach(b => b.onclick = () => +b.dataset.t ? startTimer(+b.dataset.t * 60) : (stopTimer(), $("#timer").textContent = "00:00"));
  $("#mBody").querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copy($("#" + b.dataset.copy).innerText));
  if (!fromRoute) location.hash = "#/sutras/" + id;
}
function closeModal(silent) {
  $("#modal").hidden = true; document.body.style.overflow = ""; stopTimer();
  if (!silent && /sutras\/\d+/.test(location.hash)) location.hash = "#/sutras";
  if (!$("#view-sutras").hidden) renderGrid();
}
$("#mClose").onclick = () => closeModal(false);
addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(false); });

/* timer */
const fmt = sec => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
function startTimer(sec) {
  stopTimer(); let left = sec; $("#timer").textContent = fmt(left);
  state.timer = setInterval(() => {
    left--; $("#timer").textContent = fmt(Math.max(left, 0));
    if (left <= 0) { stopTimer(); toast("Time complete. Mark as practiced?"); try { navigator.vibrate && navigator.vibrate(300); } catch {} }
  }, 1000);
}
function stopTimer() { clearInterval(state.timer); state.timer = null; }

/* copy */
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); toast("Copied"); } catch { toast("Copy failed"); } t.remove(); }
}

/* text size */
function applyFs() { document.documentElement.style.setProperty("--fs", state.fs); }
$("#fsUp").onclick = () => { state.fs = Math.min(1.6, +(state.fs + 0.1).toFixed(2)); store.set("vbt.fs", state.fs); applyFs(); };
$("#fsDown").onclick = () => { state.fs = Math.max(0.8, +(state.fs - 0.1).toFixed(2)); store.set("vbt.fs", state.fs); applyFs(); };

$("#resetBtn").onclick = () => { if (confirm("Reset all progress and favorites?")) { state.status = {}; state.fav = {}; state.recent = []; save(); toast("Progress reset"); renderStats(); } };

/* boot */
(async function () {
  applyTheme(); applyFs();
  try {
    const r = await fetch("sutras.json"); DATA = await r.json(); SUTRAS = DATA.sutras;
  } catch (e) { document.querySelector("main").innerHTML = "<p>Could not load sutras.json. Serve this folder over http (see README).</p>"; return; }
  const sel = $("#cat");
  sel.innerHTML = `<option value="">All categories</option>` + DATA.categories.map(c => `<option value="${esc(c.en)}">${esc(c.en)} (${esc(c.hi)})</option>`).join("");
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
