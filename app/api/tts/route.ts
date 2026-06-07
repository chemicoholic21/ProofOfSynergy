import { NextRequest, NextResponse } from "next/server";
import { sarvamTTS } from "@/lib/sarvam";

export const runtime = "nodejs";
export const maxDuration = 30;

// Speaks a question aloud with Sarvam Bulbul TTS. On failure returns 204 so the client
// falls back to the browser's built-in speech synthesis (voice still works).
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) throw new Error("no text");
    const wav = await sarvamTTS(text);
    return new NextResponse(new Uint8Array(wav), {
      headers: { "content-type": "audio/wav", "cache-control": "no-store" },
    });
  } catch (e) {
    console.warn("[tts] fallback:", (e as Error).message);
    return new NextResponse(null, { status: 204 });
  }
}
