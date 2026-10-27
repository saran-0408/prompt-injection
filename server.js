
const express = require("express");
const rateLimit = require("express-rate-limit");
const { detectPrompt } = require("./detector");

const app = express();
const PORT = 3001;

app.use(express.json({ limit: "10kb" }));

const detectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 200, // Allow evaluation and normal request bursts without blocking legitimate checks.
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again in a minute.",
  },
});

app.use("/detect", detectionLimiter);

app.get("/health", (req, res) => {
  res.json({
    status: "running",
    service: "Prompt Firewall Detection API",
  });
});


app.post("/detect", (req, res) => {
  const body = req.body;

  // Check that the request body is a JSON object
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "Request body must be a JSON object.",
    });
  }

  const { prompt } = body;

  // Check that prompt is a non-empty string
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({
      error: "Please provide a non-empty prompt string.",
    });
  }

  // Prevent excessively long prompts
  if (prompt.length > 5000) {
    return res.status(413).json({
      error: "Prompt is too long. Maximum length is 5000 characters.",
    });
  }

  try {
    const result = detectPrompt(prompt);
    return res.json(result);
  } catch (error) {
    console.error("Detection failed:", error.message);

    return res.status(500).json({
      error: "Prompt detection failed. Please try again.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Prompt Firewall API running on port ${PORT}`);
});
