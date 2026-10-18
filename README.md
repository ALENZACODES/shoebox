# Shoebox

Sort a year of bank transactions into Form T2125 expense lines without sending them anywhere.

Live demo: https://alenzacodes.github.io/shoebox/

Shoebox is for Canadian freelancers and sole proprietors who reach tax season with a bank export and no bookkeeping. Drop in a CSV from any bank. Each transaction is matched to the closest T2125 expense line by a small open-weight sentence model that runs in your browser tab. Rows the model isn't sure about are flagged. Fix one and Shoebox learns that merchant and moves the rest of its rows. When you're done you get a total for each line and two CSV downloads.

Your statement never leaves your computer. There's no server, no account and no upload. The model (about 23 MB) is downloaded once from Hugging Face and cached by the browser.

## How it works

1. **Read.** `logic.js` parses the CSV, finds the date, description and amount columns, and works out whether money in or money out is the expense side.
2. **Embed.** Each description is cleaned (store numbers, reference codes and city names removed) and turned into a 384-number vector by [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) through [Transformers.js](https://github.com/huggingface/transformers.js).
3. **Match.** Every expense line in `lines.js` has a few example phrases. A row goes to the line with the closest example. If the best score is low, or the top two lines are close, the row is flagged.
4. **Learn.** A correction becomes a new example for close matches, every row from the same merchant is moved, and the merchant is saved in `localStorage` so it's sorted correctly next time.

Meals and entertainment count at 50%, as CRA requires. Rows marked personal count as $0, and deposits are skipped.

On the 32-row sample statement, 30 rows land on the right line the first time. Three rows are flagged for a look, and both mistakes are among them, so fixing the sample takes two clicks.

## What it won't do

It doesn't know your business. A Staples run could be supplies or a desk, which is a capital purchase. A phone or internet bill is usually only partly business. Shoebox doesn't split GST/HST, handle input tax credits, business-use-of-home or capital cost allowance. Treat it as a first sort that you check, not a tax return.

## Run it

It's a static site. Serve the folder with any web server, for example `python3 -m http.server`, and open it. Tests for the parser, classifier and totals run with `node test.js`.

## Sources

- [CRA, Expenses section of Form T2125](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/completing-form-t2125/expenses-section-form-t2125.html), for the line numbers.
- [CRA Guide T4002, Chapter 3](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4002/t4002-5.html), for the 50% limit on meals and entertainment.

`sample.csv` is made up. Any resemblance to a real person's spending is a coincidence.

## Licence

MIT. See [LICENSE](LICENSE).
