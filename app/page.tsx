"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VoiceRecorder from "@/components/VoiceRecorder";
import { aggregateConfidence, buildVerdicts, overallScore } from "@/lib/verify";
import {
  ParsedResume,
  InterviewQuestion,
  Transcript,
  QuestionEvaluation,
  SkillVerdict,
  MintResult,
} from "@/lib/types";

type Step = "intro" | "upload" | "interview" | "results" | "passport";

const STATUS_STYLE: Record<string, string> = {
  strong: "text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.08]",
  verified: "text-sky-300 border-sky-400/30 bg-sky-400/[0.08]",
  exaggerated: "text-amber-300 border-amber-400/30 bg-amber-400/[0.08]",
};

// Speak a question aloud: Sarvam Bulbul TTS, falling back to the browser voice if it fails.
async function speak(text: string) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok && res.status !== 204) {
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      await audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
      return;
    }
    throw new Error("no audio");
  } catch {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }
}

function SpeakButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      onClick={async () => {
        setPlaying(true);
        await speak(text);
        setPlaying(false);
      }}
      title="Hear question"
      className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm text-ink-soft transition hover:bg-white/[0.08]"
    >
      {playing ? "🔊" : "🔈"}
    </button>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("intro");
  const [busy, setBusy] = useState<string | null>(null);

  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, Blob>>({});
  const [transcripts, setTranscripts] = useState<Record<number, Transcript>>({});
  const [evaluations, setEvaluations] = useState<QuestionEvaluation[]>([]);
  const [verdicts, setVerdicts] = useState<SkillVerdict[]>([]);
  const [mint, setMint] = useState<MintResult | null>(null);

  const overall = useMemo(
    () => (evaluations.length ? overallScore(aggregateConfidence(evaluations)) : 0),
    [evaluations]
  );

  // Auto speak the first question once the interview opens (best effort; buttons always work).
  const spokenRef = useRef(false);
  useEffect(() => {
    if (step === "interview" && questions.length && !spokenRef.current) {
      spokenRef.current = true;
      speak(questions[0].text);
    }
  }, [step, questions]);

  async function handleUpload(file: File) {
    setBusy("Extracting skills with Sarvam…");
    const fd = new FormData();
    fd.append("file", file);
    const r: ParsedResume = await (await fetch("/api/parse-resume", { method: "POST", body: fd })).json();
    setResume(r);
    setBusy("Generating resume-specific questions…");
    const q = await (
      await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skills: r.skills }),
      })
    ).json();
    setQuestions(q.questions);
    setBusy(null);
    setStep("interview");
  }

  function useSampleResume() {
    const blob = new File([SAMPLE_RESUME_TEXT], "sample-resume.txt", { type: "text/plain" });
    handleUpload(blob);
  }

  async function finishInterview() {
    setBusy("Transcribing answers (Saarika)…");
    const newTranscripts: Record<number, Transcript> = {};
    for (const q of questions) {
      const fd = new FormData();
      fd.append("questionId", String(q.id));
      const blob = answers[q.id];
      if (blob) fd.append("audio", blob, `answer-${q.id}.webm`);
      const t: Transcript = await (await fetch("/api/transcribe", { method: "POST", body: fd })).json();
      newTranscripts[q.id] = t;
    }
    setTranscripts(newTranscripts);

    setBusy("Evaluating answers with Sarvam…");
    const items = questions.map((q) => ({ question: q, answer: newTranscripts[q.id]?.text ?? "" }));
    const ev = await (
      await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      })
    ).json();
    const evals: QuestionEvaluation[] = ev.evaluations;
    setEvaluations(evals);

    const conf = aggregateConfidence(evals);
    setVerdicts(buildVerdicts(resume!.skills, conf));
    setBusy(null);
    setStep("results");
  }

  async function handleMint() {
    setBusy("Hashing interview → IPFS → attesting + minting on Monad…");
    const m: MintResult = await (
      await fetch("/api/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verdicts, overall, name: resume?.name ?? "Anonymous" }),
      })
    ).json();
    setMint(m);
    setBusy(null);
    setStep("passport");
  }

  const allRecorded = questions.length > 0 && questions.every((q) => answers[q.id]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Header step={step} />

      {busy && (
        <div className="mb-6 flex items-center gap-3 glass-subtle px-5 py-3.5 text-[15px] text-ink">
          <Spinner />
          {busy}
        </div>
      )}

      {step === "intro" && <Intro onStart={() => setStep("upload")} />}

      {step === "upload" && (
        <Card>
          <h2 className="mb-2 text-2xl font-semibold">Upload a resume</h2>
          <p className="mb-6 text-[15px] text-ink-soft">
            We extract your skills, then ask questions that test how you think.
          </p>
          <label className="block">
            <span className="sr-only">Choose file</span>
            <input
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
              disabled={!!busy}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-5 file:py-2.5 file:font-medium file:text-white"
            />
          </label>
          <button onClick={useSampleResume} disabled={!!busy} className="mt-5 text-[15px] font-medium text-accent">
            or use a sample resume →
          </button>
        </Card>
      )}

      {step === "interview" && resume && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-2xl font-semibold">
              Interview{resume.name ? ` · ${resume.name}` : ""}
            </h2>
            <p className="mt-1.5 text-[15px] text-ink-soft">
              Answer out loud in <b className="text-ink">any Indian language</b>. Sarvam transcribes and
              detects it.
              {resume.source === "fallback" && <span className="ml-1 text-amber-400">(demo data)</span>}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {resume.skills.map((s) => (
                <span key={s.name} className="chip">
                  {s.name} · <span className="text-ink-soft">{s.claimedLevel}</span>
                </span>
              ))}
            </div>
          </Card>

          {questions.map((q) => (
            <Card key={q.id}>
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                  {q.id}
                </span>
                <div className="flex-1">
                  <p className="font-medium leading-relaxed">{q.text}</p>
                  <p className="mt-1.5 text-xs text-ink-soft">Targets · {q.targetSkill}</p>
                </div>
                <SpeakButton text={q.text} />
              </div>
              <VoiceRecorder
                disabled={!!busy}
                onRecorded={(blob) => setAnswers((a) => ({ ...a, [q.id]: blob }))}
              />
            </Card>
          ))}

          <button onClick={finishInterview} disabled={!allRecorded || !!busy} className="btn-primary py-3.5">
            {allRecorded ? "Evaluate my answers →" : "Record all answers to continue"}
          </button>
        </div>
      )}

      {step === "results" && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Skill verification</h2>
              <div className="text-right">
                <div className="font-display text-4xl font-semibold text-accent">{overall}</div>
                <div className="text-xs text-ink-soft">overall confidence</div>
              </div>
            </div>
            <p className="mt-1.5 text-[15px] text-ink-soft">Claimed level versus what you demonstrated.</p>
          </Card>

          {verdicts.map((v) => (
            <div key={v.skill} className={`glass-subtle border px-5 py-4 ${STATUS_STYLE[v.status]}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">{v.skill}</span>
                  <span className="ml-2 text-xs opacity-70">claimed · {v.claimedLevel}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg">{v.observedConfidence}%</span>
                  <span className="ml-2 text-sm font-semibold">
                    {v.status === "strong" ? "Strong" : v.status === "verified" ? "Verified" : "Flagged"}
                  </span>
                </div>
              </div>
              {v.flag && <p className="mt-1.5 text-sm opacity-90">{v.flag}</p>}
            </div>
          ))}

          <details className="glass-subtle px-5 py-4 text-sm">
            <summary className="cursor-pointer font-medium text-ink-soft">Per-question detail & transcripts</summary>
            <div className="mt-3 flex flex-col gap-3">
              {evaluations.map((e) => (
                <div key={e.questionId} className="border-t border-white/10 pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium">{e.targetSkill}</span>
                    <span className="font-mono">{e.score}/100</span>
                  </div>
                  <p className="text-ink-soft">{e.feedback}</p>
                  {transcripts[e.questionId] && (
                    <p className="mt-1.5 text-xs text-ink-soft">
                      🗣 {transcripts[e.questionId].language}: “{transcripts[e.questionId].text}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>

          <button onClick={handleMint} disabled={!!busy} className="btn-primary py-3.5">
            Mint Skill Passport on Monad →
          </button>
        </div>
      )}

      {step === "passport" && mint && (
        <Passport mint={mint} verdicts={verdicts} overall={overall} name={resume?.name ?? "Anonymous"} />
      )}

      <WhyMonad />
    </main>
  );
}

function Header({ step }: { step: Step }) {
  const steps: Step[] = ["upload", "interview", "results", "passport"];
  const idx = steps.indexOf(step);
  return (
    <header className="mb-9">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-lg backdrop-blur">
          🛡️
        </span>
        <h1 className="text-[28px] font-semibold tracking-tight">ProofOfSynergy</h1>
      </div>
      <p className="mt-2 text-[15px] text-ink-soft">Onchain skill reputation, verified by interview.</p>
      {idx >= 0 && (
        <div className="mt-5 flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= idx ? "bg-accent" : "bg-white/10"}`} />
          ))}
        </div>
      )}
    </header>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <Card>
      <h2 className="text-[26px] font-semibold leading-snug">
        GitHub shows code. LinkedIn shows claims.
        <br />
        We verify what neither can.
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        Answer voice questions about your resume. We turn real ability into onchain skill
        attestations and a soulbound passport.
      </p>
      <ul className="mt-5 space-y-2 text-[15px] text-ink-soft">
        <li className="flex gap-2"><span className="text-accent">›</span> Sarvam OCR, voice, evaluation</li>
        <li className="flex gap-2"><span className="text-accent">›</span> Monad reputation any app can read</li>
        <li className="flex gap-2"><span className="text-accent">›</span> Fraud detector flags overclaims</li>
      </ul>
      <button onClick={onStart} className="btn-primary mt-7 px-6 py-3">
        Start →
      </button>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass-card p-7">{children}</div>;
}

