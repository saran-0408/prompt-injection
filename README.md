# 🤖 JARVIS — Personal AI Assistant

A stunning Jarvis-like personal AI chatbot with:
- 💬 **Multi-turn chat** with memory
- 🧵 **Persistent transcript** — starting a new chat keeps earlier replies visible and separates sessions
- 🔍 **Real-time web search** (Google Search grounding)
- 🎨 **AI Image generation** on demand
- 🎙️ **Voice input** (browser Web Speech API)
- ⚡ **Streaming responses** (typewriter effect)
- 🌐 **Beautiful HUD UI** — Iron Man inspired

## Quick Start

### 1. Get your free API key
→ https://aistudio.google.com/app/apikey

### 2. Set your key
```bash
# Copy the example and fill in your key
copy .env.example .env
# Edit .env and replace: GEMINI_API_KEY=your_actual_key_here
```

### 3. Run JARVIS
```bash
npm install
npm start
```

Open: http://localhost:3000

## Usage Examples

| What you say | What happens |
|---|---|
| "What's the latest news on SpaceX?" | Web search + answer |
| "Generate a cyberpunk city at night" | AI image generation |
| "Draw a futuristic robot assistant" | AI image generation |
| "Explain quantum entanglement" | Smart answer |
| "Who won the last World Cup?" | Live web search |
| 🎙️ Click mic button | Voice-to-text input |

## File Structure
```
jarvis-bot/
├── server.js          ← Express backend (Gemini API)
├── public/
│   ├── index.html     ← HUD-styled UI
│   ├── style.css      ← Jarvis dark theme
│   └── app.js         ← Frontend logic
├── .env               ← Your API key (keep secret!)
└── package.json
```

## Tech Stack
- **Backend**: Node.js + Express
- **AI**: Google Gemini API (`@google/genai`)
- **Chat model**: `gemini-3.8-flash` + Google Search
- **Image model**: `gemini-3.1-flash-image`
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks!)

## Additional Projects

The following projects are kept in separate folders so the JARVIS app at the repository root remains unchanged:

- `eee-project/` is a React/Vite prompt-injection scanner demo. Run `npm install` and `npm run dev` from that folder.
- `prompt-wall-detector/` is a Node.js/Express rule-based detector API. Run `npm install` and `npm start` from that folder. Its API tests expect the server to be running.
- `prompt-firewall/` contains a separate backend and frontend. From that folder, run `npm run install:all`, then use `npm run start:backend` and `npm run start:frontend` in separate terminals. Run backend tests with `npm test`.

Each project has its own dependencies and configuration. The detector projects are prototypes; review their security limitations before production use.
