import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1";
env.allowLocalModels = false;
const $ = id => document.getElementById(id);
const fmt = n => "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const KEY = "shoebox.v1";
let embed = null, protos = [], learned = [], txs = [], filter = "all";
const store = JSON.parse(localStorage.getItem(KEY) || "{}");
const saved = store.merchants || (store.pct ? {} : store); // { merchant: line } remembered corrections (v1 kept them at the top level)
const pct = store.pct || {}; // business-use % for partial lines
let gst = !!store.gst, undoState = null;
const persist = () => localStorage.setItem(KEY, JSON.stringify({ merchants: saved, pct, gst }));
const say = m => { $("live").textContent = ""; setTimeout(() => $("live").textContent = m, 60); };
const status = (m, cls) => { $("model").textContent = m; $("model").className = "model " + (cls || ""); };

async function loadModel() {
  if (embed) return embed;
  status("Model: downloading…", "busy");
  const t0 = performance.now();
  const got = {};
  embed = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8", progress_callback: p => {
    if (p.status === "progress" && p.total) { got[p.file] = [p.loaded, p.total]; const v = Object.values(got), l = v.reduce((s, x) => s + x[0], 0), t = v.reduce((s, x) => s + x[1], 0);
      status(`Model: downloading ${Math.round(l / 1e6)} of ${Math.round(t / 1e6)} MB`, "busy"); }
  } });
  const hints = LINES.flatMap(l => l.hints.map(h => ({ line: l.id, text: h })));
  const vecs = await vec(hints.map(h => h.text));
  protos = hints.map((h, i) => ({ line: h.line, vec: vecs[i] }));
  status(`Model: running locally (${Math.round(performance.now() - t0)} ms to start)`, "ok");
  return embed;
}
async function vec(texts) {
  const out = await embed(texts, { pooling: "mean", normalize: true });
  const d = out.dims[1], a = out.data, r = [];
  for (let i = 0; i < texts.length; i++) r.push(Array.from(a.slice(i * d, (i + 1) * d)));
  return r;
}