function Spinner() {
  return (
    <span
      className="spinner inline-block h-4 w-4 rounded-full border-[2.5px] border-white/15 border-t-accent"
      aria-hidden
    />
  );
}

function Passport({
  mint,
  verdicts,
  overall,
  name,
}: {
  mint: MintResult;
  verdicts: SkillVerdict[];
  overall: number;
  name: string;
}) {
  const [gate, setGate] = useState<null | { passes: boolean; confidence: number; source: string }>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const strongSkill = verdicts.find((v) => v.status !== "exaggerated") ?? verdicts[0];

  async function runGate() {
    if (!strongSkill) return;
    setGateBusy(true);
    const r = await (
      await fetch("/api/gate-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: mint.subject, skill: strongSkill.skill, minConfidence: 80 }),
      })
    ).json();
    setGate(r);
    setGateBusy(false);
  }

  const isReal = mint.source === "onchain";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-emerald-400">Skill Passport minted</h2>
          {!isReal && <span className="text-xs text-amber-400">deploy pending, labelled fallback</span>}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <Info label="Candidate">{name}</Info>
          <Info label="Overall confidence">{overall}/100</Info>
          <Info label="Subject wallet">
            <Mono>{mint.subject}</Mono>
          </Info>
          <Info label="Passport token">#{mint.tokenId ?? "none"}</Info>
        </div>

        <div className="mt-5 space-y-1.5">
          {verdicts.map((v) => (
            <div key={v.skill} className="flex justify-between text-sm">
              <span>
                {v.status === "exaggerated" ? "⚠" : "✓"} {v.skill}
              </span>
              <span className="font-mono text-ink-soft">{v.observedConfidence}%</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 text-sm">
          <LinkRow label="Attestation tx" href={`${mint.explorerBase}/tx/${mint.attestTxHash}`} value={mint.attestTxHash} enabled={isReal} />
          <LinkRow label="Passport mint tx" href={`${mint.explorerBase}/tx/${mint.mintTxHash}`} value={mint.mintTxHash} enabled={isReal} />
          <LinkRow label="Registry" href={`${mint.explorerBase}/address/${mint.registryAddress}`} value={mint.registryAddress} enabled={isReal} />
          <LinkRow label="Evidence" href={mint.metadataURI} value={mint.metadataURI} enabled />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">Composability demo</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
          An <b className="text-ink">unrelated</b> contract reads this passport reputation and grants a
          role. No permission needed. A database cannot do this.
        </p>
        <button onClick={runGate} disabled={gateBusy} className="btn-primary mt-4">
          {gateBusy ? "Reading chain…" : `Check gate · ${strongSkill?.skill} ≥ 80`}
        </button>
        {gate && (
          <p className={`mt-4 text-[15px] font-medium ${gate.passes ? "text-emerald-400" : "text-amber-400"}`}>
            {gate.passes
              ? `✓ Access granted. Onchain confidence ${gate.confidence}% ≥ 80`
              : `✗ Access denied. Confidence ${gate.confidence}% below 80`}
            {gate.source === "fallback" && " (local logic, contracts not deployed yet)"}
          </p>
        )}
      </Card>

      <button onClick={() => location.reload()} className="mx-auto text-[15px] font-medium text-ink-soft">
        ↺ Run another interview
      </button>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs break-all">{children}</span>;
}
function LinkRow({ label, href, value, enabled }: { label: string; href: string; value: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-soft">{label}</span>
      {enabled ? (
        <a href={href} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-accent underline">
          {value}
        </a>
      ) : (
        <span className="truncate font-mono text-xs text-ink-soft/60">{value}</span>
      )}
    </div>
  );
}

function WhyMonad() {
  return (
    <section className="glass-subtle mt-10 p-7 text-[15px] leading-relaxed text-ink-soft">
      <h3 className="mb-2 text-lg font-semibold text-ink">Why Monad, not Postgres?</h3>
      <p>
        The interview is the mechanism. The <b className="text-ink">attestations are the product</b>. Any DAO,
        app or agent can read a wallet reputation onchain and act on it, shown by SkillGate. A private
        database cannot.
      </p>
    </section>
  );
}

const SAMPLE_RESUME_TEXT = `Aarav Sharma, aarav.sharma@example.com
Senior Backend Engineer, FinStack (3 yrs); Software Engineer, Razorpay (2 yrs)
B.Tech Computer Science, IIT Bombay, 2019
Skills: Python (expert), AWS (advanced), React (advanced), Kubernetes (advanced)
Projects: Built a high-throughput trading service in Python; event pipelines on AWS;
real-time dashboards in React; deployments on Kubernetes.`;
