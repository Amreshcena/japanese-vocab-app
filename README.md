# NihonMozhi 日本文字 🇯🇵

Japanese Vocabulary & Grammar study app with English and Tamil translations, powered by Gemini AI.

**Live:** https://nihonmozhi.onrender.com

---

## Project Structure

```
nihonmozhi/
├── server.js                  # Express server — Gemini API proxy
├── package.json
├── .env.example               # Copy to .env for local dev
├── .gitignore                 # Keeps .env and node_modules out of Git
└── public/                    # Everything served to the browser
    ├── index.html             # App shell — HTML structure only
    ├── icon.jpg               # App logo
    ├── vocab.txt              # Vocabulary word list (kanji/reading)
    ├── bunpro_grammar_all_levels.txt   # Grammar points list
    ├── css/
    │   └── styles.css         # All styles
    └── js/
        ├── main.js            # App entry point, tab switching, keyboard nav
        ├── cache.js           # localStorage helpers, export/import
        ├── vocab.js           # Vocabulary tab — grid, modal, Gemini fetch
        └── grammar.js         # Grammar tab — grid, modal, Gemini fetch
```

---

## Local Development

**1. Clone and install**
```bash
git clone <your-repo-url>
cd nihonmozhi
npm install
```

**2. Set up your API key**
```bash
cp .env.example .env
# Edit .env and add your real Gemini key
```
Get a free key at: https://aistudio.google.com/apikey

**3. Run**
```bash
npm run dev     # auto-restarts on file changes (Node 18+)
# or
npm start       # standard
```

Open http://localhost:3000

---

## Deploying to Render

### First time setup
1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment:** Node

### Set your API key (IMPORTANT)
In Render dashboard → your service → **Environment**:
- Key: `GEMINI_API_KEY`
- Value: your Gemini API key

**Never put your real API key in `.env` and commit it.** The `.gitignore` prevents this, but double-check.

### Updating the live site
```bash
git add .
git commit -m "your message"
git push
```
Render auto-deploys on every push to main.

---

## Adding Vocabulary / Grammar

- **Vocab:** Edit `public/vocab.txt` — one word per line, format: `漢字/よみかた`
- **Grammar:** Edit `public/bunpro_grammar_all_levels.txt` — one grammar point per line

---

## Tech Stack

| Layer | Tech |
|---|---|
| Server | Node.js + Express |
| AI | Google Gemini 2.5 Flash Lite |
| Frontend | Vanilla JS (ES Modules) |
| Styling | Pure CSS with CSS variables |
| Hosting | Render |
| Cache | Browser localStorage |
