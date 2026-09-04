# ProofMarket
### Autonomous Storage Budget Triage on Filecoin

**FilecoinTLDR Builder Challenge — Cycle 4**
Repo: [github.com/pk1427/ProofMarket](https://github.com/pk1427/ProofMarket)

---

## The Pitch

> An agent that reads its own USDFC balance and Filecoin Pay runway, and when runway gets tight, chooses **which of two datasets to protect and which to pause** — then has an LLM explain the trade-off in plain language.

Most storage-agent submissions to this challenge will be "top-up bots": watch a number, refill it when low. That's a threshold trigger, not a decision — and the judging brief is explicit that an agent which "stores and pays but never decides anything" doesn't score on the criterion that matters most.

ProofMarket is different. It holds two real datasets of different declared value, and when funds get tight it has to actually **choose between them** — pause one, protect the other, and explain why. Not "can I afford storage." **Which of my holdings is worth protecting.**

---

## About

**Builder:** Prasad Kapure
**Challenge:** [FilecoinTLDR Builder Challenge — Cycle 4](https://docs.filecoin.io/)
**Submission type:** Live, working web app + open-source repo
**Network:** Filecoin Calibration testnet (chain ID `314159`)
**Stack:** TypeScript, React, Vite, Express, viem, Synapse SDK, Claude (via OpenRouter), wagmi, RainbowKit
**Code:** [github.com/pk1427/ProofMarket](https://github.com/pk1427/ProofMarket)
**Live demo:** [proofmarket-1.vercel.app](https://proofmarket-1.vercel.app)
**Backend:** [proofmarket-1.onrender.com](https://proofmarket-1.onrender.com)

ProofMarket is built as a single, working submission — every button on the demo page is wired to a real onchain transaction (or a real read from Filecoin Pay), and every number on screen is sourced from the Synapse SDK at request time. There is no mock layer, no faked balance, no simulated lockup rate.

The whole thing is small enough to read in one sitting: ~1,500 lines of TypeScript across a 5-file backend and a 10-file frontend, plus a 6-file dataset/decision/intervention history that lives in `data/`.

---

## Why Two Datasets, Not One

A single-dataset "keep it alive or don't" loop isn't a real decision — there's nothing to choose *against*, so the one dataset survives by default. Two datasets, each with a declared priority, turns the same amount of engineering into a genuine trade-off: protect A, pause B, and justify the call. Everything beyond this — a third dataset, a demand simulator, a full reallocation market — is upside, not required to tell the story.

---

## What It Actually Does

1. **Reads real onchain state.** USDFC balance and `runwayInEpochs` come straight from Filecoin Pay via the Synapse SDK on every check — never cached, never mocked.
2. **Runs a decision loop.** When runway drops below a threshold, the agent compares its two datasets by declared priority and pauses the lower one.
3. **Executes a real onchain pause.** The chosen dataset's payment rail is actually terminated via Warm Storage / Synapse — not a UI status flip.
4. **Generates a plain-English explanation.** Claude (via OpenRouter) receives the real numbers for this specific decision and writes one paragraph explaining the trade-off. A rules-based fallback covers any explanation-layer failure so the agent's behavior never depends on an external API call succeeding.
5. **Can bring data back.** When funds recover, the agent checks whether resuming the paused dataset is actually safe — and will refuse to resume if doing so would immediately jeopardize the protected dataset. This refusal is itself a real, logged decision, not a missing feature.
6. **Logs everything.** Every check, decision, and transaction is written to a timestamped, append-only audit trail.

---

## Real vs. Simulated — Full Disclosure

The rubric explicitly penalizes hardcoded or simulated balances and payments. Here's exactly where the line sits in ProofMarket:

| Data | Source | Notes |
|---|---|---|
| USDFC balance | **Real** — Filecoin Pay | Read via Synapse SDK's `accountSummary()` on every check |
| Runway in epochs | **Real** — Filecoin Pay | `accountSummary().runwayInEpochs`, the SDK's own onchain-derived figure |
| Lockup rate per epoch | **Real** — Filecoin Pay | `accountSummary().lockupRatePerEpoch` |
| Per-dataset rail rate | **Real** — onchain rail | Queried directly via `getRail().paymentRate` for each dataset |
| Dataset pause / resume | **Real** — Warm Storage | Actual payment rail termination and re-upload transactions, verifiable on Filfox |
| `declared_value` | **Simulated** — user input | A simple priority number (e.g. 9 vs. 3), labeled honestly in the UI as user-set, never presented as onchain data |
| `cost_per_epoch` in `datasets.json` | **Simulated** — legacy display field | Not used in any decision math; real per-dataset rail rates are used instead |

**The one invariant that matters:** the number the dashboard displays, the number the decision loop acts on, and the number the LLM explanation references are always the *same* number. There is no parallel simulated cost model quietly driving decisions behind a real-looking display — an earlier version of this project had exactly that bug, caught and fixed during development (see [Known Limitations](#known-limitations)).

---

## Architecture

```
┌─────────────────────┐        ┌────────────────────────────┐
│  Vite + React         │◄──────►│  Node/TS Backend             │
│  Dashboard             │  poll  │  - Synapse SDK client         │
│  - balance / runway    │        │  - Real rail-rate queries     │
│  - dataset cards        │        │  - Decision loop               │
│  - decision log          │        │  - LLM explanation              │
│  - "Check Now"            │        │  - Onchain pause / resume        │
│  - Verification page       │        │  - JSON audit log                 │
└─────────────────────┘        └────────────┬───────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
             Filecoin Pay             Warm Storage (PDP)        Anthropic API
          (USDFC balance,           (upload / pause /          (one call per
           runway — real)            re-upload — real)          decision cycle)
```

### Backend modules

| File | Responsibility |
|---|---|
| `src/paymentsClient.ts` | Creates the Synapse client; wraps `accountSummary()` for balance, runway, and lockup rate reads |
| `src/decisionLoop.ts` | Loads dataset metadata, queries real per-dataset rail rates via `getRail`, and computes triage/resume outcomes using only SDK-derived values |
| `src/explain.ts` | Converts wei to USDFC for display, builds the Claude prompt, returns the explanation or falls back to a rules-based generator on failure |
| `src/intervention.ts` | Executes the real pause (terminate rail) and resume (re-upload piece, create new dataset deal) actions |
| `src/index.ts` | Express API — `/api/check`, `/api/act`, `/api/verify-pause/:id`, `/api/resume`, `/api/account`, `/api/datasets`, `/api/decisions`, `/api/interventions` |

### Frontend pages

| Route | Page | Purpose |
|---|---|---|
| `/` | Landing | Project overview and links |
| `/demo` | Live Demo | Real-time dashboard — balance, runway, outcome badge, dataset cards, decision log, LLM explanation |
| `/verification` | Verification | Onchain transaction history, dataset IDs, piece CIDs, live provider-accessibility checks |
| `/architecture` | Architecture | Real-vs-simulated data lineage and system diagram |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Storage + payments | [`@filoz/synapse-sdk`](https://github.com/FilOzone/synapse-sdk) (TypeScript), Filecoin Calibration testnet |
| Backend | Node.js + Express + `tsx` |
| Frontend | Vite + React + Tailwind CSS |
| Reasoning layer | Claude, via OpenRouter |
| Language | TypeScript throughout, strict mode |
| State / logs | JSON files (`data/datasets.json`, `data/decisions.json`, `data/interventions.json`) |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- A funded wallet on Filecoin Calibration testnet (USDFC via faucet)
- An OpenRouter API key for Claude access
- A Synapse SDK-compatible private key

### Setup

```bash
# Backend — terminal 1
cd backend
cp .env.example .env
# Set SYNAPSE_PRIVATE_KEY. OPENROUTER_API_KEY is optional: a local fallback
# explanation keeps the decision loop working if it is absent.
npm install
npm run dev

# Frontend — terminal 2
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:3001`.

For a public demo, set `VITE_API_BASE` to the deployed backend URL and add the
matching frontend origin to `CORS_ORIGINS` in the backend environment. Restart
Vite after changing any `VITE_` variable. Do not commit either `.env` file.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Claude access via OpenRouter; a rules-based fallback is used when unset or unavailable | optional |
| `SYNAPSE_PRIVATE_KEY` | Wallet key for Calibration testnet | — required |
| `PORT` | Backend HTTP port | `3001` |
| `CORS_ORIGINS` | Comma-separated frontend origins allowed to call the API | local Vite origins |
| `TRIAGE_THRESHOLD_EPOCHS` | Runway threshold that triggers triage | `100000000` |
| `RESUME_MARGIN_EPOCHS` | Safety margin required before resuming a paused dataset | `10000000` |

Frontend variables:

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE` | Public URL of the ProofMarket backend | `http://localhost:3001` |

---

## How the Decision Actually Works

The decision loop runs on every hit to `/api/check` — manually via the dashboard's "Check Now" button, or on a poll:

1. Read `accountSummary()` from the Synapse SDK → real `balance`, `runwayInEpochs`, `lockupRatePerEpoch`.
2. Query each dataset's real rail rate via `getRail(pdpRailId)`.
3. **If `runwayInEpochs` is below threshold and both datasets are active → CRITICAL.**
   Sort datasets by `declared_value`, pause the lower-priority one, log the decision, generate the explanation.
4. **If one dataset is paused and runway has since recovered → check resume safety.**
   Project the new runway *as if* the paused dataset were reactivated. If projected runway clears threshold + safety margin → `resume_safe`. If it clears threshold but not the margin → `resume_available`. If it doesn't clear threshold at all → `resume_insufficient`, and the agent explicitly refuses to resume.
5. **Otherwise → HEALTHY.** No action taken, logged as such.

There is no separate "simulated cost model" driving this math anywhere in the decision path. The real onchain lockup rate and per-dataset rail rates are the sole source of truth for every epoch and cost calculation the agent acts on.

---

## Wallet Mode (Connect Your Own Wallet)

The dashboard supports two modes side by side:

- **Demo mode (default)** — the backend signs all transactions with a funded Calibration account. State is shared, deterministic, ideal for a recorded walkthrough.
- **Wallet mode** — click **Connect Wallet** in the navbar, pick MetaMask/Rabby/etc., and every read is from the connected address and every write is signed by your wallet. The triage engine runs entirely client-side in this mode.

Wallet mode reads via `Pay.getAccountSummary` from `@filoz/synapse-core` over a public RPC client (no signer needed for reads). Writes go through the Synapse SDK with the connected wallet client, so MetaMask signs `approveService`, `deposit`, `withdraw`, `createDataSetAndAddPieces`, and `terminateServiceSync` directly.

In wallet mode, the dashboard also exposes a **Create Demo Datasets** action that uploads two ~127-byte pieces and registers them onchain as `customer-model-v3.txt` (declared value 9) and `raw-sensor-archive.txt` (declared value 3). The triage engine then uses the real per-rail lockup rates to compute runway and recommend a pause or resume.

---

## Demo Flow

1. **Healthy state.** Both datasets active, real balance and runway visible and ticking on the dashboard, alongside an inline chain-verification readout (balance, transaction reference, current epoch) so the numbers don't require a separate block explorer tab to trust.
2. **Crossing the threshold.** A funding change (withdrawal) brings runway below the real critical line. `Check Now` fires the triage decision live.
3. **The decision.** The dashboard shows the comparison between the two datasets, the chosen action executes as a real onchain transaction, and the Claude-generated explanation names both datasets and states the reasoning explicitly — not a generic "runway is low" message.
4. **Proof it's real.** The Verification page confirms the paused dataset's payment rail is actually terminated, with a linked, inspectable transaction hash.
5. **The resume story.** When funds recover, the agent evaluates whether resuming is safe — and, notably, will correctly *refuse* to resume if doing so would immediately jeopardize its protected dataset, explaining exactly why. This refusal is as important a demonstration of judgment as the pause itself.

---

## Known Limitations

- **`declared_value` is a design input, not an onchain metric.** It's labeled honestly everywhere it appears — dashboard, decision log, and this document — and is used solely to rank priority between datasets, never for any epoch or cost calculation.
- **Resume is not literal reactivation.** Once a Warm Storage payment rail is terminated, it cannot be restarted in place — this is a property of the underlying protocol, confirmed against the Synapse SDK (`DataSetPaymentAlreadyTerminated` is a permanent state). "Resume" in ProofMarket means re-establishing storage as a new dataset deal for the same logical content, not reviving the original onchain record. This is disclosed rather than glossed over.
- **The decision math was corrected mid-build.** An earlier version divided the SDK's already-real `runwayInEpochs` by a second, independently-invented cost constant — a units error that produced numbers roughly four orders of magnitude off from reality, while the dashboard displayed the (unused) real figure alongside it. This was caught, diagnosed down to the exact mismatch between the simulated cost model and real onchain rail rates, and fixed by removing the simulated model from the decision path entirely. Thresholds were recalibrated against real onchain rates (~0.000002 USDFC/epoch combined for both datasets) rather than the original invented estimate (~0.0254 USDFC/epoch) — a difference of roughly 11,000×.

---

## Judging Criteria Mapping

| Criterion | Weight | How ProofMarket addresses it |
|---|---|---|
| Autonomous budget decisions | 30% | A real comparison between two competing datasets, a live threshold crossing, and an actual chosen-and-executed action with stated reasoning — including a genuine refusal-to-resume when the numbers don't support it. |
| Working demo quality | 25% | Narrow, tested scope: one decision loop, one real intervention type (pause/resume), calibrated and rehearsed against real onchain timing before recording. |
| Meaningful use of Filecoin | 20% | Real Synapse SDK storage operations, real `PaymentsService`/`accountSummary()` reads, real per-dataset rail rate queries, and a real pause/resume transaction verified independently via the provider. |
| Clarity + showcase | 15% | Explicit real-vs-simulated data lineage on the Architecture page, a single focused LLM explanation per decision, and this document. |

---

## AI Build Log

This project was built end-to-end with AI pair-programming as a primary collaborator. Below is the honest record of what the human did, what the AI did, and where the lines blur.

**Repo built in:** one working session across roughly three focused days of iteration.

**Model used:** Claude (Sonnet 4 / Opus 4.x) via Kilo CLI, with code review checkpoints after every meaningful change.

**What AI was used for:**
- **Boilerplate generation** — Express server, CORS config, Vite + React + TS scaffolding, Tailwind setup, type definitions for the API surface.
- **Synapse SDK plumbing** — the wallet vs. server signer paths, the public-client read pattern, the in-browser dataset creation flow.
- **State management** — React state shape, useEffect dependency debugging, race conditions between the wagmi `useWalletClient()` hook and the Synapse read.
- **Debugging** — catching the `2^64` empty-account display bug, the wallet-vs-demo-account read divergence, the `waitForTransactionReceipt` UX regression that was making the UI feel stuck.
- **Documentation** — most of this README, the inline code comments, the explain-fallback rules.

**What the human did:**
- **The decision logic itself** — `runDecisionLoop` is the core intellectual contribution: which datasets to compare, what threshold means, the four resume-outcome cases (safe / available / insufficient / already-active), the protection rule when two are active.
- **Real onchain testing** — every transaction shown in the demo was actually sent on Calibration: the 2,000 USDFC drip, the 10 USDFC top-up (`0xb79b…4442`), the two PDP dataset creations (`#33535`, `#33536`), and the pause (`0xaef5…ee5a`). All are independently verifiable on Filfox.
- **Honest evaluation of the AI's suggestions** — multiple AI-generated snippets were rejected or rewritten on inspection (e.g. an over-engineered wallet-client fallback that didn't work with the user's MetaMask config, a simulated "demo mode" that hid the real account state, a `formatUSDFC` regex that stripped leading zeros incorrectly).
- **The product framing** — choosing "two datasets, different declared values" as the smallest unit of a real trade-off; deciding the demo account would be a *visible* address with a public tx history rather than a hidden test fixture; keeping the LLM explanation to one focused paragraph rather than a wall of AI text.

**Where the AI helped most:** converting a one-paragraph mental model ("watch the runway, pick which dataset to keep") into a working system with a real backend, a real frontend, real onchain integration, and a clean dev story — without losing the original decision rule in translation.

**Where the AI's help had to be corrected:** the wallet-read path went through three wrong implementations before the working public-RPC + connected-address approach. The deposit/withdraw UX went through a "wait for receipt" version that made the UI feel frozen, and a "fake completion" version that was misleading. Both were caught and replaced with the fire-and-forget pattern that's in the final code.

---

## Submission Checklist

Use this as a verification list for judges (and as a sanity check for the build).

- [x] **Live, working web app** at [proofmarket-1.vercel.app](https://proofmarket-1.vercel.app)
- [x] **Source repo** at [github.com/pk1427/ProofMarket](https://github.com/pk1427/ProofMarket)
- [x] **Two real datasets** of different declared value (9 vs 3), both visible in the demo and onchain
- [x] **Real decision logic** — threshold-based triage with 5 distinct outcomes (`healthy` / `critical` / `resume_safe` / `resume_available` / `resume_insufficient`)
- [x] **Real onchain reads** — `accountSummary`, per-dataset rail rate, `getPdpDataSet`, `terminateServiceSync`, `createDataSetAndAddPieces` — none cached, none mocked
- [x] **Real onchain actions** — pause/resume transactions confirmed on Calibration and viewable on Filfox
- [x] **LLM explanation** — Claude via OpenRouter, with a rules-based fallback so the agent's behavior never depends on an external API
- [x] **Wallet mode** — connect MetaMask, sign with your own account, run the same triage end-to-end
- [x] **Real-vs-simulated disclosure** — explicit table in this README, no hidden assumptions
- [x] **Known limitations** — listed honestly in the section above
- [x] **AI build log** — this section
- [x] **README** — setup, architecture, decision rules, demo flow, judging-criterion mapping
- [x] **End-to-end demo path reproducible** — faucet → deposit → create datasets → check → pause → check → resume

---

## License

MIT
