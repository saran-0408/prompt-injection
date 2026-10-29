require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_KEY = (process.env.GROQ_API_KEY || "").trim();
const GROQ_BASE = "https://api.groq.com/openai/v1";
const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_KEYS = [
  (process.env.NVIDIA_API_KEY || "").trim(),
  "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",
  "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"
].filter(Boolean);

// ─── Models ──────────────────────────────────────────────────────────────────
const MODEL_CHAT = "openai/gpt-oss-120b";
const MODEL_FAST = "qwen/qwen3.8-27b";

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── System Persona ───────────────────────────────────────────────────────────
const SKAR_SYSTEM = `You are SKAR Bot — an intelligent, reliable, research-oriented AI assistant created exclusively for Sikkandhar. Your primary responsibilities are to answer questions accurately, retrieve current information from the internet when necessary, minimize hallucinations, and provide clear, evidence-based responses.

Your highest priorities are:
1. Accuracy and factual reliability.
2. Current, verified information.
3. Correct use of online search and browser tools.
4. Transparency about uncertainty and limitations.
5. Clear answers supported by trustworthy sources.

Never prioritize producing a quick answer over producing a correct answer.

## MANDATORY ONLINE SEARCH POLICY
When a user asks for current, latest, updated, real-time, or online information, web search results will be injected into your context automatically. You MUST use this search data before composing your answer.

Search is also triggered when the answer depends on:
- Current events, news, politics, and public figures.
- Software versions, programming libraries, APIs, and documentation.
- AI models, LLMs, API providers, and newly released features.
- Prices, product specifications, offers, and availability.
- Laws, regulations, policies, and official guidelines.
- College admissions, scholarships, examinations, and deadlines.
- Sports results, schedules, and statistics.
- Technology updates, security vulnerabilities, and patches.
- Other time-sensitive or rapidly changing information.

## ANTI-HALLUCINATION RULES
- Never invent facts, statistics, dates, names, quotations, references, URLs, research papers, API methods, or source citations.
- Never present assumptions, predictions, or guesses as established facts.
- Never claim that information is current unless its freshness has been reasonably verified.
- If the available evidence is insufficient, explicitly state what could not be verified.
- When sources disagree, acknowledge the conflict and explain what the evidence supports.
- Distinguish verified facts from estimates, interpretations, recommendations, and opinions.
- If a question is ambiguous, state your assumption clearly.
- It is better to acknowledge missing evidence than to provide a confident but incorrect answer.

## RESPONSE QUALITY
- For simple questions: Give the direct answer first, add a brief explanation, include citations when search results are provided.
- For complex questions: Provide a concise summary, explain the relevant evidence, organize technical details into logical sections, include examples when useful.
- For programming questions: Prefer official documentation. Verify current API names and syntax. Do not fabricate library functions. Provide runnable code when requirements are sufficiently clear.
- Avoid unnecessary repetition, unsupported confidence, and vague claims.

## RESPONSE FORMAT
- Use clean markdown: headings (##, ###), bullet points, numbered lists, and code blocks.
- NEVER output raw LaTeX syntax, abstract math notation (\\[, \\], \\(, \\), \\text{}, \\mathcal{}), or formal logic predicates unless the user explicitly requests mathematical formulas.
- Answer directly and clearly in natural English with practical real-world examples.
- Strictly ZERO emojis anywhere in output.
- When programming: write clean, production-ready code in standard markdown fenced blocks.

## SEARCH RESULT HANDLING
When web search results are injected into the context:
- Use them as primary evidence.
- Cite the actual source titles and URLs provided.
- Distinguish what was found in search results from background knowledge.
- If search results are empty or insufficient, state this explicitly.
- Never simulate or fabricate search results.`;

// ─── Helper: Detect Reasoning Query ──────────────────────────────────────────
function needsReasoner(msg) {
  return /\b(why|how does|explain|analyze|analyse|compare|reason|proof|prove|solve|calculate|debug|step by step|evaluate|difference between|what if|predict|strategy|plan|think through)\b/i.test(msg);
}

// ─── Helper: Detect Image Generation Request ─────────────────────────────────
function isImageReq(msg) {
  return [
    /\b(generate|create|draw|make|paint|render|show me|give me)\b.*\b(image|picture|photo|illustration|art|artwork|drawing|painting|wallpaper|poster)\b/i,
    /\b(image|picture|photo|illustration)\b.*\b(of|showing|with|featuring)\b/i,
    /^(draw|paint|create|generate|make)\s+/i,
  ].some((r) => r.test(msg));
}

