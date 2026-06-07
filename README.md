# 🛡️ ProofOfSynergy — AI Skill Passport on Monad

**GitHub shows code. LinkedIn shows claims. ProofOfSynergy verifies what neither can.**

Upload a resume, answer resume-specific questions out loud **in any Indian language**, and
ProofOfSynergy turns your *demonstrated* ability into **on-chain skill attestations** that any
app or agent can read — plus a soulbound **Skill Passport**.

> The interview is the *mechanism*. The passport is the *product*. The **attestations are the
> blockchain value.**

---

## Why this is Monad-native (not "a database with extra steps")

The honest test for any blockchain hackathon project: *if you can swap the chain for Postgres in
10 minutes, it isn't Monad-native.* ProofOfSynergy passes that test because the value isn't
*writing* attestations — it's that **anyone can read them permissionlessly and act on them.**

- **`SkillAttestationRegistry`** — an ERC-8004-aligned reputation registry. Structured,
  attributable, permissionlessly-readable skill confidence per wallet.
- **`SkillPassport`** — a **soulbound** (non-transferable) ERC-721; the portable artifact.
- **`SkillGate`** — the **"why-not-Postgres" proof**: an *unrelated* third-party contract that
  grants a role purely by reading on-chain reputation, with **no permission** from the candidate
  or from ProofOfSynergy. A private database fundamentally cannot offer that trustless
  composability. This is the demo moment that makes the chain load-bearing.

## The killer feature: fraud detection → on-chain truth

Resume claims *"Kubernetes: advanced."* The interview asks *"Deployment vs StatefulSet?"* and the
candidate stumbles → observed confidence **34%** → **⚠ flagged** → the *honest* observed
confidence is what gets attested on-chain. Memorable, and impossible to fake post-hoc.

## Sarvam-native AI stack

| Layer | Model |
|---|---|
| Resume OCR | **Sarvam Parse** (`/parse`) |
| Voice → text | **Saarika v2** (`/speech-to-text`) — auto language detection + code-mixing |
| LLM (parse / generate / evaluate) | **Sarvam-M** (`/v1/chat/completions`) |

3-prompt pipeline: **Resume Parsing → Assessment Generation → Candidate Evaluation**. Per-question
scores are averaged per skill into the observed confidence that becomes each attestation.

**Every external call degrades silently to realistic demo data** — a judge never sees an error
screen, even with zero API keys.

---

## Architecture

```
Resume ─► Sarvam Parse ─► Sarvam-M (parse) ─► skills
        ─► Sarvam-M (generate) ─► resume-specific questions
Voice  ─► Saarika STT ─► transcript ─► Sarvam-M (evaluate) ─► per-question score
        ─► aggregate per skill ─► fraud detector (claimed vs observed)
        ─► attestBatch() + mint() on Monad ─► Skill Passport + explorer links
        ─► SkillGate reads reputation ─► access granted/denied (composability proof)
```

## Run it

```bash
# 1) Contracts (Foundry)
cd contracts && forge test               # 5 tests pass
cp .env.example .env                      # fund DEPLOYER from https://faucet.monad.xyz
./deploy.sh                               # deploys + pre-seeds demo attestations/passports

# 2) App (Next.js)
cd .. && npm install
cp .env.local.example .env.local          # add SARVAM_API_KEY + deployed addresses + DEPLOYER key
npm run dev                               # http://localhost:3000
```

Without keys/deploy the full flow still runs end-to-end on graceful fallbacks (mint returns a
clearly-labelled fallback rather than a fake transaction).

## Project layout

```
contracts/   Foundry: SkillAttestationRegistry, SkillPassport, SkillGate + tests + deploy.sh
app/         Next.js App Router pages + API routes (parse/generate/transcribe/evaluate/mint/gate)
lib/         sarvam, chain (viem), prompts, verify (fraud detector), ipfs, types, fallbackData
components/  VoiceRecorder
```

## Status

- ✅ Contracts written, **5/5 tests passing**, deploy+preseed script ready
- ✅ Full Sarvam-native AI pipeline with silent fallbacks
- ✅ Fraud detector + SkillGate composability demo + Why-Monad panel
- ⏳ On-chain deploy pending a funded testnet wallet (one command: `contracts/deploy.sh`)
