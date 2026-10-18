import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1";
env.allowLocalModels = false;
const $ = id => document.getElementById(id);
const fmt = n => "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const KEY = "shoebox.v1";
let embed = null, protos = [], learned = [], txs = [], filter = "all";
const saved = JSON.parse(localStorage.getItem(KEY) || "{}"); // { merchant: line } remembered corrections
const say = m => { $("live").textContent = ""; setTimeout(() => $("live").textContent = m, 60); };
const status = (m, cls) => { $("model").textContent = m; $("model").className = "model " + (cls || ""); };

async function loadModel() {
  if (embed) return embed;
  status("Model: downloading…", "busy");
  const t0 = performance.now();
  embed = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
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
const PLACES = /\b(toronto|ottawa|montreal|vancouver|calgary|edmonton|winnipeg|halifax|mississauga|brampton|markham|hamilton|london|quebec|on|qc|bc|ab|mb|sk|ns|nb|nl|pe|canada|ca)\b/gi;
// strip store numbers, reference codes and place names so "MARRIOTT MONTREAL" and "BISTRO MONTREAL" don't look alike
const clean = d => d.replace(/[#*]\s?\w*\d\w*/g, " ").replace(/\b\w*\d\w*\b/g, " ").replace(/[*#.]/g, " ").replace(PLACES, " ").replace(/\s+/g, " ").trim() || d;

async function run(text) {
  const parsed = Logic.parseCSV(text);
  if (!parsed.length) { say("No transactions found in that file."); return; }
  $("work").hidden = false;
  $("rows").innerHTML = `<tr><td colspan="4" class="loading">Sorting ${parsed.length} transactions on your device…</td></tr>`;
  try { await loadModel(); } catch (e) { status("Model failed to load. Check your connection and reload.", "bad"); return; }
  const vs = await vec(parsed.map(t => clean(t.desc)));
  txs = parsed.map((t, i) => ({ ...t, vec: vs[i], merchant: Logic.merchant(t.desc) }));
  learned = [];
  for (const t of txs) if (saved[t.merchant]) learned.push({ line: saved[t.merchant], vec: t.vec });
  sortAll(); draw(); say(`Sorted ${txs.length} transactions. ${txs.filter(t => !t.sure).length} need a look.`);
}
function sortAll() {
  for (const t of txs) {
    if (t.manual) continue;
    if (t.inflow) { Object.assign(t, { line: "income", sure: true, by: "money in" }); continue; }
    if (saved[t.merchant]) { Object.assign(t, { line: saved[t.merchant], sure: true, by: "you, earlier" }); continue; }
    const c = Logic.classify(t.vec, protos, learned);
    Object.assign(t, { line: c.line, sure: c.sure, score: c.score, by: learned.length && c.score > 0 ? "model" : "model" });
  }
}
const opts = sel => LINES.map(l => `<option value="${l.id}"${l.id === sel ? " selected" : ""}>${l.id === "personal" || l.id === "income" ? "" : l.id + " "}${esc(l.name)}</option>`).join("");
function draw() {
  const show = txs.filter(t => filter === "all" || (filter === "flag" && !t.sure) || (filter === "personal" && t.line === "personal") || (filter === "biz" && t.line !== "personal" && t.line !== "income"));
  $("rows").innerHTML = show.map(t => `<tr data-id="${t.id}" class="${t.sure ? "" : "flag"} ${t.line === "personal" || t.line === "income" ? "dim" : ""}">
    <td>${esc(t.date)}</td>
    <td>${esc(t.desc)}${t.sure ? "" : ' <span class="tag">check</span>'}${t.manual ? ' <span class="tag you">you</span>' : ""}</td>
    <td class="r">${t.inflow ? "+" : ""}${fmt(t.amount)}</td>
    <td><select data-id="${t.id}" aria-label="T2125 line for ${esc(t.desc)}">${opts(t.line)}</select></td></tr>`).join("") || `<tr><td colspan="4" class="loading">Nothing here.</td></tr>`;
  const tot = Logic.totals(txs, LINES);
  $("lines").innerHTML = `<thead><tr><th scope="col">Line</th><th scope="col" class="r">Spent</th><th scope="col" class="r">Claim</th></tr></thead><tbody>` +
    tot.byLine.filter(o => o.n).map(o => `<tr class="${o.id === "personal" ? "dim" : ""}"><th scope="row">${o.id === "personal" ? "" : o.id + " "}${esc(o.name)} <small>(${o.n})</small></th><td class="r">${fmt(o.spent)}</td><td class="r">${o.id === "personal" ? "–" : fmt(o.claim)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><th scope="row">Total deductible</th><td></td><td class="r">${fmt(tot.deductible)}</td></tr></tfoot>`;
  $("sN").textContent = txs.length;
  $("sFlag").textContent = txs.filter(t => !t.sure).length;
  $("sLearn").textContent = Object.keys(saved).length;
  $("sDed").textContent = fmt(tot.deductible);
}
$("rows").addEventListener("change", e => {
  const t = txs.find(x => x.id == e.target.dataset.id); if (!t) return;
  t.line = e.target.value; t.manual = true; t.sure = true;
  saved[t.merchant] = t.line; localStorage.setItem(KEY, JSON.stringify(saved));
  learned.push({ line: t.line, vec: t.vec });
  const before = txs.map(x => x.line).join();
  // same merchant follows; everything else is re-scored with the new example
  txs.forEach(x => { if (x !== t && x.merchant === t.merchant && !x.manual) { x.line = t.line; x.sure = true; } });
  sortAll();
  const moved = txs.filter((x, i) => before.split(",")[i] !== x.line).length;
  const id = t.id; draw();
  const sel = $("rows").querySelector(`select[data-id="${id}"]`); if (sel) sel.focus();
  say(`Saved for ${t.merchant || "this merchant"}.${moved ? " " + moved + " other row" + (moved > 1 ? "s" : "") + " moved." : ""}`);
});
document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
  filter = c.dataset.f; document.querySelectorAll(".chip").forEach(x => { x.classList.toggle("on", x === c); x.setAttribute("aria-pressed", x === c); }); draw();
}));
$("file").addEventListener("change", async e => { const f = e.target.files[0]; if (f) run(await f.text()); });
$("sample").addEventListener("click", async () => run(await (await fetch("sample.csv")).text()));
function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
$("dlSum").addEventListener("click", () => { const t = Logic.totals(txs, LINES); download("t2125-totals.csv", Logic.toCSV([["Line", "Name", "Spent", "Claim"], ...t.byLine.filter(o => o.n).map(o => [o.id, o.name, o.spent.toFixed(2), o.claim.toFixed(2)]), ["", "Total deductible", "", t.deductible.toFixed(2)]])); });
$("dlTx").addEventListener("click", () => download("sorted-transactions.csv", Logic.toCSV([["Date", "Description", "Amount", "Line", "Line name"], ...txs.map(t => [t.date, t.desc, (t.inflow ? "" : "-") + t.amount.toFixed(2), t.line, LINES.find(l => l.id === t.line).name])])));
