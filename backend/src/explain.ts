import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-sonnet-4-6'
const WEI_PER_USDFC = 10n ** 18n

export function weiToUSDFC(wei: string | bigint | number, fractionDigits = 6): string {
  const value = BigInt(wei)
  if (value === 0n) return '0'
  const whole = value / WEI_PER_USDFC
  const remainder = value % WEI_PER_USDFC
  const fraction = Number(remainder * 10n ** BigInt(fractionDigits)) / Number(WEI_PER_USDFC)
  const formatted = fraction.toFixed(fractionDigits).replace(/0+$/, '').replace(/\.$/, '')
  return formatted ? `${whole.toString()}.${formatted}` : whole.toString()
}

export type ExplanationInput = {
  outcome: 'healthy' | 'critical' | 'resume_safe' | 'resume_available' | 'resume_insufficient'
  balance: string
  runway: string
  lockupRate: string
  currentEpoch: string
  totalCostPerEpoch: string
  remainingEpochs: string
  threshold: string
  protectedDataset: string | null
  pausedDataset: string | null
  resumeCandidate: string | null
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

Balance: ${weiToUSDFC(input.balance)} USDFC
Runway: ${input.runway} epochs (REAL onchain value from Filecoin Pay)
Lockup rate: ${weiToUSDFC(input.lockupRate)} USDFC/epoch (REAL onchain rate)
Current epoch: ${input.currentEpoch}
Total cost/epoch: ${weiToUSDFC(input.totalCostPerEpoch)} USDFC (sum of real per-dataset rail rates)
Remaining epochs: ${input.remainingEpochs}
Threshold: ${input.threshold} epochs

Datasets (priority ranking only — declared_value is simulated user input, NOT onchain):
${input.datasets.map(d => `- ${d.name}: declared_value=${d.declaredValue}`).join('\n')}

Decision: ${
  input.outcome === 'critical'
    ? `Protected ${input.protectedDataset} and paused ${input.pausedDataset}.`
    : input.outcome === 'resume_safe'
      ? `Resuming ${input.resumeCandidate} is safe.`
      : input.outcome === 'resume_available'
        ? `Resuming ${input.resumeCandidate} is possible but without safety margin.`
        : input.outcome === 'resume_insufficient'
          ? `Resuming ${input.resumeCandidate} is not safe yet.`
          : 'No action needed.'
}

${input.reason}

Write one paragraph explaining the trade-off. Explicitly name the datasets involved and state the reasoning. Do not say "runway is low" generically — be specific about this portfolio. Keep it under 120 words.`

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

  if (input.outcome === 'resume_safe') {
    return `Runway has recovered to ${input.remainingEpochs} epochs. Resuming ${input.resumeCandidate ?? 'the paused dataset'} is safe because the projected runway after resume stays well above the ${input.threshold}-epoch threshold with margin.`
  }

  if (input.outcome === 'resume_available') {
    return `Runway has recovered to ${input.remainingEpochs} epochs. Resuming ${input.resumeCandidate ?? 'the paused dataset'} is possible, but the projected runway would sit just above the ${input.threshold}-epoch threshold without the usual safety margin.`
  }

  if (input.outcome === 'resume_insufficient') {
    return `Runway has recovered to ${input.remainingEpochs} epochs, but that is still insufficient to safely resume ${input.resumeCandidate ?? 'the paused dataset'}. Projected remaining after resume would fall below the ${input.threshold}-epoch threshold.`
  }

  const protected_ = input.protectedDataset ?? 'unknown'
  const paused_ = input.pausedDataset ?? 'unknown'

  return `Runway has fallen to ${input.remainingEpochs} epochs, below the ${input.threshold}-epoch threshold. ` +
    `The agent triaged the portfolio and chose to protect ${protected_} while pausing ${paused_}. ` +
    `This preserves the higher-priority dataset and stops accruing further storage cost on the lower-priority one.`
}
