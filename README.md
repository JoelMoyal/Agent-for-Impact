# VaxAgent

AI co-pilot for personalized cancer vaccine design. Upload a genomic report, chat with Nemotron, get a vaccine design brief grounded in live literature.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your API keys, then:
npm run dev
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel
# Add env vars in Vercel dashboard: OPENROUTER_API_KEY, TAVILY_API_KEY
```

## API Keys needed
- **OpenRouter** (free): https://openrouter.ai — model: `nvidia/llama-3.1-nemotron-70b-instruct`
- **Tavily** (free tier): https://tavily.com — for live PubMed/ClinVar search

## Architecture
- `/app/page.jsx` — React UI (upload, chat, findings panel, brief)
- `/app/api/chat/route.js` — streaming chat + Tavily MCP search + Nemotron
- `/app/api/extract/route.js` — extract structured findings from document
- `/app/api/brief/route.js` — generate structured vaccine design brief
- `/lib/prompts.js` — all system prompts
