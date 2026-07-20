# Cards Maker

[![CI](https://github.com/Hungvip69/Card-maker/actions/workflows/ci.yml/badge.svg)](https://github.com/Hungvip69/Card-maker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)

Create beautiful greeting cards, share them via a private link that auto-expires after 1/7/30 days.

## Features

- Card editor with templates, colors, fonts, effects, layouts, and frames
- Emoji stickers, draggable image stickers, free text blocks, freehand drawing
- Online GIF & sticker search via KLIPY
- Background music (YouTube/Spotify), scheduled reveal, guestbook, emoji reactions
- Secret management link: view counts, messages, extend, edit, delete
- Multi-language (vi/en/zh/ja/ko), light/dark theme

## Run

Requires Node 18+ (uses global `fetch`).

```bash
npm install
cp .env.example .env   # then fill in KLIPY_KEY
npm start
```

Open http://localhost:3000/create

## Environment variables

Copy `.env.example` to `.env` and fill in the values — `npm start` / `npm run dev` load it automatically (via Node's `--env-file-if-exists`, no `dotenv` needed).

Get a free `KLIPY_KEY` at https://partner.klipy.com — without it the GIF search returns 503, everything else still works.

## Tech

Express · better-sqlite3 · nanoid · vanilla JS/CSS (no bundler)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — free to use, just keep the copyright notice.
