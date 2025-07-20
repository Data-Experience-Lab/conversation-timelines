// server.js (CommonJS version)
const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fetch = require("node-fetch");
const cors = require("cors");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

// OpenAI Proxy Route
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Received /api/chat with body:", req.body);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    console.log("OpenAI status:", response.status);
    console.log("OpenAI response:", data);

    res.status(response.status).json(data);
  } catch (err) {
    console.error("OpenAI API error:", err);
    res.status(500).json({ error: "Failed to call OpenAI API" });
  }
});

// Azure Speech Config Route (returns region only)
app.get("/api/speech-config", (req, res) => {
  const region = process.env.AZURE_REGION;

  if (!region) {
    return res.status(500).json({ error: "Azure region not set" });
  }

  res.json({ region });
});

// Azure Token Route
app.post("/api/speech-token", async (req, res) => {
  try {
    const region = process.env.AZURE_REGION;
    const key = process.env.AZURE_API_KEY;

    const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Length": "0",
      }
    });

    const token = await response.text();
    res.status(200).json({ token, region });
  } catch (err) {
    console.error("Azure Speech error:", err);
    res.status(500).json({ error: "Failed to retrieve Azure token" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