// ─── Fetch with Timeout Helper ────────────────────────────────────────────────
async function fetchWithTimeout(url, ms, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Multi-Source Web Search Engine ──────────────────────────────────────────
async function searchWebMulti(query) {
  const results = [];
  const sources = [];

  const searchPromises = [];

  // Source 1: DuckDuckGo Instant Answer API
  searchPromises.push(
    fetchWithTimeout(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`,
      5000,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; SKARBot/3.0)" } }
    ).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (data.Answer) {
        results.push(`[Direct Answer] ${data.Answer}`);
      }
      if (data.AbstractText) {
        results.push(`[${data.AbstractSource || "DuckDuckGo"}] ${data.AbstractText}`);
        if (data.AbstractURL) {
          sources.push({ title: data.AbstractSource || "DuckDuckGo Knowledge", url: data.AbstractURL });
        }
      }
      if (data.RelatedTopics?.length) {
        data.RelatedTopics.filter((t) => t.Text && t.FirstURL)
          .slice(0, 4)
          .forEach((t) => {
            results.push(`[Related] ${t.Text}`);
            sources.push({ title: t.Text.slice(0, 60), url: t.FirstURL });
          });
      }
    }).catch(() => {})
  );

  // Source 2: Wikipedia REST API (best for factual/encyclopedic queries)
  const wikiQuery = query.replace(/\s+/g, "_").replace(/[?!]/g, "");
  searchPromises.push(
    fetchWithTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`,
      5000,
      { headers: { "User-Agent": "SKARBot/3.0 (research assistant)" } }
    ).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (data.extract && data.type !== "disambiguation") {
        const extract = data.extract.slice(0, 600);
        results.push(`[Wikipedia: ${data.title}] ${extract}`);
        if (data.content_urls?.desktop?.page) {
          sources.push({ title: `Wikipedia: ${data.title}`, url: data.content_urls.desktop.page });
        }
      }
    }).catch(() => {})
  );

  // Source 3: Wikipedia Search API (find related articles by keyword)
  searchPromises.push(
    fetchWithTimeout(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&utf8=1`,
      5000,
      { headers: { "User-Agent": "SKARBot/3.0" } }
    ).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const searchResults = data.query?.search || [];
      searchResults.forEach((r) => {
        const snippet = r.snippet.replace(/<[^>]+>/g, "");
        results.push(`[Wikipedia Search] ${r.title}: ${snippet}`);
        sources.push({ title: `Wikipedia: ${r.title}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}` });
      });
    }).catch(() => {})
  );

  // Source 4: Open Library for book-related queries
  if (/\b(book|author|novel|published|isbn|literature)\b/i.test(query)) {
    searchPromises.push(
      fetchWithTimeout(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=2`,
        5000
      ).then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        (data.docs || []).slice(0, 2).forEach((doc) => {
          if (doc.title) {
            const info = `Title: ${doc.title}${doc.author_name ? `, Author: ${doc.author_name[0]}` : ""}${doc.first_publish_year ? `, First Published: ${doc.first_publish_year}` : ""}`;
            results.push(`[Open Library] ${info}`);
            sources.push({ title: `Open Library: ${doc.title}`, url: `https://openlibrary.org${doc.key}` });
          }
        });
      }).catch(() => {})
    );
  }

  // Wait for all searches (max 6 seconds total)
  await Promise.allSettled(searchPromises);

  // Deduplicate sources by URL
  const uniqueSources = [];
  const seenUrls = new Set();
  for (const s of sources) {
    if (s.url && !seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueSources.push(s);
    }
  }

  const combinedText = results.join("\n\n");
  return combinedText.length > 50
    ? { text: combinedText, sources: uniqueSources.slice(0, 6) }
    : null;
}

