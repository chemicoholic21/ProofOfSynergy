// Thin Sarvam-native client. All callers wrap these in try/catch and fall back to mock data,
// so a missing key or a timeout never reaches the judge.

const SARVAM_BASE = "https://api.sarvam.ai";
const KEY = process.env.SARVAM_API_KEY || "";

export function sarvamConfigured(): boolean {
  return KEY.length > 0;
}

function authHeaders(extra: Record<string, string> = {}) {
  return { "api-subscription-key": KEY, ...extra };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(t);
  }
}

/** Sarvam-M chat completion. Returns the assistant message content. */
export async function sarvamChat(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}
): Promise<string> {
  if (!KEY) throw new Error("SARVAM_API_KEY not set");
  const res = await withTimeout(
    fetch(`${SARVAM_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        model: "sarvam-m",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1200,
      }),
    }),
    opts.timeoutMs ?? 25000
  );
  if (!res.ok) throw new Error(`Sarvam chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Sarvam chat: empty content");
  return content as string;
}

/** Saarika STT. Returns transcript + detected language. */
export async function sarvamTranscribe(
  audio: Blob,
  filename: string,
  timeoutMs = 20000
): Promise<{ text: string; language: string }> {
  if (!KEY) throw new Error("SARVAM_API_KEY not set");
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "saarika:v2");
  form.append("language_code", "unknown"); // auto-detect + code-mixing
  const res = await withTimeout(
    fetch(`${SARVAM_BASE}/speech-to-text`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    }),
    timeoutMs
  );
  if (!res.ok) throw new Error(`Sarvam STT ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data?.transcript ?? "",
    language: data?.language_code ?? "unknown",
  };
}

/** Sarvam Parse (OCR). Returns extracted text/markdown from a document. */
export async function sarvamParse(file: Blob, filename: string, timeoutMs = 25000): Promise<string> {
  if (!KEY) throw new Error("SARVAM_API_KEY not set");
  const form = new FormData();
  form.append("file", file, filename);
  form.append("page_number", "1");
  form.append("sarvam_mode", "small");
  const res = await withTimeout(
    fetch(`${SARVAM_BASE}/parse/parsepdf`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    }),
    timeoutMs
  );
  if (!res.ok) throw new Error(`Sarvam Parse ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Parse returns base64-encoded XML/markdown depending on mode; normalize to text.
  const out = data?.output ?? data?.content ?? "";
  try {
    return Buffer.from(out, "base64").toString("utf-8") || out;
  } catch {
    return out;
  }
}

/** Robustly pull a JSON object out of an LLM response that may include prose or code fences. */
export function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const startArr = candidate.indexOf("[");
  const begin =
    startArr !== -1 && (startArr < start || start === -1) ? startArr : start;
  const lastObj = candidate.lastIndexOf("}");
  const lastArr = candidate.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (begin === -1 || end === -1) throw new Error("No JSON found in LLM output");
  return JSON.parse(candidate.slice(begin, end + 1)) as T;
}
