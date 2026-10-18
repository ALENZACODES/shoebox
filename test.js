const assert = require("assert"); const L = require("./logic.js"); const LINES = require("./lines.js");
const t = L.parseCSV('Date,Description,Amount\n2026-09-02,"TIM HORTONS #4521 TORONTO ON",-4.35\n2026-09-03,"Adobe, Inc. *Creative Cloud",-29.99\r\n\n2026-09-04,STAPLES #112,"-1,204.50"\n');
assert.strictEqual(t.length, 3); assert.ok(!t[0].inflow);
assert.ok(L.parseCSV("Date,Description,Amount\n2026-01-01,Client,500\n2026-01-02,Rogers,-90\n")[0].inflow); assert.strictEqual(t[1].desc, "Adobe, Inc. *Creative Cloud"); assert.strictEqual(t[2].amount, 1204.5); assert.strictEqual(t[0].amount, 4.35);
assert.strictEqual(L.parseCSV("2026-01-01,Rogers,90\n")[0].desc, "Rogers"); // no header row
assert.strictEqual(L.merchant("TIM HORTONS #4521 TORONTO ON"), "tim hortons");
assert.strictEqual(L.merchant("PETRO-CANADA 12345 MISSISSAUGA"), "petro canada");
// classify: a learned example beats a slightly closer hint
const protos = [{ line: "8523", vec: [1, 0] }, { line: "8810", vec: [0, 1] }];
assert.strictEqual(L.classify([0.9, 0.1], protos).line, "8523");
assert.strictEqual(L.classify([0.62, 0.6], protos, [{ line: "8810", vec: [0.6, 0.62] }]).line, "8810");
// a learned example that isn't close enough is ignored
assert.strictEqual(L.classify([0.9, 0.1], protos, [{ line: "8810", vec: [0.5, 0.5] }]).line, "8523");
// totals: meals at 50%, personal not deductible, income skipped
const tot = L.totals([{ line: "8523", amount: 100 }, { line: "8810", amount: 30 }, { line: "personal", amount: 500 }, { line: "income", amount: 2000 }], LINES);
assert.strictEqual(tot.deductible, 80);
assert.strictEqual(tot.byLine.find(x => x.id === "personal").claim, 0);
assert.ok(!tot.byLine.find(x => x.id === "income"));
assert.strictEqual(L.toCSV([["a,b", 'say "hi"', 3]]), '"a,b","say ""hi""",3');
LINES.forEach(l => assert.ok(l.id && l.name && l.hints.length >= 3, l.id));
// partial lines need a business-use % before they count
const p0 = L.totals([{ line: "9220", amount: 100 }, { line: "8810", amount: 30 }], LINES);
assert.strictEqual(p0.deductible, 30); assert.deepStrictEqual(p0.missing, ["9220"]); assert.strictEqual(p0.byLine.find(x => x.id === "9220").claim, null);
const p1 = L.totals([{ line: "9220", amount: 100 }, { line: "9281", amount: 50 }], LINES, { 9220: 40, 9281: 0 });
assert.strictEqual(p1.deductible, 40); assert.deepStrictEqual(p1.missing, []);
// refunds subtract from their line; transfers don't count
const rf = L.totals([{ line: "8811", amount: 60 }, { line: "8811", amount: 15, refund: true }, { line: "transfer", amount: 900 }], LINES);
assert.strictEqual(rf.deductible, 45); assert.ok(!rf.byLine.find(x => x.id === "transfer"));
assert.ok(L.isRefund("STAPLES #112 REFUND")); assert.ok(L.isRefund("AMAZON.CA RETURN")); assert.ok(!L.isRefund("STAPLES #112"));
// sign detection: charges shown as positives on a card export
const cc = L.parseCSV("Date,Description,Amount\n2026-01-01,Esso,40\n2026-01-02,Staples,12\n2026-01-03,PAYMENT THANK YOU,-52\n");
assert.strictEqual(cc.spend, "positive"); assert.ok(!cc[0].inflow); assert.ok(cc[2].inflow);
L.setSpend(cc, "negative"); assert.ok(cc[0].inflow); assert.ok(!cc[2].inflow);
// all one sign: everything is spending
assert.strictEqual(L.parseCSV("2026-01-01,Rogers,90\n2026-01-02,Bell,40\n").spend, "all");
// TD-style export with no header and separate withdrawal and deposit columns
const td = L.parseCSV("09/02/2026,ROGERS,95.00,,1200.00\n09/03/2026,E-TRANSFER CLIENT,,500.00,1700.00\n");
assert.strictEqual(td.length, 2); assert.ok(!td[0].inflow); assert.ok(td[1].inflow); assert.strictEqual(td[1].amount, 500);
// header style with Withdrawal and Deposit columns
const wd = L.parseCSV("Date,Description,Withdrawal,Deposit\n2026-01-01,Bell,40.00,\n2026-01-02,Client,,800\n");
assert.ok(!wd[0].inflow); assert.ok(wd[1].inflow); assert.strictEqual(wd[0].amount, 40);
// lines are in the form's order and line numbers are real T2125 lines
assert.deepStrictEqual(LINES.filter(l => /^\d+$/.test(l.id)).map(l => l.id), ["8521", "8523", "8690", "8710", "8760", "8810", "8811", "8860", "8910", "8960", "9200", "9220", "9275", "9281", "9270"]);
assert.strictEqual(L.clean("MARRIOTT MONTREAL"), "MARRIOTT"); assert.strictEqual(L.clean("TIM HORTONS #4521 TORONTO ON"), "TIM HORTONS");
assert.strictEqual(L.keyword("TIM HORTONS #4521", LINES), "8523"); assert.strictEqual(L.keyword("ZZZ", LINES), null);
console.log("all tests pass");