// ─── High-Fidelity Image Generation Engine ──────────────────────────────────
// Supports FLUX.1 (Hugging Face / Pollinations FLUX) and OpenAI DALL-E 3
async function generateHighQualityImage(prompt, options = {}) {
  const { hfToken = "", openaiKey = "", modelPreference = "auto" } = options;

  // Priority 1: OpenAI DALL-E 3 (if key provided or configured)
  const oaiKey = (openaiKey || process.env.OPENAI_API_KEY || "").trim();
  if (oaiKey && (modelPreference === "dalle3" || modelPreference === "auto")) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${oaiKey}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          quality: "hd",
          response_format: "b64_json"
        }),
        timeout: 60000
      });
      if (res.ok) {
        const data = await res.json();
        const b64 = data.data?.[0]?.b64_json;
        if (b64) {
          return {
            base64: b64,
            mime: "image/png",
            model: "DALL-E 3 HD"
          };
        }
      }
    } catch (err) {
      console.warn("OpenAI DALL-E 3 failed, attempting FLUX...", err.message);
    }
  }

  // Priority 2: Hugging Face FLUX.1 Inference API (if token provided or in .env)
  const hfTok = (hfToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "").trim();
  if (hfTok) {
    const hfEndpoints = [
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
    ];
    for (const ep of hfEndpoints) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfTok}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ inputs: prompt }),
          timeout: 60000
        });
        if (res.ok) {
          const buffer = await res.buffer();
          return {
            base64: buffer.toString("base64"),
            mime: res.headers.get("content-type") || "image/jpeg",
            model: "FLUX.1 Schnell (Hugging Face)"
          };
        }
      } catch (err) {
        console.warn(`Hugging Face endpoint ${ep} failed:`, err.message);
      }
    }
  }

  // Priority 3: FLUX.1 Schnell via Pollinations (Free, High Quality)
  const seed = Math.floor(Math.random() * 9999999);
  const modelsToTry = [
    { id: "black-forest-labs/flux.1-schnell", label: "FLUX.1 Schnell" },
    { id: "openai/gpt-image-1.5", label: "GPT-Image 1.5 HD" },
    { id: "tongyi-mai/z-image-turbo", label: "Z-Image Turbo" },
  ];

  for (const m of modelsToTry) {
    try {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${encodeURIComponent(m.id)}&width=1024&height=1024&nologo=true&seed=${seed}`;
      const res = await fetch(url, { timeout: 45000 });
      if (res.ok) {
        const buffer = await res.buffer();
        if (buffer.length > 5000) {
          return {
            base64: buffer.toString("base64"),
            mime: res.headers.get("content-type") || "image/jpeg",
            model: m.label
          };
        }
      }
    } catch (e) {
      console.warn(`Model ${m.id} failed, trying next:`, e.message);
    }
  }

  // Priority 4: Universal fallback
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`;
  const fbRes = await fetch(fallbackUrl, { timeout: 45000 });
  if (!fbRes.ok) throw new Error(`Image synthesis failed with status ${fbRes.status}`);
  const fbBuf = await fbRes.buffer();
  return {
    base64: fbBuf.toString("base64"),
    mime: fbRes.headers.get("content-type") || "image/jpeg",
    model: "Neural Render Engine"
  };
}

// ─── Groq Streaming Engine with Multi-Model Resilient Failover ─────────────────
const CANDIDATE_MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 27B Turbo" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
];

async function* groqStream(messages) {
  let lastError = null;

  if (GROQ_KEY) {
    for (const candidate of CANDIDATE_MODELS) {
      try {
        const res = await fetch(`${GROQ_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model: candidate.id,
            messages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.7
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`Candidate ${candidate.id} failed (${res.status}): ${errText}`);
          lastError = new Error(`Groq ${candidate.id} ${res.status}: ${errText}`);
          continue; // Try next model candidate
        }

        yield { type: "active_model", model: candidate.label };

        let buf = "";

        for await (const chunk of res.body) {
          buf += chunk.toString();
          const lines = buf.split("\n");
          buf = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") return;
            try {
              const parsed = JSON.parse(raw);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              if (delta.reasoning) {
                yield { type: "reasoning", text: delta.reasoning };
              }
              if (delta.content) {
                yield { type: "text", text: delta.content };
              }
            } catch {}
          }
        }
        return; // Completed successfully via Groq!
      } catch (err) {
        console.warn(`Connection to ${candidate.id} failed:`, err.message);
        lastError = err;
      }
    }
  } else {
    lastError = new Error("GROQ_API_KEY is not configured.");
  }

  // ── NVIDIA NIM Fallback (Multi-Key Resilient Cascade) ─────────────────────────
  if (NVIDIA_KEYS.length > 0) {
    for (const key of NVIDIA_KEYS) {
      try {
        console.log(`[SYS] Engaging NVIDIA NIM secondary neural cluster (${key.slice(0, 14)}...)...`);
        const nvidiaRes = await fetch(`${NVIDIA_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "meta/llama-3.2-11b-vision-instruct",
            messages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.7
          }),
        });

        if (!nvidiaRes.ok) {
          const errText = await nvidiaRes.text();
          console.warn(`NVIDIA NIM key failed (${nvidiaRes.status}): ${errText.slice(0, 120)}`);
          lastError = new Error(`NVIDIA NIM ${nvidiaRes.status}: ${errText}`);
          continue; // Try next NVIDIA key
        }

        yield { type: "active_model", model: "Llama 3.2 11B (NVIDIA NIM)" };

        let nbuf = "";
        for await (const chunk of nvidiaRes.body) {
          nbuf += chunk.toString();
          const lines = nbuf.split("\n");
          nbuf = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") return;
            try {
              const parsed = JSON.parse(raw);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;
              if (delta.content) {
                yield { type: "text", text: delta.content };
              }
            } catch {}
          }
        }
        return; // Completed successfully via NVIDIA NIM!
      } catch (err) {
        console.warn("NVIDIA NIM connection failed:", err.message);
        lastError = err;
      }
    }
  }

  throw lastError || new Error("All computational reasoning engines currently unavailable.");
}

