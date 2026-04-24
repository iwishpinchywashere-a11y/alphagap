/**
 * translate.ts — Claude Haiku translation utility with Vercel Blob caching.
 *
 * Usage:
 *   import { translateText, translateBatch } from "@/lib/translate";
 *   const fr = await translateText("Strong bullish momentum building", "fr");
 *
 * Cache key: SHA-256(lang + text).slice(0,16)
 * Cache blob: translation-cache-{lang}.json  →  { [hash]: translatedText, ... }
 *
 * Cost estimate: Haiku input ~$0.80/M tokens, output ~$4/M tokens.
 * A 50-char signal description ≈ 15 tokens. At 4 posts/day x 20 descriptions
 * each ≈ 1600 tokens/day ≈ $0.008/day per active non-EN user. Negligible.
 */

import { put as blobPut, get as blobGet } from "@vercel/blob";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";

export type Language = "en" | "fr" | "es";

const BLOB_TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || "";

// ── Cache blob helpers ─────────────────────────────────────────────

type TranslationCache = Record<string, string>;

async function loadCache(lang: Language): Promise<TranslationCache> {
  try {
    const b = await blobGet(`translation-cache-${lang}.json`, {
      token: BLOB_TOKEN(),
      access: "private",
    });
    if (!b?.stream) return {};
    const reader = b.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as TranslationCache;
  } catch {
    return {};
  }
}

async function saveCache(lang: Language, cache: TranslationCache): Promise<void> {
  try {
    await blobPut(`translation-cache-${lang}.json`, JSON.stringify(cache), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: BLOB_TOKEN(),
    });
  } catch {
    // Non-fatal — worst case next request re-translates
  }
}

function cacheKey(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ── Claude Haiku translation ───────────────────────────────────────

const LANG_NAMES: Record<Language, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
};

let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function callHaiku(texts: string[], targetLang: Language): Promise<string[]> {
  const langName = LANG_NAMES[targetLang];
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Translate the following numbered items to ${langName}. Keep subnet names (like "SN1", "SN14", numbers, tickers, percentages, and proper nouns) unchanged. Return ONLY the translated numbered list in the same format — no explanations, no extra text.\n\n${numbered}`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const lines = raw.trim().split("\n").filter(l => /^\d+\./.test(l));
  return lines.map(l => l.replace(/^\d+\.\s*/, "").trim());
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Translate a single string. Returns original if lang is "en" or on error.
 */
export async function translateText(text: string, lang: Language): Promise<string> {
  if (!text || lang === "en") return text;
  const results = await translateBatch([text], lang);
  return results[0] ?? text;
}

/**
 * Translate an array of strings in one Haiku call. Cache hits are skipped.
 * Returns array of same length as input, in the same order.
 */
export async function translateBatch(texts: string[], lang: Language): Promise<string[]> {
  if (lang === "en") return texts;

  const cache = await loadCache(lang);
  const out = new Array<string>(texts.length);
  const toTranslate: Array<{ idx: number; text: string }> = [];

  for (let i = 0; i < texts.length; i++) {
    const key = cacheKey(texts[i]);
    if (cache[key]) {
      out[i] = cache[key];
    } else {
      toTranslate.push({ idx: i, text: texts[i] });
    }
  }

  if (toTranslate.length === 0) return out;

  try {
    const translated = await callHaiku(toTranslate.map(t => t.text), lang);
    for (let j = 0; j < toTranslate.length; j++) {
      const { idx, text } = toTranslate[j];
      const result = translated[j] ?? text; // fallback to original on parse failure
      out[idx] = result;
      cache[cacheKey(text)] = result;
    }
    await saveCache(lang, cache);
  } catch {
    // On any Haiku error, fall back to original English text
    for (const { idx, text } of toTranslate) {
      out[idx] = text;
    }
  }

  return out;
}
