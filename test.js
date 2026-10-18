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
console.log("all tests pass");
