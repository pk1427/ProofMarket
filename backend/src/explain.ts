import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-sonnet-4-6'

export type ExplanationInput = {
  outcome: 'healthy' | 'critical'
  balance: string
  runway: string
  lockupRate: string
  currentEpoch: string
  totalCostPerEpoch: string
  remainingEpochs: string
  threshold: string
  protectedDataset: string | null
  pausedDataset: string | null
  reason: string
  datasets: Array<{
    name: string
    declaredValue: number
    costPerEpoch: string
  }>
}

function getOpenRouterKey(): string | null {
  return process.env.OPENROUTER_API_KEY ?? null
}

export async function generateExplanation(input: ExplanationInput): Promise<string> {
  const apiKey = getOpenRouterKey()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set')
  }

  const prompt = `You are an autonomous storage budget triage agent. Explain the following decision in one short paragraph.

Balance: ${input.balance} wei
Runway: ${input.runway} epochs
Lockup rate: ${input.lockupRate} wei/epoch
Current epoch: ${input.currentEpoch}
Total cost/epoch: ${input.totalCostPerEpoch} wei
Remaining epochs: ${input.remainingEpochs}
Threshold: ${input.threshold} epochs

Datasets:
${input.datasets.map(d => `- ${d.name}: declared_value=${d.declaredValue}, cost/epoch=${d.costPerEpoch} wei (SIMULATED user-set priority, NOT onchain)`).join('\n')}

Decision: ${input.outcome === 'critical' ? `Protected ${input.protectedDataset} and paused ${input.pausedDataset}.` : 'No action needed.'}

${input.reason}

Write one paragraph explaining the trade-off. Explicitly name both datasets and state why the protected one was worth keeping over the other. Do not say "runway is low" generically — be specific about this portfolio. Keep it under 120 words.`

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenRouter request failed: ${response.status} ${text}`)
  }

  const data = (await response.json()) as any
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Unexpected OpenRouter response shape')
  return text.trim()
}

export function generateFallbackExplanation(input: ExplanationInput): string {
  if (input.outcome === 'healthy') {
    return `Account is healthy with ${input.remainingEpochs} epochs of runway remaining against a ${input.threshold}-epoch threshold. Both ${input.datasets[0]?.name ?? 'dataset A'} and ${input.datasets[1]?.name ?? 'dataset B'} remain active; no triage action is required at this time.`
  }

  const protected_ = input.protectedDataset ?? 'unknown'
  const paused_ = input.pausedDataset ?? 'unknown'

  return `Runway has fallen to ${input.remainingEpochs} epochs, below the ${input.threshold}-epoch threshold. ` +
    `The agent triaged the portfolio and chose to protect ${protected_} while pausing ${paused_}. ` +
    `This preserves the higher-priority dataset and stops accruing further storage cost on the lower-priority one.`
}