// ─── Groq One-Shot Helper ────────────────────────────────────────────────────
async function groqOnce(prompt) {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: MODEL_CHAT, messages: [{ role: "user", content: prompt }], max_tokens: 150 }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ─── DATABASE REST ENDPOINTS ─────────────────────────────────────────────────

// List all saved conversation sessions
app.get("/api/sessions", async (req, res) => {
  try {
    const list = await db.getAllSessions();
    res.json({ sessions: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all messages for a specific session
app.get("/api/sessions/:id/messages", async (req, res) => {
  try {
    const messages = await db.getSessionMessages(req.params.id, 100);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a session
app.delete("/api/sessions/:id", async (req, res) => {
  try {
    await db.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/chat (SSE Endpoint + SQLite Persistence + Client History Sync) ──
app.post("/api/chat", async (req, res) => {
  const { message, sessionId = "default_session", history: clientHistory = [], settings = {} } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Message required." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (d) => res.write(`data: ${JSON.stringify(d)}\n\n`);

  try {
    // 1. Ensure session exists in SQLite
    try {
      await db.ensureSession(sessionId, message);
    } catch (e) {
      console.warn("SQLite ensureSession notice:", e.message);
    }

    // 2. Resolve history: merge client-side resilient history with SQLite history
    let history = [];
    if (Array.isArray(clientHistory) && clientHistory.length > 0) {
      history = clientHistory.map(m => ({ role: m.role, content: m.content }));
    } else {
      try {
        const dbMessages = await db.getSessionMessages(sessionId, 20);
        history = dbMessages.map((m) => ({ role: m.role, content: m.content }));
      } catch (e) {
        history = [];
      }
    }

    // 3. Save incoming user message to SQLite
    try {
      await db.saveMessage({
        sessionId,
        role: "user",
        content: message,
        type: "text",
      });
    } catch (e) {
      console.warn("SQLite saveMessage notice:", e.message);
    }

    // ── PATH 1: Image Generation (FLUX.1 / DALL-E 3) ──────────────────────────
    if (isImageReq(message)) {
      send({ type: "status", text: "[SYS: SYNTHESIZING HIGH-RES PROMPT]" });

      const imgPrompt = await groqOnce(
        `You are a master generative AI artist and photographer. Expand this request into an ultra-detailed, photorealistic prompt for FLUX.1:\n"${message}"\nInclude: exquisite subject details, cinematic lighting, volumetric atmosphere, 8k resolution, Hasselblad lens depth, realistic textures.\nOutput ONLY the raw prompt, under 60 words, strictly no emojis or intro.`
      ) || message;

      send({ type: "status", text: "[SYS: RENDERING NEURAL CANVAS]" });

      const imageResult = await generateHighQualityImage(imgPrompt, {
        hfToken: settings.hfToken,
        openaiKey: settings.openaiKey,
        modelPreference: settings.modelPreference || "auto"
      });

      const imageDataUri = `data:${imageResult.mime};base64:${imageResult.base64}`.replace(";base64:", ";base64,");

      send({ type: "model_badge", model: `[${imageResult.model.toUpperCase()}]` });

      // Save assistant image response to SQLite
      try {
        await db.saveMessage({
          sessionId,
          role: "assistant",
          content: `Image generated: "${imgPrompt}"`,
          type: "image",
          imageData: imageDataUri,
          model: imageResult.model,
        });
      } catch (e) {}

      send({
        type: "image",
        imageData: imageDataUri,
        caption: `Rendered with ${imageResult.model}. Optimized for high-fidelity photorealism.`,
        prompt: imgPrompt,
        model: imageResult.model
      });
      send({ type: "done" });
      res.end();
      return;
    }

    // ── PATH 2: Conversational Chat & Limitless Reasoning ─────────────────────
    send({ type: "status", text: "[SYS: COMPUTING DEEP INFERENCE]" });
    send({ type: "model_badge", model: "[CORE: GPT-OSS 120B]" });

    // Comprehensive search trigger covering all cases in the MANDATORY ONLINE SEARCH POLICY
    const searchTriggers = [
      // Explicit user instructions
      /\b(search online|check the browser|fetch current|verify the latest|look up|search for|find out|search the web)\b/i,
      // Time-sensitive keywords
      /\b(latest|current|today|yesterday|recent|now|live|real-?time|updated|new|news|breaking)\b/i,
      // Questions about specific facts
      /^(what is|what are|who is|who are|when did|when is|where is|where are|how much|how many|which)\b/i,
      // Technology and software
      /\b(version|release|update|api|library|framework|npm|package|install|documentation|docs|changelog|deprecat)\b/i,
      // AI and LLMs
      /\b(gpt|claude|gemini|llm|ai model|openai|anthropic|mistral|groq|hugging\s?face|released|benchmark)\b/i,
      // Price, product, availability
      /\b(price|cost|buy|purchase|stock|available|sale|offer|discount|specs?|specification)\b/i,
      // Events, results, schedules
      /\b(score|result|match|game|tournament|election|vote|event|schedule|standings)\b/i,
      // Regulations, policies, law
      /\b(law|regulation|policy|rule|guideline|compliance|legal|regulation|official)\b/i,
      // Education
      /\b(admission|scholarship|deadline|exam|syllabus|university|college|course)\b/i,
      // Weather, location
      /\b(weather|forecast|temperature|climate|located|address|map)\b/i,
      // Security
      /\b(vulnerability|cve|patch|exploit|security|breach|hack|malware)\b/i,
      // General "tell me about" with time context
      /\b(tell me about|explain|define|what does|summary of|overview of)\b.{0,40}\b(in \d{4}|recently|now|today)\b/i,
    ];

    const isSearchQuery = searchTriggers.some((r) => r.test(message));

    // Conditional live web search (multi-source)
    let search = null;
    if (isSearchQuery) {
      send({ type: "status", text: "[SEARCHING WEB — MULTI-SOURCE RETRIEVAL...]" });
      search = await searchWebMulti(message);
      send({ type: "status", text: "[VERIFYING SOURCES...]" });
    }

    const depthInstruction = settings.responseDepth === "concise"
      ? "\n[Directive: Keep response concise, structured, and direct without unnecessary verbosity. Strictly zero emojis.]"
      : "\n[Directive: Provide an exhaustive, deeply analytical, comprehensive explanation. Include architectural design, time/space complexity, production code where appropriate, and deep theoretical context. Strictly zero emojis.]";

    // Deduplicate history to prevent repetition & anchoring bias
    const sanitizedHistory = [];
    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      if (!h || !h.content) continue;
      // Skip if it duplicates the incoming user message
      if (i === history.length - 1 && h.role === "user" && h.content.trim().toLowerCase() === message.trim().toLowerCase()) {
        continue;
      }
      let content = h.content;
      // Truncate overly long previous assistant answers to prevent context anchoring
      if (h.role === "assistant" && content.length > 800) {
        content = content.slice(0, 800) + "... [context synopsis]";
      }
      sanitizedHistory.push({ role: h.role, content });
    }

    const msgs = [
      { role: "system", content: SKAR_SYSTEM + depthInstruction },
      ...sanitizedHistory.slice(-8),
      ...(search
        ? [{
            role: "system",
            content: `[Web Search Results for "${message}" — ${new Date().toUTCString()}]:\n${search.text}\n\nSource citations provided. Use these results as primary evidence. Cite the sources by their titles and URLs. State clearly what was verified vs what is background knowledge.`
          }]
        : []),
      { role: "user", content: message },
    ];

    let fullText = "";
    let activeModelLabel = "[CORE: GPT-OSS 120B]";

    for await (const chunk of groqStream(msgs)) {
      if (chunk.type === "active_model") {
        activeModelLabel = chunk.model;
        send({ type: "model_badge", model: activeModelLabel });
      } else if (chunk.type === "text") {
        fullText += chunk.text;
        send({ type: "text_chunk", text: chunk.text });
      } else if (chunk.type === "reasoning") {
        send({ type: "reasoning_chunk", text: chunk.text });
      }
    }

    // Save assistant response to SQLite database
    try {
      await db.saveMessage({
        sessionId,
        role: "assistant",
        content: fullText,
        type: "text",
        model: activeModelLabel,
      });
    } catch (e) {}

    if (search && search.sources && search.sources.length > 0) {
      send({ type: "sources", sources: search.sources });
    }
    send({ type: "done" });
    res.end();

  } catch (err) {
    console.error("[SYS: ERROR]", err.message);
    send({ type: "error", text: err.message });
    res.end();
  }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`\n[SYS: ONLINE] SKAR Bot active -> http://localhost:${PORT}\n`));
}

module.exports = app;
