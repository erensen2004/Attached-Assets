import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { cvText } = req.body;

    if (!cvText || !cvText.trim()) {
      res.status(400).json({ error: "Bad Request", message: "cvText required" });
      return;
    }

    const apiKey = process.env.REPLIT_AI_TOKEN || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "Service Unavailable", message: "AI service not configured" });
      return;
    }

    const client = new OpenAI({
      apiKey,
      baseURL: process.env.REPLIT_AI_TOKEN ? "https://ai.replit.com" : undefined,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a CV parser. Extract structured data from CVs and return ONLY valid JSON with these fields:
{
  "firstName": string,
  "lastName": string,
  "email": string,
  "phone": string or null,
  "skills": string (comma-separated skill list),
  "expectedSalary": number or null
}
Return only the JSON object, no markdown or extra text.`,
        },
        {
          role: "user",
          content: `Parse this CV:\n\n${cvText.slice(0, 4000)}`,
        },
      ],
      temperature: 0.1,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    res.json(parsed);
  } catch (err) {
    console.error("CV parse error:", err);
    res.status(500).json({ error: "Internal Server Error", message: "CV parsing failed" });
  }
});

export default router;
