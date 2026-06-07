"use client";

import { useMemo, useState } from "react";
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
  strong: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  verified: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  exaggerated: "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

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

    setBusy("Evaluating answers with Sarvam-M…");
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
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Header step={step} />

      {busy && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-monad-border bg-monad-card/80 px-4 py-3 text-sm text-slate-200">
          <span className="h-3 w-3 animate-pulse rounded-full bg-monad-purple" />
          {busy}
        </div>
      )}

      {step === "intro" && <Intro onStart={() => setStep("upload")} />}

      {step === "upload" && (
        <Card>
          <h2 className="mb-2 text-xl font-semibold">1 · Upload a resume</h2>
          <p className="mb-5 text-sm text-slate-400">
            PDF / DOCX / image / .txt. We extract skills with Sarvam, then generate questions that
            test how you think — not what you can recite.
          </p>
          <input
            type="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
            disabled={!!busy}
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-monad-purple file:px-4 file:py-2 file:text-white"
          />
          <button onClick={useSampleResume} disabled={!!busy} className="mt-4 text-sm text-monad-purple underline">
            or use a sample resume →
          </button>
        </Card>
      )}

      {step === "interview" && resume && (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-1 text-xl font-semibold">
              2 · Interview {resume.name ? `· ${resume.name}` : ""}
            </h2>
            <p className="text-sm text-slate-400">
              Answer out loud in <b>any Indian language</b> — Sarvam transcribes & detects it.
              {resume.source === "fallback" && <span className="ml-1 text-amber-400/70">(demo data)</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {resume.skills.map((s) => (
                <span key={s.name} className="rounded-full border border-monad-border bg-black/30 px-3 py-1 text-xs">
                  {s.name} · <span className="text-slate-400">{s.claimedLevel}</span>
                </span>
              ))}
            </div>
          </Card>

          {questions.map((q) => (
            <Card key={q.id}>
              <div className="mb-3 flex items-start gap-3">
                <span className="rounded-md bg-monad-purple/20 px-2 py-0.5 text-sm font-semibold text-monad-purple">
                  Q{q.id}
                </span>
                <div>
                  <p className="font-medium">{q.text}</p>
                  <p className="mt-1 text-xs text-slate-500">Targets: {q.targetSkill}</p>
                </div>
              </div>
              <VoiceRecorder
                disabled={!!busy}
                onRecorded={(blob) => setAnswers((a) => ({ ...a, [q.id]: blob }))}
              />
            </Card>
          ))}

          <button
            onClick={finishInterview}
            disabled={!allRecorded || !!busy}
            className="rounded-xl bg-monad-purple py-3 font-semibold text-white disabled:opacity-40"
          >
            {allRecorded ? "Evaluate my answers →" : "Record all answers to continue"}
          </button>
        </div>
      )}

      {step === "results" && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">3 · Skill verification</h2>
              <div className="text-right">
                <div className="text-3xl font-bold text-monad-purple">{overall}</div>
                <div className="text-xs text-slate-500">overall confidence</div>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Claimed level vs. what the interview actually demonstrated. This is the fraud detector.
            </p>
          </Card>

          {verdicts.map((v) => (
            <div
              key={v.skill}
              className={`rounded-xl border px-4 py-3 ${STATUS_STYLE[v.status]}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">{v.skill}</span>
                  <span className="ml-2 text-xs opacity-70">claimed: {v.claimedLevel}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg">{v.observedConfidence}%</span>
                  <span className="ml-2 text-sm font-semibold uppercase tracking-wide">
                    {v.status === "strong" ? "✅ strong" : v.status === "verified" ? "✓ verified" : "⚠ flagged"}
                  </span>
                </div>
              </div>
              {v.flag && <p className="mt-1 text-sm opacity-90">{v.flag}</p>}
            </div>
          ))}

          <details className="rounded-xl border border-monad-border bg-monad-card/60 px-4 py-3 text-sm">
            <summary className="cursor-pointer text-slate-300">Per-question detail & transcripts</summary>
            <div className="mt-3 flex flex-col gap-3">
              {evaluations.map((e) => (
                <div key={e.questionId} className="border-t border-monad-border pt-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{e.targetSkill}</span>
                    <span className="font-mono">{e.score}/100</span>
                  </div>
                  <p className="text-slate-400">{e.feedback}</p>
                  {transcripts[e.questionId] && (
                    <p className="mt-1 text-xs text-slate-500">
                      🗣 {transcripts[e.questionId].language}: “{transcripts[e.questionId].text}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>

          <button onClick={handleMint} disabled={!!busy} className="rounded-xl bg-monad-purple py-3 font-semibold text-white disabled:opacity-40">
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
    <header className="mb-8">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🛡️</span>
        <h1 className="text-2xl font-bold">
          ProofOfSynergy <span className="text-monad-purple">· AI Skill Passport</span>
        </h1>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Portable, on-chain skill reputation on Monad — verified by AI interview, not self-claimed.
      </p>
      {idx >= 0 && (
        <div className="mt-4 flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded ${i <= idx ? "bg-monad-purple" : "bg-monad-border"}`} />
          ))}
        </div>
      )}
    </header>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <Card>
      <h2 className="text-xl font-semibold">GitHub shows code. LinkedIn shows claims. We verify what neither can.</h2>
      <p className="mt-3 text-sm text-slate-300">
        Upload a resume, answer resume-specific questions out loud in any Indian language, and
        ProofOfSynergy turns your real demonstrated ability into <b>on-chain skill attestations</b>{" "}
        any app or agent can read — plus a soulbound Skill Passport.
      </p>
      <ul className="mt-4 space-y-1 text-sm text-slate-400">
        <li>• Sarvam: resume OCR, multilingual voice, AI evaluation</li>
        <li>• Monad: permissionless, composable reputation (not a private database)</li>
        <li>• Fraud detector: catches an exaggerated resume claim in ~90s — and notarizes the truth</li>
      </ul>
      <button onClick={onStart} className="mt-5 rounded-xl bg-monad-purple px-5 py-3 font-semibold text-white">
        Start →
      </button>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-monad-border bg-monad-card/80 p-5">{children}</div>;
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
          <h2 className="text-xl font-semibold text-emerald-400">✅ Skill Passport minted</h2>
          {!isReal && <span className="text-xs text-amber-400">deploy pending — labelled fallback</span>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Info label="Candidate">{name}</Info>
          <Info label="Overall confidence">{overall}/100</Info>
          <Info label="Subject wallet">
            <Mono>{mint.subject}</Mono>
          </Info>
          <Info label="Passport token">#{mint.tokenId ?? "—"}</Info>
        </div>

        <div className="mt-4 space-y-1">
          {verdicts.map((v) => (
            <div key={v.skill} className="flex justify-between text-sm">
              <span>
                {v.status === "exaggerated" ? "⚠" : "✓"} {v.skill}
              </span>
              <span className="font-mono text-slate-400">{v.observedConfidence}%</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          <LinkRow label="Attestation tx" href={`${mint.explorerBase}/tx/${mint.attestTxHash}`} value={mint.attestTxHash} enabled={isReal} />
          <LinkRow label="Passport mint tx" href={`${mint.explorerBase}/tx/${mint.mintTxHash}`} value={mint.mintTxHash} enabled={isReal} />
          <LinkRow label="Registry" href={`${mint.explorerBase}/address/${mint.registryAddress}`} value={mint.registryAddress} enabled={isReal} />
          <LinkRow label="Evidence" href={mint.metadataURI} value={mint.metadataURI} enabled />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold">🔓 Composability demo — why this isn&apos;t a database</h3>
        <p className="mt-1 text-sm text-slate-400">
          An <b>unrelated</b> contract (SkillGate) reads this passport&apos;s on-chain reputation and grants a
          role — no permission from the candidate or from ProofOfSynergy. A private DB can&apos;t do this.
        </p>
        <button onClick={runGate} disabled={gateBusy} className="mt-3 rounded-lg bg-monad-purple px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          {gateBusy ? "Reading chain…" : `Check gate: "${strongSkill?.skill} ≥ 80"`}
        </button>
        {gate && (
          <p className={`mt-3 text-sm ${gate.passes ? "text-emerald-400" : "text-amber-400"}`}>
            {gate.passes
              ? `✅ Access granted — on-chain confidence ${gate.confidence}% ≥ 80`
              : `🚫 Access denied — confidence ${gate.confidence}% < 80`}
            {gate.source === "fallback" && " (local logic — contracts not deployed yet)"}
          </p>
        )}
      </Card>

      <button onClick={() => location.reload()} className="text-sm text-slate-400 underline">
        ↺ Run another interview
      </button>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs break-all">{children}</span>;
}
function LinkRow({ label, href, value, enabled }: { label: string; href: string; value: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      {enabled ? (
        <a href={href} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-monad-purple underline">
          {value}
        </a>
      ) : (
        <span className="truncate font-mono text-xs text-slate-600">{value}</span>
      )}
    </div>
  );
}

function WhyMonad() {
  return (
    <section className="mt-10 rounded-2xl border border-monad-border bg-black/20 p-5 text-sm text-slate-400">
      <h3 className="mb-2 font-semibold text-slate-200">Why Monad, not Postgres?</h3>
      <p>
        The interview is the mechanism; the <b>attestations are the product</b>. Because they live on
        Monad, any third party — a DAO, a hiring app, an AI agent — can read a wallet&apos;s verified
        skill reputation permissionlessly and act on it (see the SkillGate demo). That trustless
        composability, plus a portable soulbound passport and ERC-8004-aligned reputation, is exactly
        what a private database cannot provide.
      </p>
    </section>
  );
}

const SAMPLE_RESUME_TEXT = `Aarav Sharma — aarav.sharma@example.com
Senior Backend Engineer, FinStack (3 yrs); Software Engineer, Razorpay (2 yrs)
B.Tech Computer Science, IIT Bombay, 2019
Skills: Python (expert), AWS (advanced), React (advanced), Kubernetes (advanced)
Projects: Built a high-throughput trading service in Python; event pipelines on AWS;
real-time dashboards in React; deployments on Kubernetes.`;
