# PROOFMARKET
### Autonomous Storage Budget Triage
**FilecoinTLDR Builder Challenge — Cycle 4 | FINAL BUILD DOCUMENT**

---

## 1. The Idea

**One-line pitch:**
> An agent that reads its own USDFC balance and Filecoin Pay runway, and when runway gets tight, chooses **which of two datasets to protect and which to pause** — then has an LLM explain the trade-off in plain language.

**The reframe that makes this stand out:**
Not "can I afford storage." **Which of my holdings is worth protecting.**

Most submissions to this cycle will be "top-up bots" — watch a number, refill it when low. That's a threshold trigger, not a decision, and the judging rubric explicitly says an agent that "stores and pays but never decides anything" scores zero on the biggest line item. ProofMarket is a triage economist: it holds two real datasets of different declared value, and when money gets tight it has to actually choose between them — and justify the call.

**Why two datasets, not one:**
A single-dataset "keep it alive or don't" loop isn't a real decision — there's nothing to choose *against*, so the one dataset survives by default. Two datasets, each with a declared value, turns the same amount of engineering into a genuine trade-off: **protect A, pause/drop B, and say why.** Everything beyond this (a third dataset, a demand simulator, a full reallocation optimizer) is upside if time allows — not required to tell the story.

---

## 2. Core Mechanics

### 2.1 The portfolio
Two datasets, uploaded for real via Synapse SDK to Warm Storage before the demo:

| Dataset | Example label | `declared_value` | Size |
|---|---|---|---|
| A | `customer-model-v3` | high (e.g. 9/10) | small–medium |
| B | `raw-sensor-archive` | low (e.g. 3/10) | larger, if convenient |

`declared_value` is a simple user-set priority number, not fabricated telemetry — labeled honestly in the UI as "priority" so there's zero ambiguity about what's real onchain state vs. what's a design input.

### 2.2 Cost model (explicitly simulated — say so in the README)
Fixed cost per epoch per dataset (e.g. `0.001 USDFC/epoch`, scaled by size). This is a deliberate simplification. The numbers that actually matter — USDFC balance and runway — are read live from Filecoin Pay, never simulated.

### 2.3 The decision loop (this is the entire pitch)
On a timer, or a "Check Now" button on the dashboard:

