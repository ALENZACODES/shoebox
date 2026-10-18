(function (root) {
  // Parse a bank CSV. Finds date, description and amount columns by header, or uses the first three columns.
  function parseCSV(text) {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some(x => x.trim() !== "")) rows.push(row); row = []; }
      else f += c;
    }
    row.push(f); if (row.some(x => x.trim() !== "")) rows.push(row);
    if (!rows.length) return [];
    const head = rows[0].map(h => h.trim().toLowerCase());
    const find = re => head.findIndex(h => re.test(h));
    let di = find(/date/), si = find(/desc|merchant|payee|details|memo|name/), ai = find(/amount|debit|withdrawal/);
    const hasHead = di >= 0 || si >= 0 || ai >= 0;
    if (di < 0) di = 0; if (si < 0) si = 1; if (ai < 0) ai = 2;
    // Some banks (TD, for one) export separate withdrawal and deposit columns instead of one signed amount.
    const ci = hasHead ? find(/credit|deposit/) : -1;
    const num = v => parseFloat(String(v || "").replace(/[$,\s]/g, ""));
    const twoCol = (ci >= 0 && ci !== ai) || (!hasHead && rows.every(r => r.length >= 4 && (isNaN(num(r[2])) || isNaN(num(r[3])))) && rows.some(r => !isNaN(num(r[3]))));
    const out = rows.slice(hasHead ? 1 : 0).map((r, i) => {
      let raw;
      if (twoCol) { const c = hasHead ? ci : 3; raw = (num(r[c]) || 0) - (num(r[ai]) || 0); }
      else raw = num(r[ai]) || 0;
      return { id: i + 1, date: (r[di] || "").trim(), desc: (r[si] || "").trim(), amount: Math.round(Math.abs(raw) * 100) / 100, raw };
    }).filter(t => t.desc && t.raw !== 0);
    // Which sign is spending? If the file mixes signs, assume negatives are spending unless most rows are positive
    // (some credit card exports show charges as positive numbers). The app shows the guess and lets you flip it.
    const neg = out.filter(t => t.raw < 0).length, pos = out.length - neg;
    const spend = twoCol || neg >= pos ? "negative" : "positive";
    setSpend(out, neg && pos ? spend : "all");
    out.spend = neg && pos ? spend : "all";
    return out;
  }
  function setSpend(txs, spend) {
    txs.forEach(t => { t.inflow = spend === "all" ? false : spend === "negative" ? t.raw > 0 : t.raw < 0; });
    txs.spend = spend;
  }
  // A money-in row that says refund, return or reversal goes back against the merchant's line instead of income.
  const isRefund = desc => /\b(refund|return|reversal|rebate|credit adj)/i.test(desc);
  // "TIM HORTONS #4521 TORONTO ON" -> "tim hortons"
  function merchant(desc) {
    return desc.toLowerCase().replace(/[#*].*$/, "").replace(/\b\d[\d-]*\b/g, "").replace(/\b(on|qc|bc|ab|mb|sk|ns|nb|nl|pe|toronto|ottawa|montreal|vancouver|calgary|mississauga|inc|ltd|ca|com|www)\b/g, "")
      .replace(/[^a-z& ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
  }
  // Strip store numbers, reference codes and place names before embedding, so "MARRIOTT MONTREAL" and "BISTRO MONTREAL" don't look alike.
  const PLACES = /\b(toronto|ottawa|montreal|vancouver|calgary|edmonton|winnipeg|halifax|mississauga|brampton|markham|hamilton|london|quebec|on|qc|bc|ab|mb|sk|ns|nb|nl|pe|canada|ca)\b/gi;
  const clean = d => d.replace(/[#*]\s?\w*\d\w*/g, " ").replace(/\b\w*\d\w*\b/g, " ").replace(/[*#.]/g, " ").replace(PLACES, " ").replace(/\s+/g, " ").trim() || d;
  /* Keyword baseline, for comparison only: the line whose hint words overlap the description most. */
  function keyword(desc, lines) {
    const words = s => new Set(s.toLowerCase().replace(/[^a-z ]+/g, " ").split(" ").filter(w => w.length > 2));
    const d = words(desc); let best = null, n = 0;
    for (const l of lines) for (const h of l.hints) { let k = 0; for (const w of words(h)) if (d.has(w)) k++; if (k > n) { n = k; best = l.id; } }
    return best;
  }
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  /* Pick a line for one transaction vector.
     protos: [{line, vec}] from the hint phrases; learned: [{line, vec}] from your own corrections (weighted up). */
  function classify(vec, protos, learned) {
    const best = {};
    for (const p of protos) { const s = dot(vec, p.vec); if (!(p.line in best) || s > best[p.line]) best[p.line] = s; }
    for (const p of learned || []) { const raw = dot(vec, p.vec); if (raw < 0.6) continue; const s = raw + 0.03; if (!(p.line in best) || s > best[p.line]) best[p.line] = s; }
    const ranked = Object.entries(best).sort((a, b) => b[1] - a[1]);
    const [line, score] = ranked[0], second = ranked[1] ? ranked[1][1] : 0;
    return { line, score, margin: score - second, sure: score > 0.45 && score - second > 0.04 };
  }
  /* Totals by line, in the order the lines appear on the form.
     Meals and entertainment are generally limited to 50%. Lines marked "partial" need a business-use percentage
     (pct[line]) before they count; until then they're left out of the total and listed in "missing". Refunds subtract. */
  const SKIP = ["income", "transfer"];
  function totals(txs, lines, pct) {
    pct = pct || {};
    const out = lines.filter(l => !SKIP.includes(l.id)).map(l => ({ id: l.id, name: l.name, spent: 0, claim: 0, n: 0, partial: !!l.partial, pct: l.partial ? pct[l.id] : 100 }));
    for (const t of txs) {
      const o = out.find(x => x.id === t.line); if (!o) continue;
      o.spent += t.refund ? -t.amount : t.amount; o.n++;
    }
    const missing = [];
    for (const o of out) {
      const l = lines.find(x => x.id === o.id);
      o.spent = Math.round(o.spent * 100) / 100;
      const p = o.partial ? (o.pct === undefined || o.pct === "" || isNaN(o.pct) ? null : Math.min(100, Math.max(0, +o.pct))) : 100;
      if (o.id === "personal") o.claim = 0;
      else if (p === null) { o.claim = null; if (o.n) missing.push(o.id); }
      else o.claim = Math.round(o.spent * (l.share || 1) * p) / 100;
    }
    const deductible = out.filter(o => o.id !== "personal" && o.claim !== null).reduce((s, o) => s + o.claim, 0);
    return { byLine: out, deductible: Math.round(deductible * 100) / 100, missing };
  }
  function toCSV(rows) { return rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(",")).join("\n"); }
  const api = { clean, keyword, parseCSV, setSpend, isRefund, merchant, classify, totals, toCSV, dot, SKIP };
  if (typeof module !== "undefined") module.exports = api; else root.Logic = api;
})(this);