async function run(text) {
  const parsed = Logic.parseCSV(text);
  if (!parsed.length) { say("No transactions found in that file."); return; }
  $("work").hidden = false;
  $("rows").innerHTML = `<tr><td colspan="4" class="loading">Sorting ${parsed.length} transactions on your device…</td></tr>`;
  try { await loadModel(); } catch (e) {
    embed = null; status("Model didn't load", "bad");
    $("rows").innerHTML = `<tr><td colspan="4" class="loading">Shoebox couldn't download the model from Hugging Face (huggingface.co and cdn.jsdelivr.net). It needs to do that once, about 23 MB, and then your browser keeps a copy so it works offline. Check your connection or network filter and try again. Nothing from your file was sent anywhere.</td></tr>`;
    say("The model couldn't be downloaded. Nothing from your file was sent."); return;
  }
  const vs = await vec(parsed.map(t => Logic.clean(t.desc)));
  txs = parsed.map((t, i) => ({ ...t, vec: vs[i], merchant: Logic.merchant(t.desc.replace(/\b(refund|return|reversal)\b/gi, "")) }));
  txs.spend = parsed.spend; undo(false);
  learned = [];
  for (const t of txs) if (saved[t.merchant]) learned.push({ line: saved[t.merchant], vec: t.vec });
  sortAll(); draw(); say(`Sorted ${txs.length} transactions. ${txs.filter(t => !t.sure).length} need a look.`);
}
function sortAll() {
  for (const t of txs) {
    if (t.manual) continue;
    t.refund = false;
    if (t.inflow && !Logic.isRefund(t.desc)) { Object.assign(t, { line: "income", sure: true, by: "money in" }); continue; }
    if (t.inflow) t.refund = true; // a refund goes back against the merchant's line
    if (saved[t.merchant]) { Object.assign(t, { line: saved[t.merchant], sure: true, by: "you, earlier" }); continue; }
    const c = Logic.classify(t.vec, t.refund ? protos.filter(p => !Logic.SKIP.includes(p.line)) : protos, learned);
    Object.assign(t, { line: c.line, sure: c.sure, score: c.score, by: learned.length && c.score > 0 ? "model" : "model" });
  }
}
const opts = sel => LINES.map(l => `<option value="${l.id}"${l.id === sel ? " selected" : ""}>${/^\d/.test(l.id) ? l.id + " " : ""}${esc(l.name)}</option>`).join("");
function draw() {
  const show = txs.filter(t => filter === "all" || (filter === "flag" && !t.sure) || (filter === "personal" && t.line === "personal") || (filter === "biz" && t.line !== "personal" && !Logic.SKIP.includes(t.line)));
  $("rows").innerHTML = show.map(t => `<tr data-id="${t.id}" class="${t.sure ? "" : "flag"} ${t.line === "personal" || Logic.SKIP.includes(t.line) ? "dim" : ""}">
    <td>${esc(t.date)}</td>
    <td>${esc(t.desc)}${t.sure ? "" : ' <span class="tag">check</span>'}${t.manual ? ' <span class="tag you">you</span>' : ""}</td>
    <td class="r">${t.inflow ? "+" : ""}${fmt(t.amount)}${t.refund ? '<br><small>refund</small>' : ""}</td>
    <td><select data-id="${t.id}" aria-label="T2125 line for ${esc(t.desc)}">${opts(t.line)}</select></td></tr>`).join("") || `<tr><td colspan="4" class="loading">Nothing here.</td></tr>`;
  const tot = Logic.totals(txs, LINES, pct);
  const claimCell = o => o.id === "personal" ? "–" : o.claim === null ? '<span class="need">enter %</span>' : fmt(o.claim);
  const pctCell = o => o.partial ? `<br><label class="sr-only" for="pct${o.id}">Business use for line ${o.id}, percent</label><input class="pct" id="pct${o.id}" data-line="${o.id}" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="%" value="${pct[o.id] ?? ""}"> <small>% business</small>` : "";
  $("lines").innerHTML = `<thead><tr><th scope="col">Line</th><th scope="col" class="r">Spent</th><th scope="col" class="r">Claim</th></tr></thead><tbody>` +
    tot.byLine.filter(o => o.n).map(o => `<tr class="${o.id === "personal" ? "dim" : ""}"><th scope="row">${o.id === "personal" ? "" : o.id + " "}${esc(o.name)} <small>(${o.n})</small>${pctCell(o)}</th><td class="r">${fmt(o.spent)}</td><td class="r">${claimCell(o)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><th scope="row">Total deductible</th><td></td><td class="r">${fmt(tot.deductible)}</td></tr></tfoot>`;
  $("missing").hidden = !tot.missing.length;
  $("missing").textContent = tot.missing.length ? `The total leaves out line${tot.missing.length > 1 ? "s" : ""} ${tot.missing.join(" and ")} until you enter a business-use percentage.` : "";
  $("gstWarn").hidden = !gst; $("gst").checked = gst;
  $("signNote").textContent = txs.spend === "all" ? "Every amount is treated as spending." : `Treating ${txs.spend} amounts as spending.`;
  $("flip").hidden = txs.spend === "all";
  $("sN").textContent = txs.length;
  $("sFlag").textContent = txs.filter(t => !t.sure).length;
  $("sLearn").textContent = Object.keys(saved).length;
  $("sDed").textContent = fmt(tot.deductible);
}
const snap = () => ({ rows: txs.map(x => [x.line, x.manual, x.sure]), saved: { ...saved }, learned: learned.slice() });
function undo(apply) {
  if (apply && undoState) {
    txs.forEach((x, i) => { [x.line, x.manual, x.sure] = undoState.rows[i]; });
    Object.keys(saved).forEach(k => delete saved[k]); Object.assign(saved, undoState.saved); learned = undoState.learned; persist();
    draw(); say("Undone.");
  }
  undoState = null; $("undoBar").hidden = true;
}
$("rows").addEventListener("change", e => {
  const t = txs.find(x => x.id == e.target.dataset.id); if (!t) return;
  undoState = snap();
  t.line = e.target.value; t.manual = true; t.sure = true;
  saved[t.merchant] = t.line; persist();
  learned.push({ line: t.line, vec: t.vec });
  const before = txs.map(x => x.line);
  // same merchant follows; everything else is re-scored with the new example
  txs.forEach(x => { if (x !== t && x.merchant === t.merchant && !x.manual) { x.line = t.line; x.sure = true; } });
  sortAll();
  const moved = txs.filter((x, i) => x !== t && before[i] !== x.line);
  const same = moved.filter(x => x.merchant === t.merchant).length, other = moved.length - same;
  const id = t.id; draw();
  const sel = $("rows").querySelector(`select[data-id="${id}"]`); if (sel) sel.focus();
  const name = t.merchant ? t.merchant.replace(/\b\w/g, c => c.toUpperCase()) : "this merchant";
  const msg = `Saved ${name} as ${LINES.find(l => l.id === t.line).name.toLowerCase()}.` + (same ? ` Moved ${same} other ${name} row${same > 1 ? "s" : ""}.` : "") + (other ? ` ${other} similar row${other > 1 ? "s" : ""} moved too.` : "");
  $("undoMsg").textContent = msg; $("undoBar").hidden = false; say(msg);
});
$("undo").addEventListener("click", () => undo(true));
$("lines").addEventListener("input", e => {
  if (!e.target.dataset.line) return;
  const v = e.target.value; if (v === "") delete pct[e.target.dataset.line]; else pct[e.target.dataset.line] = Math.min(100, Math.max(0, +v));
  persist();
  const tot = Logic.totals(txs, LINES, pct); // update numbers without redrawing the input you're typing in
  const o = tot.byLine.find(x => x.id === e.target.dataset.line);
  e.target.closest("tr").lastElementChild.innerHTML = o.claim === null ? '<span class="need">enter %</span>' : fmt(o.claim);
  $("lines").querySelector("tfoot td.r").textContent = fmt(tot.deductible); $("sDed").textContent = fmt(tot.deductible);
  $("missing").hidden = !tot.missing.length;
  $("missing").textContent = tot.missing.length ? `The total leaves out line${tot.missing.length > 1 ? "s" : ""} ${tot.missing.join(" and ")} until you enter a business-use percentage.` : "";
});
$("flip").addEventListener("click", () => {
  Logic.setSpend(txs, txs.spend === "negative" ? "positive" : "negative");
  txs.forEach(x => { x.manual = false; }); undo(false); sortAll(); draw(); say($("signNote").textContent);
});
$("gst").addEventListener("change", e => { gst = e.target.checked; persist(); draw(); });
$("forget").addEventListener("click", () => {
  const n = Object.keys(saved).length; Object.keys(saved).forEach(k => delete saved[k]); learned = []; persist();
  if (txs.length) { txs.forEach(x => { x.manual = false; }); undo(false); sortAll(); draw(); }
  say(n ? `Forgot ${n} saved merchant${n > 1 ? "s" : ""}.` : "No saved merchants to forget.");
});
document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
  filter = c.dataset.f; document.querySelectorAll(".chip").forEach(x => { x.classList.toggle("on", x === c); x.setAttribute("aria-pressed", x === c); }); draw();
}));
$("file").addEventListener("change", async e => { const f = e.target.files[0]; if (f) run(await f.text()); });
$("sample").addEventListener("click", async () => run(await (await fetch("sample.csv")).text()));
function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
$("dlSum").addEventListener("click", () => { const t = Logic.totals(txs, LINES, pct); download("t2125-totals.csv", Logic.toCSV([["Line", "Name", "Spent", "Business use %", "Claim"], ...t.byLine.filter(o => o.n).map(o => [o.id === "personal" ? "" : o.id, o.name, o.spent.toFixed(2), o.partial ? (o.pct ?? "") : "", o.claim === null ? "needs business-use %" : o.claim.toFixed(2)]), ["", "Total deductible", "", "", t.deductible.toFixed(2)]])); });
$("dlTx").addEventListener("click", () => download("sorted-transactions.csv", Logic.toCSV([["Date", "Description", "Amount", "Line", "Line name"], ...txs.map(t => [t.date, t.desc, (t.inflow ? "" : "-") + t.amount.toFixed(2), /^\d/.test(t.line) ? t.line : "", LINES.find(l => l.id === t.line).name + (t.refund ? " (refund)" : "")])])));
