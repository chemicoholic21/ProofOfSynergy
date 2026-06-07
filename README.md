# ProofOfSynergy

AI voice interviews that turn a resume into verifiable skill attestations on Monad.

## What it does

• Reads a resume and extracts skills (Sarvam OCR + LLM)
• Generates voice questions from those exact skills
• Transcribes spoken answers in Indian languages (Saarika)
• Scores every answer and flags resumes that overclaim
• Writes the observed skill confidence onto Monad as attestations
• Mints a soulbound Skill Passport for the wallet
• Exposes a SkillGate so any other contract can read that reputation

## The fraud detector

Resume says "Kubernetes: advanced". Interview asks Deployment vs StatefulSet. Candidate stumbles. Observed confidence drops to 34 percent, the skill gets flagged, and the honest number is what goes onchain.

## Why Monad and not a database

• Attestations are public and anyone can read them
• Other apps, DAOs and AI agents consume them without asking permission
• SkillGate proves it: an unrelated contract grants a role purely from onchain confidence
• A private database cannot offer that

## Stack

• Sarvam: sarvam 105b (LLM), Saarika v2.5 (speech), Sarvam Parse (OCR)
• Monad Testnet, chain 10143
• Solidity + Foundry (SkillAttestationRegistry, SkillPassport, SkillGate)
• Next.js, viem, Tailwind

## Demo
https://www.loom.com/share/f70bd74190434b4782bc7a00d3908442

## Screenshots 

<img width="752" height="864" alt="image" src="https://github.com/user-attachments/assets/d75b803f-9b2c-4ef0-94e8-b83ed91f2c8f" />


## Deployed on Monad Testnet (10143)

Explorer: https://testnet.monadexplorer.com

• Registry: 0x899Aa8Ffe37a1e1b10AFfAe60f7Cd447f836C8bf
• Passport: 0x02aA94FF3DFeA9d0ec1E15697a0f2164a1A4F709
• SkillGate: 0xB8b8f015774b68eC31bcfCdADE555D9ec5D00B2F
• Sample attestation tx: 0x7e0e4eb0182daa0da7a9b1b56f075921dc59a78d9d80e22f2683bbb987ba565f

## Run it

Contracts:

```
cd contracts
forge test
./deploy.sh
```

App:

```
npm install
cp .env.local.example .env.local   # add SARVAM_API_KEY, RPC, deployer key, addresses
npm run dev
```

Every external call falls back to demo data, so the full flow runs even with no keys.

## Flow

1. Upload a resume or use the sample
2. Record answers by voice
3. See claimed vs observed per skill
4. Mint the passport on Monad
5. Run SkillGate to watch another contract consume the reputation
