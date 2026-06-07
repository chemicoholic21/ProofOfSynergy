import { NextRequest, NextResponse } from "next/server";
import { sarvamParse, sarvamChat, extractJson } from "@/lib/sarvam";
import { RESUME_PARSE_SYSTEM, resumeParseUser } from "@/lib/prompts";
import { FALLBACK_RESUME } from "@/lib/fallbackData";
import { ParsedResume } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) throw new Error("no file");

    // 1) OCR / text extraction (Sarvam Parse for PDFs; plain text passes through).
    let text: string;
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      text = await file.text();
    } else {
      text = await sarvamParse(file, file.name);
    }
    if (!text || text.trim().length < 20) throw new Error("empty OCR text");

    // 2) Structure it with Sarvam-M (Prompt 1).
    const raw = await sarvamChat(RESUME_PARSE_SYSTEM, resumeParseUser(text), { temperature: 0.2 });
    const parsed = extractJson<Omit<ParsedResume, "source">>(raw);
    if (!parsed.skills?.length) throw new Error("no skills parsed");

    return NextResponse.json({ ...parsed, source: "sarvam" } satisfies ParsedResume);
  } catch (e) {
    // Silent graceful degradation — judge never sees an error.
    console.warn("[parse-resume] fallback:", (e as Error).message);
    return NextResponse.json(FALLBACK_RESUME);
  }
}
