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
    const out = rows.slice(hasHead ? 1 : 0).map((r, i) => {
      const raw = parseFloat(String(r[ai] || "0").replace(/[$,\s]/g, "")) || 0;
      return { id: i + 1, date: (r[di] || "").trim(), desc: (r[si] || "").trim(), amount: Math.abs(raw), raw };
    }).filter(t => t.desc);
    // If the file mixes signs, the positive rows are money coming in.
    const mixed = out.some(t => t.raw < 0) && out.some(t => t.raw > 0);
    out.forEach(t => { t.inflow = mixed && t.raw > 0; });
    return out;
  }
  // "TIM HORTONS #4521 TORONTO ON" -> "tim hortons"
  function merchant(desc) {
    return desc.toLowerCase().replace(/[#*].*$/, "").replace(/\b\d[\d-]*\b/g, "").replace(/\b(on|qc|bc|ab|mb|sk|ns|nb|nl|pe|toronto|ottawa|montreal|vancouver|calgary|mississauga|inc|ltd|ca|com|www)\b/g, "")
      .replace(/[^a-z& ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
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
  // Totals by line. Meals count at 50%.
  function totals(txs, lines) {
    const out = lines.filter(l => l.id !== "income").map(l => ({ id: l.id, name: l.name, spent: 0, claim: 0, n: 0 }));
    for (const t of txs) {
      const o = out.find(x => x.id === t.line); if (!o) continue;
      o.spent += t.amount; o.n++;
    }
    for (const o of out) { const l = lines.find(x => x.id === o.id); o.claim = o.id === "personal" ? 0 : Math.round(o.spent * (l.share || 1) * 100) / 100; o.spent = Math.round(o.spent * 100) / 100; }
    const deductible = out.filter(o => o.id !== "personal").reduce((s, o) => s + o.claim, 0);
    return { byLine: out, deductible: Math.round(deductible * 100) / 100 };
  }
  function toCSV(rows) { return rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(",")).join("\n"); }
  const api = { parseCSV, merchant, classify, totals, toCSV, dot };
  if (typeof module !== "undefined") module.exports = api; else root.Logic = api;
})(this);
