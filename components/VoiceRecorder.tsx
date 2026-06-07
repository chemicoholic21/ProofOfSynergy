"use client";

import { useEffect, useRef, useState } from "react";

export default function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasClip, setHasClip] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    setHasClip(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setHasClip(true);
        onRecorded(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone blocked. Click the address-bar mic icon and Allow, then retry.");
    }
  }

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {!recording ? (
          <button onClick={start} disabled={disabled} className="btn-ghost">
            {hasClip ? "Re-record" : "Record answer"}
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-full bg-[#ff3b30] px-5 py-2 text-[15px] font-medium text-white transition active:scale-[0.98]"
            style={{ boxShadow: "0 6px 18px rgba(255,59,48,0.3)" }}
          >
            Stop
          </button>
        )}
        <span className="font-mono text-lg tabular-nums text-ink-soft">
          {mm}:{ss}
        </span>
        {recording && (
          <div className="flex h-7 items-end gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className="wavebar w-1.5 rounded-full bg-accent"
                style={{ height: "100%", animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
        )}
        {hasClip && !recording && <span className="text-sm font-medium text-emerald-400">✓ Captured</span>}
      </div>
      {error && <p className="text-sm text-amber-400">{error}</p>}
    </div>
  );
}
