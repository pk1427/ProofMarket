# ProofMarket
**Autonomous Storage Budget Triage on Filecoin Calibration**

> An agent that reads its own USDFC balance and Filecoin Pay runway, and when runway gets tight, chooses **which of two datasets to protect and which to pause** — then has an LLM explain the trade-off in plain language.

**FilecoinTLDR Builder Challenge — Cycle 4**

---

## The Pitch

Most storage-agent submissions are "top-up bots" — watch a number, refill it when low. That's a threshold trigger, not a decision. ProofMarket is a triage economist: it holds two real datasets of different declared value, and when money gets tight it has to actually choose between them — and justify the call.

The judging rubric explicitly says an agent that "stores and pays but never decides anything" scores zero on the biggest line item. ProofMarket decides.

---

## What It Does

1. **Reads real onchain state** — USDFC balance and `runwayInEpochs` from Filecoin Pay via the Synapse SDK.
2. **Runs a decision loop** — when runway drops below threshold, compares two datasets on user-assigned `declared_value` and pauses the lower-priority one.
3. **Executes a real onchain pause** — stops the payment rail for the chosen dataset via Warm Storage / Synapse.
4. **Generates an LLM explanation** — Claude (via OpenRouter) receives the real numbers and writes one paragraph explaining the specific trade-off for this portfolio.
5. **Logs every decision** — timestamped JSON record with inputs, outcome, reasoning, and transaction hashes.

---

## Real vs. Simulated

| Data | Source | Notes |
|------|--------|-------|
| USDFC balance | Filecoin Pay (real) | Read via Synapse SDK every check |
| Runway in epochs | Filecoin Pay (real) | `accountSummary().runwayInpochs` |
| Lockup rate per epoch | Filecoin Pay (real) | `accountSummary().lockupRatePerEpoch` |
| Per-dataset rail rate | Onchain rail (real) | Queried via `getRail().paymentRate` |
| Dataset pause / resume | Warm Storage (real) | Actual termination and re-upload transactions |
| `declared_value` | User input (simulated) | Simple priority number, labeled honestly in UI |
| Cost-per-epoch in `datasets.json` | Simulated (display only) | Decision logic uses real rail rates, not this field |

**The decision logic uses only real onchain numbers.** `declared_value` is the only simulated input, and it is used solely for priority ranking — never for epoch or cost math.

---

## Architecture

```
┌────────────────────┐        ┌───────────────────────────┐
│  Vite + React      │◄──────►│  Node/TS Backend           │
│  Dashboard         │  poll  │  - Synapse SDK client       │
│  - balance/runway  │        │  - Real rail-rate queries   │
│  - dataset cards   │        │  - Decision loop            │
│  - decision log    │        │  - LLM explanation          │
│  - "Check Now"     │        │  - Onchain pause/resume     │
│  - Verification    │        │  - JSON audit log           │
└────────────────────┘        └───────────┬───────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
           Filecoin Pay           Warm Storage PDP          Anthropic API
        (USDFC balance,         (upload / pause /         (one call per
         runway — real)          re-upload — real)         decision cycle)
```

### Backend modules

| File | Responsibility |
|------|----------------|
| `src/paymentsClient.ts` | Creates Synapse client, reads `accountSummary()` (balance, runway, lockup rate) |
| `src/decisionLoop.ts` | Loads datasets, queries per-dataset rail rates via `getRail`, computes triage/resume outcomes using real SDK values |
| `src/explain.ts` | Formats wei → USDFC, builds Claude prompt, returns explanation or rules-based fallback |
| `src/intervention.ts` | Executes real pause (terminate rail) and resume (re-upload piece, create new dataset deal) |
| `src/index.ts` | Express API: `/api/check`, `/api/act`, `/api/verify-pause/:id`, `/api/resume`, `/api/account`, `/api/datasets`, `/api/decisions`, `/api/interventions` |

### Frontend pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Project overview and links |
| `/demo` | Live Demo | Dashboard with live balance, runway, outcome badge, dataset cards, decision log, Claude explanation |
| `/verification` | Verification | Onchain transaction history, dataset IDs, piece CIDs, provider checks |
| `/architecture` | Architecture | REAL vs. SIMULATED data lineage, system diagram |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Storage + payments | `@filoz/synapse-sdk` (TypeScript) on Filecoin Calibration testnet |
| Backend | Node.js + Express + `tsx` |
| Frontend | Vite + React + Tailwind CSS |
| Reasoning | Anthropic Claude via OpenRouter |
| Types | TypeScript, strict mode |
| State/logs | JSON files (`data/datasets.json`, `data/decisions.json`, `data/interventions.json`) |

---

## Getting Started

### Prerequisites

- Node.js >= 20
- USDFC on Filecoin Calibration testnet
- OpenRouter API key (for Claude explanations)
- Synapse SDK private key

### Setup

```bash
# Backend
cd backend
cp .env.example .env
# Fill in OPENROUTER_API_KEY, SYNAPSE_PRIVATE_KEY
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:3001`.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Anthropic API key via OpenRouter |
| `SYNAPSE_PRIVATE_KEY` | Wallet key for Calibration testnet |
| `TRIAGE_THRESHOLD_EPOCHS` | Runway threshold for triage (default: `100000000`) |
| `RESUME_MARGIN_EPOCHS` | Safety margin for resume (default: `10000000`) |

---

## Demo Script

1. **0:00–0:15** — Show dashboard: two datasets active, real balance and runway ticking.
2. **0:15–0:45** — Let runway drain toward threshold. Point at the live chain-verification readout to prove it's a real onchain read.
3. **0:45–1:20** — Threshold crossed. Dashboard shows the agent comparing A vs B, the chosen action executes for real. Read the Claude-generated explanation out loud.
4. **1:20–1:40** — Prove it's real: the paused dataset is no longer accessible on its provider rail.
5. **1:40–2:00** — Decision log / audit trail. Close on the architecture diagram, explicitly naming what's real vs. simulated.

---

## How the Decision Works

The decision loop runs on every `/api/check` hit (manual button or polling):

1. Read `accountSummary()` from Synapse SDK → get `balance`, `runwayInpochs`, `lockupRatePerEpoch`.
2. Query each dataset's real rail rate via `getRail(pdpRailId)`.
3. If `runwayInEpochs < threshold` and both datasets active → **CRITICAL**.
   - Sort by `declared_value`, pause the lower one.
   - Log the choice, generate Claude explanation.
4. If one dataset paused and `runway` recovered → **RESUME check**.
   - Project new runway if the paused dataset's rail rate were re-added.
   - If projected runway stays above threshold + margin → `resume_safe`.
   - If above threshold but below margin → `resume_available`.
   - Otherwise → `resume_insufficient`.
5. Otherwise → **HEALTHY**. No action needed.

**Key invariant:** the numbers in the dashboard, the decision logic, and the Claude explanation are always the same numbers. There is no parallel "simulated cost model" — the real onchain `lockupRatePerEpoch` and per-dataset rail rates are the sole source of truth for epoch math.

---

## Known Limitations

- `declared_value` is a user-set priority input, not an onchain metric. It is labeled honestly in the UI and README.
- Resume on Warm Storage is not a reactivation of the original terminated rail — it creates a new dataset deal and re-uploads the piece. This is a limitation of the Synapse SDK / Warm Storage contract, not a design choice.
- The real onchain lockup rate is far lower than the original simulated cost model (~0.000002 USDFC/epoch combined vs. the earlier 0.0254 USDFC/epoch estimate). The thresholds were recalibrated to 100M / 10M epochs to match real-world scale.

---

## License

MIT
