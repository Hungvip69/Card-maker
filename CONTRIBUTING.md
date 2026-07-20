# Contributing to Cards Maker

Thanks for your interest! The project uses vanilla JS/CSS with no bundler, so the barrier to entry is low.

## Setup

```bash
npm install
cp .env.example .env   # fill in KLIPY_KEY if you need GIF search
npm run dev            # node --watch, auto-reloads on change
```

Open http://localhost:3000/create

## Conventions

- **Code style**: follow `.editorconfig` (2 spaces, UTF-8, LF). Match the style of surrounding files.
- **Language**: keep code and repo docs in English; variable/function names in English.
- **No new dependencies** if a few lines will do. The project deliberately stays lean (Express · better-sqlite3 · nanoid).
- **i18n**: any new user-facing string must be added to all 5 languages in `public/js/i18n.js` (vi/en/zh/ja/ko).

## Workflow

1. Fork → branch off `main` (`git checkout -b feat/your-feature`).
2. Keep commits focused; describe *what* + *why*.
3. Open a Pull Request against `main`. CI (Node 18/20/22) must be green.

## Reporting bugs

Open an issue with: reproduction steps, expected vs actual behavior, browser/OS.