1. **Read** real `balance` and `runwayInEpochs` from Filecoin Pay via the Synapse SDK's `PaymentsService`.
2. **Compute** `remaining_epochs = floor(runway / total_cost_per_epoch)`.
3. If `remaining_epochs` is above threshold → **Healthy**. Log "no action needed," both datasets stay active.
4. If below threshold → **Triage**. Compare A and B on `declared_value`, pick the lower one, and either:
   - **Pause** it (stop paying for it going forward — reject its next epoch's cost), or
   - **Drop it** (real Warm Storage removal) — pick whichever you can make reliable by Day 6, don't build both.
5. **Send the decision context to Claude** (balance, runway, both datasets' values and costs, the chosen action) and get back one paragraph explaining the trade-off.
6. **Log** the full decision — inputs, action, reasoning — to a visible, timestamped record on the dashboard.

### 2.4 Why this clears the "is it real" bar
- Balance and runway: real onchain reads, every single check.
- The paused/dropped dataset really stops being served/stored — proven live by attempting to access/upload against it post-decision and showing the rejection.
- `declared_value` and cost-per-epoch are explicitly labeled as inputs, not blockchain-derived data. This is stated up front in the UI and README, not defended after the fact.

---

## 3. Architecture

```
┌────────────────────┐        ┌───────────────────────────┐
│  Vite + React        │◄──────►│  Node/TS Agent Backend      │
│  Dashboard            │  poll  │  - Synapse SDK client        │
│  - balance/runway     │        │  - PaymentsService reads     │
│  - 2 dataset cards     │        │  - Storage pause/drop op     │
│  - decision log        │        │  - Decision loop              │
│  - LLM explanation     │        │  - Chain-verification view    │
│  - "Check Now" button  │        │    data (txn ref, epoch)      │
└────────────────────┘        └───────────┬───────────────┘
                                                │
                        ┌──────────────────────┼──────────────────────┐
                        ▼                      ▼                      ▼
                 Filecoin Pay          Warm Storage (PDP)      Anthropic API
              (USDFC balance,        (upload / pause /         (one call: decision
               runway — real)         drop dataset — real)      reasoning, plain text)
```

**On-chain proof, without depending on a live block explorer:**
Rather than tabbing to a possibly slow/unreliable public explorer mid-demo, the dashboard itself renders a small "chain-verification" readout pulled straight from the SDK response:
```
Balance: 4.82 USDFC   (txn: 0xa1b2...  epoch: 118,204)
Runway:  6 epochs      (deficit at epoch: 118,210)
```
This is faster, more reliable live, and just as convincing — the numbers are pulled from the real read, just displayed inline instead of requiring a second browser tab.

---

## 4. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Storage + payments | `@filoz/synapse-sdk` (TypeScript) | Calibration testnet. High-level `Synapse` class → `PaymentsService` (balance/runway reads) + `StorageManager` (upload/pause/drop) |
| Backend | Node.js / Express (or Next.js API routes) | Hosts the decision loop, wraps SDK calls, calls Claude |
| Frontend | Vite + React, Tailwind | Single-page dashboard, polls backend or uses simple WS |
| Reasoning layer | Anthropic API (Claude) | One call per decision cycle, structured input → prose explanation out. Numerical decision logic stays authoritative in code — Claude explains, it doesn't decide. |
| Funding | USDFC Calibration testnet faucet + a small re-fund script | Faucets have cooldowns — script this early, don't rely on manual re-claims |
| Decision log | JSON file or SQLite | Timestamped record of every check, decision, and reasoning string |
| Fallback | Rules-based explanation generator | Kicks in if the Claude call fails — demo never breaks on an external API hiccup |

---

## 5. Implementation Plan (12 days)

| Day | Focus | Deliverable |
|---|---|---|
| **0 (today)** | Hard gate | Confirm Calibration testnet access: faucet claim succeeds, a live balance read comes back via a throwaway script. **Do not proceed past Day 2 until this works.** If testnet access is unreliable, resolve it immediately — never substitute a mocked balance/runway in the real demo, since that directly fails the 20% "not simulated" criterion. |
| **1** | Environment & primitives | Node + Vite scaffolded. Read-only wrapper for USDFC balance and `runwayInEpochs` via Synapse SDK. Confirm both return real live numbers from a script. |
| **2** | Upload & track two datasets | Upload **A and B** for real via Synapse SDK. Store dataset IDs + `declared_value` + cost-per-epoch locally. Console prints: "Dataset A stored. Cost/epoch = X. Dataset B stored. Cost/epoch = Y." |
| **3** | Triage decision loop | Loop reads balance/runway, computes `remaining_epochs`, and — when below threshold — **compares A vs B and picks the lower-value one to act on.** Log the comparison and the choice (not just the outcome). |
| **4** | LLM explanation | On each triage trigger, call Claude once with balance, runway, both datasets' value/cost, and the chosen action. Get back one paragraph naming the trade-off explicitly (e.g. "protected A over B because..."). |
| **5** | Dashboard UI | Vite/React page: live balance + runway, two dataset cards (size, cost/epoch, remaining epochs, status: active/paused), decision log panel, LLM explanation shown prominently, inline chain-verification readout (§3). |
| **6** | Real intervention | Implement the actual pause/drop on the lower-value dataset — no new uploads/served requests for it once paused. Verify: attempting to access/upload against it returns a clear rejection message. Dashboard reflects the state change live. |
| **7** | Calibrate the demo runway | Fund the account so runway visibly drains to the trigger threshold within a 2–3 minute demo window. Test 3+ times for reliability; record the exact funding amount. Write the re-fund script (faucet cooldowns — don't rely on manual re-claims between rehearsals). |
| **8** | Full run-through + fixes | End-to-end pass: fund → both datasets active → runway drains → triage fires → correct dataset paused/dropped → dashboard + explanation update → verify rejection. Fix every seam that breaks. |
| **9** | Hardening | Rules-only fallback if the Claude call fails. Handle failed transactions honestly (mark pending/failed, never fake success). Document (not necessarily build) a "top-up" action as a third option alongside pause/drop, to cover the full "top up / cut / decide what's worth keeping" spectrum from the brief in the README, even if unbuilt. |
| **10** | README + architecture diagram | Write the "what's real vs. simulated" section explicitly: balance/runway/actions = real; `declared_value`/cost-per-epoch = simulated inputs, labeled as such in the UI. |
| **11** | AI build log + X post draft | Dedicated day for the explicitly-graded, easy-to-forget deliverables. Draft the build log (your Claude Code / co-pilot usage) and the X post text. |
| **12** | Record demo + submit | Record the 2-minute demo (script below). Final polish. Submit early, not at the deadline. |

**If ahead of schedule after Day 8**, safe upside additions in order: a third dataset (richer comparison), a manual "priority" slider judges can move live during Q&A, actually building (not just documenting) the top-up action.

---

## 6. Demo Script (2 minutes)

1. **0:00–0:15** — "Most storage agents ask whether they can afford storage. This one decides which of its holdings is worth protecting." Show dashboard: two datasets, both active, real balance and runway ticking.
2. **0:15–0:45** — Let (or force) runway drain toward the threshold. Point at the live chain-verification readout — balance, txn ref, epoch — to show it's a real onchain read, not a UI fake.
3. **0:45–1:20** — The moment: threshold crossed. Dashboard shows the agent comparing A vs B, the chosen action executes for real. Read the Claude-generated explanation out loud.
4. **1:20–1:40** — Prove it's real: attempt to access/upload against the paused dataset, show the agent's rejection message.
5. **1:40–2:00** — Decision log / audit trail, close on the architecture diagram, name explicitly what's real vs. simulated.

---

## 7. Judging Criteria Mapping

| Criterion | Weight | How this plan hits it |
|---|---|---|
| Autonomous budget decisions | 30% | Real comparison between two competing datasets, live threshold crossing, an actual chosen-and-executed action with stated reasoning — not a single dataset surviving by default. |
| Working demo quality | 25% | Small, reliable scope: one loop, one real intervention, tested 3+ times for timing. Fewer moving parts = fewer ways to break on stage. |
| Meaningful use of Filecoin | 20% | Real Synapse SDK storage ops for both datasets, real `PaymentsService` balance/runway reads, real pause/drop action verified by a failed access attempt afterward. |
| Clarity + showcase | 15% | Single, focused LLM explanation per decision; UI explicitly labels real vs. simulated data; concise README and demo script built around one clear moment. |

---

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Only one dataset ever gets triaged, decision feels obvious in hindsight | Pick declared values close enough that the trade-off needs explaining, not so lopsided it's trivial — tune before the demo, not live. |
| Runway drain timing unreliable | Day 7 is dedicated to calibration; test repeatedly, record the exact funding amount. |
| Claude call fails mid-demo | Rules-based fallback explanation always available (Day 9). |
| Judges question whether `declared_value` is "real" | Label it explicitly as a user-set priority input, in both UI and demo narration. |
| Faucet cooldown blocks re-funding between rehearsals | Small re-fund script written Day 7; don't depend on manual faucet claims the night before. |
| Calibration testnet flaky or inaccessible | Resolve before Day 3 — hard gate, not a fallback scenario. Never substitute a mocked balance/runway in the actual demo. |
| Public block explorer slow/unreliable mid-demo | Use the inline chain-verification readout (§3) instead of tabbing away — faster, just as convincing. |

---

## 9. Submission Checklist

- [ ] Project title + one-line pitch
- [ ] Live demo link
- [ ] Repo link with README (architecture diagram, real-vs-simulated section, demo script)
- [ ] Explanation of Filecoin usage (Synapse SDK, Filecoin Pay `PaymentsService`, Warm Storage, USDFC)
- [ ] AI build log (Claude Code / co-pilot usage — expected and rewarded, don't hide it)
- [ ] Public X post with demo video, posted before Sep 6

---

## 10. Immediate Next Action

**Today, before anything else:** get Calibration testnet USDFC from the faucet and run a throwaway script that reads real balance and `runwayInEpochs`. This is the hard gate from §5 — nothing else in this plan matters until that number is confirmed real and readable.

---

## 11. Git Workflow Rule (non-negotiable)
Never commit or push directly to main. Not once, not "just this small fix" — no exceptions.
Always ask before every commit and every push, regardless of branch. State what's about to be committed/pushed and wait for explicit confirmation before running the command.
Create a new branch at every phase change in the plan above (e.g. moving from Step 2 → Step 3, from primitives → decision loop, from decision loop → dashboard, from dashboard → real intervention, etc.). One branch per phase, not one branch for the whole project.
Suggested branch naming: phase/<short-name>, e.g. phase/hard-gate, phase/fund-and-upload, phase/triage-loop, phase/llm-explanation, phase/dashboard, phase/real-intervention, phase/calibration, phase/hardening.
Merges into main only happen when explicitly requested and confirmed — treat main as the protected, demo-stable branch throughout the build, not a working branch.
This applies to Kilo Code (or any coding agent) as much as to manual work — the agent must ask before running git commit or git push, on any branch, every time.