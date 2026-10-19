# Report Checker IQ V7.1

Based on the actual uploaded V7 project, preserving admin `/stats`, `/broadcast`, `/stop`, `/subscribe`, channel membership verification, and PDF/DOCX readers.

## Setup (Windows PowerShell)

1. Back up the existing project and the `data` directory. **Do not replace `.env` or `data/bot.sqlite`.**
2. Copy `src`, `package.json`, `package-lock.json`, `tsconfig.json` and `.gitignore` into the project.
3. Run `npm install` and `npm run check`.
4. Run `npm start` (stop any other polling bot instance).
5. In Telegram: `/start` -> set requirements -> upload PDF or DOCX -> choose exactly one check -> run another check on same file if desired.

## Accuracy and privacy

- Cover: labels plus candidate values; every detection is a review suggestion, not proof.
- References: count only recognizable numbered or author-year entries, otherwise report unknown. DOI and URLs are extracted, **not verified online**.
- PDF formatting: A4 dimensions can be checked; fonts/spacing are preliminary.
- DOCX formatting: default style only, not a whole-document audit.
- Score: only confirmed checked criteria count; unclear checks are excluded and displayed as pending. This is not an academic grade.
- AI: explicitly opt-in per document; sends up to 14,000 characters to the configured external AI API. Disable by omitting OPENAI_API_KEY.
- Files are held in process memory for up to 20 minutes of inactivity, not saved to disk. Avoid sensitive documents.
- SQLite is kept at `data/bot.sqlite`; back it up and use persistent storage in hosting.
- `/broadcast` is admin-only and requires preview/confirmation.

## Notes

The old `checkPDF` and `formatChecker` remain unchanged. This is a code update, not a claim of academic accuracy. Test on real reports, especially scanned PDFs and nonstandard DOCX covers.
