# Contributing to Shoebox

Thanks for taking a look. Shoebox is plain HTML and JavaScript with no build step.

## Setup

1. Clone the repo and run `python3 -m http.server` in the folder.
2. Open http://localhost:8000/ for the app and http://localhost:8000/eval/ for the held-out check.
3. Run `node test.js` before you open a pull request.

## Good first changes

- **Better hint phrases.** Each line in `lines.js` has a short list of example phrases. Add ones that real bank descriptions look like, then run `eval/` and say in your pull request how the numbers moved. Please don't add merchants copied from `eval/heldout.csv`, or the check stops meaning anything.
- **Bank formats.** If your bank's CSV doesn't load, add a test to `test.js` with a made-up row in the same layout and fix `parseCSV` in `logic.js`.
- **More held-out rows.** New rows for `eval/heldout.csv` are welcome, in a separate pull request from any hint changes.

## Please don't

- Commit real bank data, even redacted.
- Add anything that sends transactions off the device.
