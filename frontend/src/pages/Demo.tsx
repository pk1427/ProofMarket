import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { useSwitchChain } from 'wagmi'
import { createPublicClient, http } from 'viem'
import * as Pay from '@filoz/synapse-core/pay'
import type { AccountState, Dataset, DecisionResult, InterventionResult, TransactionEntry } from '../types'
import { Navbar } from '../components/Navbar'
import { getSynapseForWallet, usdfcToWei, createDemoDataset, pauseDatasetViaWallet, resumeDatasetViaWallet } from '../synapseClient'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { TOKENS } from '@filoz/synapse-sdk'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

function formatWei(wei: string, decimals = 18) {
  const value = Number(wei) / 10 ** decimals
  if (value === 0) return '0'
  if (value < 0.001) return '<0.001'
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals > 6 ? 6 : decimals })
}

function SimulatedBadge() {
  return (
    <span className="badge badge-warning ml-1.5">Simulated</span>
  )
}

function RealBadge() {
  return (
    <span className="badge badge-healthy ml-1.5">
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Onchain
    </span>
  )
}

function ExplorerLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-brand-700 hover:text-brand-500 transition font-mono text-xs ${className || ''}`}
    >
      {children}
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

function shortenHash(hash: string, head = 6, tail = 4) {
  if (hash.length <= head + tail) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

export default function Demo() {
  const { address, isConnected, chain, connector } = useAccount()
  const { data: wagmiWalletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { switchChain } = useSwitchChain()
  const useWallet = isConnected && Number(chain?.id) === Number(calibrationChain.id)
  const [walletClient, setWalletClient] = useState<any>(wagmiWalletClient)

  const [account, setAccount] = useState<AccountState | null>(null)
  const [depositAmount, setDepositAmount] = useState('10')
  const [withdrawAmount, setWithdrawAmount] = useState('5')
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [latestDecision, setLatestDecision] = useState<DecisionResult | null>(null)
  const [, setDecisions] = useState<DecisionResult[]>([])
  const [, setInterventionsList] = useState<InterventionResult[]>([])
  const [transactions, setTransactions] = useState<TransactionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, { accessible: boolean; message: string }>>({})

  const fetchAccount = useCallback(async () => {
    if (isConnected && address) {
      try {
        const client = createPublicClient({
          chain: calibrationChain,
          transport: http('https://api.calibration.node.glif.io/rpc/v1'),
        })
        const summary = await Pay.getAccountSummary(client as any, {
          address: address as `0x${string}`,
          token: '0xb3042734b608a1b16e9e86b374a3f3e389b4cdf0' as `0x${string}`,
        })
        setAccount({
          balance: summary.availableFunds.toString(),
          runway: summary.runwayInEpochs.toString(),
          lockupRate: summary.lockupRatePerEpoch.toString(),
          currentEpoch: summary.epoch.toString(),
        })
        setError(null)
        return
      } catch (err) {
        console.error('[fetchAccount] via address failed:', err)
        setError(`Wallet read failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    const res = await fetch(`${API_BASE}/api/account`)
    if (!res.ok) throw new Error('Failed to fetch account')
    const data = await res.json()
    setAccount(data)
  }, [isConnected, address])

  const fetchDatasets = useCallback(async () => {
    if (useWallet && address) {
      try {
        const res = await fetch(`${API_BASE}/api/datasets?address=${address}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setDatasets(data)
            return
          }
        }
      } catch {}
      try {
        const key = `pm-datasets-${address.toLowerCase()}`
        const stored = localStorage.getItem(key)
        if (stored) {
          const data = JSON.parse(stored)
          if (Array.isArray(data)) {
            setDatasets(data)
            return
          }
        }
      } catch {}
      setDatasets([])
      return
    }
    const res = await fetch(`${API_BASE}/api/datasets`)
    if (!res.ok) throw new Error('Failed to fetch datasets')
    const data = await res.json()
    setDatasets(data)
  }, [useWallet, address])

  const fetchDecisions = useCallback(async () => {
    if (useWallet) {
      setDecisions([])
      setLatestDecision(null)
      return
    }
    const res = await fetch(`${API_BASE}/api/decisions`)
    if (!res.ok) throw new Error('Failed to fetch decisions')
    const data = await res.json()
    setDecisions(data)
    setLatestDecision(data[data.length - 1] ?? null)
  }, [useWallet])

  const fetchInterventions = useCallback(async () => {
    if (useWallet) {
      setInterventionsList([])
      return
    }
    const res = await fetch(`${API_BASE}/api/interventions`)
    if (!res.ok) throw new Error('Failed to fetch interventions')
    const data = await res.json()
    setInterventionsList(data)
  }, [useWallet])

  const refreshAll = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([fetchAccount(), fetchDatasets(), fetchDecisions(), fetchInterventions()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [fetchAccount, fetchDatasets, fetchDecisions, fetchInterventions])

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchAccount()
      if (useWallet) {
        const acct = account
        if (!acct) {
          setError('Account not loaded yet')
          return
        }
        const balance = BigInt(acct.balance)
        const lockup = BigInt(acct.lockupRate)
        const runwayNum = lockup > 0n ? Number(balance / lockup) : 0
        const THRESHOLD = 100_000_000
        const active = datasets.filter((d) => d.status === 'active')
        const paused = datasets.filter((d) => d.status === 'paused')
        const balanceUSDFC = Number(balance) / 1e18
        const lockupUSDFC = Number(lockup) / 1e18
        let outcome: DecisionResult['outcome'] = 'healthy'
        let reason = ''
        let explanation = ''
        let protectedDataset: string | null = null
        let pausedDataset: string | null = null
        let resumeCandidate: string | null = null

        if (lockup === 0n && datasets.length === 0) {
          outcome = 'healthy'
          reason = 'No active storage lockups on this account. Click "Create Demo Datasets" to spin up a portfolio.'
          explanation = `Your wallet currently has no active storage on the Filecoin Pay contract. Total Filecoin Pay balance is ${balanceUSDFC.toFixed(4)} USDFC, with a lockup rate of 0 USDFC/epoch. To start monitoring, click **Create Demo Datasets** to spin up two test datasets (one high-value, one low-value) and watch the triage engine react to changing runway.`
        } else if (active.length > 1 && runwayNum < THRESHOLD) {
          const sorted = [...active].sort((a, b) => b.declaredValue - a.declaredValue)
          const higher = sorted[0]
          const lower = sorted[1]
          protectedDataset = higher.name
          pausedDataset = lower.name
          outcome = 'critical'
          reason = `Runway ${runwayNum.toLocaleString()} epochs is below threshold ${THRESHOLD.toLocaleString()}. Protected ${higher.name} (declared_value=${higher.declaredValue}) over ${lower.name} (declared_value=${lower.declaredValue}) by priority.`
          explanation = `With only ${runwayNum.toLocaleString()} epochs of runway against a ${THRESHOLD.toLocaleString()}-epoch safety threshold, this storage portfolio can no longer sustain all ${active.length} active datasets at the combined lockup rate of ${lockupUSDFC.toFixed(6)} USDFC/epoch. The triage engine prioritizes **${higher.name}** (declared value: ${higher.declaredValue}) and recommends pausing **${lower.name}** (declared value: ${lower.declaredValue}) — roughly a third of the priority — to extend coverage of the higher-value asset. Pausing frees its share of the per-epoch burn, projecting runway back above the safety margin.`
        } else if (active.length <= 1 && paused.length > 0) {
          resumeCandidate = paused[0].name
          pausedDataset = paused[0].name
          outcome = runwayNum < THRESHOLD ? 'resume_insufficient' : 'resume_safe'
          reason = outcome === 'resume_insufficient'
            ? `Runway ${runwayNum.toLocaleString()} epochs is still below threshold. Cannot resume ${paused[0].name} yet.`
            : `Runway ${runwayNum.toLocaleString()} epochs is above threshold. Safe to resume ${paused[0].name}.`
          explanation = outcome === 'resume_insufficient'
            ? `Runway has recovered to ${runwayNum.toLocaleString()} epochs but that is still insufficient to safely resume **${paused[0].name}**. Reactivating it at ${lockupUSDFC.toFixed(6)} USDFC/epoch would push runway below the ${THRESHOLD.toLocaleString()}-epoch safety floor. Wait for more deposits or for the current lockup rate to settle.`
            : `Runway has recovered to ${runwayNum.toLocaleString()} epochs — above the ${THRESHOLD.toLocaleString()}-epoch safety threshold. The triage engine flags **${paused[0].name}** as safe to resume: bringing it back online would still leave the portfolio above the safety margin.`
        } else if (active.length > 0) {
          outcome = 'healthy'
          reason = `Runway ${runwayNum.toLocaleString()} epochs is above threshold ${THRESHOLD.toLocaleString()}. No action needed.`
          explanation = `Your wallet is in a healthy state. **${active.length}** active dataset${active.length > 1 ? 's' : ''} running at a combined lockup rate of ${lockupUSDFC.toFixed(6)} USDFC/epoch, with ${runwayNum.toLocaleString()} epochs of runway against the ${THRESHOLD.toLocaleString()}-epoch safety threshold. No triage action needed — the priority queue is fully covered.`
        } else {
          outcome = 'healthy'
          reason = 'No active storage and no paused datasets. No triage needed.'
          explanation = `Your account has no active or paused datasets in this UI. The current Filecoin Pay balance of ${balanceUSDFC.toFixed(4)} USDFC is sitting unused.`
        }

        const decision: DecisionResult = {
          timestamp: new Date().toISOString(),
          outcome,
          balance: acct.balance,
          runway: acct.runway,
          lockupRate: acct.lockupRate,
          currentEpoch: acct.currentEpoch,
          totalCostPerEpoch: acct.lockupRate,
          remainingEpochs: String(runwayNum),
          threshold: String(THRESHOLD),
          protectedDataset,
          pausedDataset,
          resumeCandidate,
          reason,
          explanation,
        }
        setLatestDecision(decision)
        return
      }
      const res = await fetch(`${API_BASE}/api/check`)
      if (!res.ok) throw new Error('Check failed')
      const decision = await res.json()
      setLatestDecision(decision)
      setDecisions((prev) => [...prev, decision])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setLoading(false)
    }
  }

  const runDeposit = async (amountUSDFC: string) => {
    const entry: TransactionEntry = {
      id: `dep-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'deposit',
      label: `Top up ${amountUSDFC} USDFC`,
      amountUSDFC,
      status: 'pending',
    }
    setTransactions((prev) => [entry, ...prev])
    setLoading(true)
    setError(null)
    try {
      const amountWei = usdfcToWei(amountUSDFC)
      if (useWallet && walletClient) {
        const synapse = await getSynapseForWallet(walletClient)
        const warmStorageAddress = calibrationChain.contracts.fwss.address as `0x${string}`
        const approveHash = await synapse.payments.approveService({
          service: warmStorageAddress,
          rateAllowance: amountWei,
          lockupAllowance: amountWei,
          maxLockupPeriod: 100_000n,
          token: TOKENS.USDFC,
        })
        const depositHash = await synapse.payments.deposit({
          amount: amountWei,
          token: TOKENS.USDFC,
        })
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: 'pending',
          txHash: depositHash,
          detail: `Approve ${approveHash.slice(0, 6)}…${approveHash.slice(-4)} · submitted, awaiting confirmation`,
        } : t))
        Promise.all([
          (publicClient as any)?.waitForTransactionReceipt?.({ hash: approveHash as `0x${string}` }),
          (publicClient as any)?.waitForTransactionReceipt?.({ hash: depositHash as `0x${string}` }),
        ]).then(async (receipts) => {
          const [, d] = receipts
          setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
            ...t,
            status: 'completed',
            txHash: depositHash,
            detail: `Approve ${approveHash.slice(0, 6)}…${approveHash.slice(-4)} · block ${d?.blockNumber?.toString?.() ?? '?'}`,
          } : t))
          await fetchAccount()
        }).catch((err) => {
          console.warn('[deposit] receipt wait failed:', err)
        })
      } else {
        const res = await fetch(`${API_BASE}/api/deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amountWei.toString() }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Deposit failed' }))
          throw new Error(err.error || 'Deposit failed')
        }
        const data = await res.json()
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: 'completed',
          txHash: data.depositTxHash,
          detail: `Approve ${data.approveTxHash?.slice(0, 6)}…${data.approveTxHash?.slice(-4)} · block ${data.depositBlockNumber}`,
        } : t))
        await fetchAccount()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deposit failed'
      setTransactions((prev) => prev.map((t) => t.id === entry.id ? { ...t, status: 'failed', error: msg } : t))
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const runWithdraw = async (mode: string) => {
    const amountLabel = mode === 'all' ? 'Withdraw to critical' : 'Withdraw 100 USDFC'
    const entry: TransactionEntry = {
      id: `wd-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'withdraw',
      label: amountLabel,
      status: 'pending',
    }
    setTransactions((prev) => [entry, ...prev])
    setLoading(true)
    setError(null)
    try {
      let amountWei: bigint
      if (mode === 'all') {
        const summary = await fetch(`${API_BASE}/api/account`).then((r) => r.json())
        const targetBalance = 220_000_000_000_000_000_000n
        const currentBalance = BigInt(summary.balance)
        amountWei = currentBalance > targetBalance ? currentBalance - targetBalance : 0n
      } else {
        amountWei = usdfcToWei(mode)
      }

      if (useWallet && walletClient && amountWei > 0n) {
        const synapse = await getSynapseForWallet(walletClient)
        const txHash = await synapse.payments.withdraw({
          amount: amountWei,
          token: TOKENS.USDFC,
        })
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: 'pending',
          txHash,
          amountUSDFC: (Number(amountWei) / 1e18).toString(),
          detail: 'Submitted, awaiting confirmation',
        } : t))
        ;(publicClient as any)?.waitForTransactionReceipt?.({ hash: txHash as `0x${string}` })
          .then(async (r: any) => {
            setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
              ...t,
              status: 'completed',
              txHash,
              amountUSDFC: (Number(amountWei) / 1e18).toString(),
              detail: `Block ${r?.blockNumber?.toString?.() ?? '?'}`,
            } : t))
            await fetchAccount()
          })
          .catch((err: any) => {
            console.warn('[withdraw] receipt wait failed:', err)
          })
      } else {
        const res = await fetch(`${API_BASE}/api/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amountWei.toString() }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Withdrawal failed' }))
          throw new Error(err.error || 'Withdrawal failed')
        }
        const data = await res.json()
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: 'completed',
          txHash: data.txHash,
          amountUSDFC: data.amountUSDFC?.toString(),
          detail: `Block ${data.blockNumber}`,
        } : t))
      }
      await fetchAccount()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed'
      setTransactions((prev) => prev.map((t) => t.id === entry.id ? { ...t, status: 'failed', error: msg } : t))
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const executeIntervention = async () => {
    if (!latestDecision?.pausedDataset) return
    const dataset = datasets.find((d) => d.name === latestDecision.pausedDataset)
    if (!dataset) return
    const entry: TransactionEntry = {
      id: `pause-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'pause',
      label: `Pause ${dataset.name}`,
      detail: `Dataset #${dataset.datasetId}`,
      status: 'pending',
    }
    setTransactions((prev) => [entry, ...prev])
    setLoading(true)
    setError(null)
    try {
      if (useWallet && walletClient) {
        const result = await pauseDatasetViaWallet(walletClient, dataset.datasetId)
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: 'pending',
          txHash: result.txHash,
          detail: `Dataset #${dataset.datasetId} · endEpoch ${result.endEpoch} · submitted`,
        } : t))
        ;(publicClient as any)?.waitForTransactionReceipt?.({ hash: result.txHash as `0x${string}` })
          .then(async (r: any) => {
            setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
              ...t,
              status: 'completed',
              txHash: result.txHash,
              detail: `Dataset #${dataset.datasetId} · endEpoch ${result.endEpoch} · block ${r?.blockNumber?.toString?.() ?? '?'}`,
            } : t))
            setDatasets((prev) => {
              const next = prev.map((d) => d.datasetId === dataset.datasetId ? { ...d, status: 'paused', endEpoch: result.endEpoch } : d)
              try { localStorage.setItem(`pm-datasets-${address!.toLowerCase()}`, JSON.stringify(next)) } catch {}
              return next
            })
            await fetchAccount()
          })
          .catch((err: any) => console.warn('[pause] receipt wait failed:', err))
        setDatasets((prev) => {
          const next = prev.map((d) => d.datasetId === dataset.datasetId ? { ...d, status: 'paused' } : d)
          try { localStorage.setItem(`pm-datasets-${address!.toLowerCase()}`, JSON.stringify(next)) } catch {}
          return next
        })
      } else {
        const res = await fetch(`${API_BASE}/api/act`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datasetId: dataset.datasetId, datasetName: dataset.name }),
        })
        if (!res.ok) throw new Error('Intervention failed')
        const result = await res.json()
        setInterventionsList((prev) => [...prev, result])
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: result.status,
          txHash: result.txHash,
          detail: `Dataset #${dataset.datasetId}${result.endEpoch ? ` · endEpoch ${result.endEpoch}` : ''}`,
        } : t))
        await Promise.all([fetchDatasets(), fetchAccount(), fetchDecisions()])
      }
      setLatestDecision(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Intervention failed'
      setTransactions((prev) => prev.map((t) => t.id === entry.id ? { ...t, status: 'failed', error: msg } : t))
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const resumeDataset = async () => {
    if (!latestDecision?.resumeCandidate) return
    const dataset = datasets.find((d) => d.name === latestDecision.resumeCandidate)
    if (!dataset) return
    const entry: TransactionEntry = {
      id: `resume-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'resume',
      label: `Resume ${dataset.name}`,
      detail: `Dataset #${dataset.datasetId}`,
      status: 'pending',
    }
    setTransactions((prev) => [entry, ...prev])
    setLoading(true)
    setError(null)
    try {
      if (useWallet && walletClient) {
        const result = await resumeDatasetViaWallet(walletClient, dataset.name, dataset.declaredValue, dataset.sizeBytes)
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: 'pending',
          txHash: result.txHash,
          detail: `New dataset #${result.newDatasetId} · submitted`,
        } : t))
        setDatasets((prev) => {
          const next = prev.map((d) => d.datasetId === dataset.datasetId ? {
            ...d,
            status: 'active',
            datasetId: result.newDatasetId,
            pieceCid: result.pieceCid,
            provider: result.provider,
          } : d)
          try { localStorage.setItem(`pm-datasets-${address!.toLowerCase()}`, JSON.stringify(next)) } catch {}
          return next
        })
        setTimeout(() => fetchAccount(), 30000)
      } else {
        const res = await fetch(`${API_BASE}/api/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datasetId: dataset.datasetId, datasetName: dataset.name }),
        })
        if (!res.ok) throw new Error('Resume failed')
        const result = await res.json()
        setInterventionsList((prev) => [...prev, result])
        setTransactions((prev) => prev.map((t) => t.id === entry.id ? {
          ...t,
          status: result.status,
          txHash: result.txHash,
          detail: `New dataset #${result.newDatasetId ?? '?'}`,
        } : t))
        await Promise.all([fetchDatasets(), fetchAccount(), fetchDecisions()])
      }
      setLatestDecision(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Resume failed'
      setTransactions((prev) => prev.map((t) => t.id === entry.id ? { ...t, status: 'failed', error: msg } : t))
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const verifyPause = async (datasetId: string) => {
    setVerifyingId(datasetId)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/verify-pause/${datasetId}`)
      if (!res.ok) throw new Error('Verification failed')
      const result = await res.json()
      setVerifyResult((prev) => ({ ...prev, [datasetId]: result }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifyingId(null)
    }
  }

  const runSetupDemo = async () => {
    if (!useWallet || !walletClient || !address) {
      setError('Connect a wallet on Calibration to create demo datasets')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const high = await createDemoDataset(walletClient, 'customer-model-v3.txt', 9, 127)
      setTransactions((prev) => [{
        id: `setup-${Date.now()}-h`,
        timestamp: new Date().toISOString(),
        kind: 'pause',
        label: `Create ${high.name}`,
        detail: `Dataset #${high.datasetId}${high.txHash ? ` · tx ${high.txHash.slice(0, 8)}…` : ''}`,
        status: 'pending',
        txHash: high.txHash,
      }, ...prev])
      const low = await createDemoDataset(walletClient, 'raw-sensor-archive.txt', 3, 127)
      setTransactions((prev) => [{
        id: `setup-${Date.now()}-l`,
        timestamp: new Date().toISOString(),
        kind: 'pause',
        label: `Create ${low.name}`,
        detail: `Dataset #${low.datasetId}${low.txHash ? ` · tx ${low.txHash.slice(0, 8)}…` : ''}`,
        status: 'pending',
        txHash: low.txHash,
      }, ...prev])

      const newDatasets: Dataset[] = [
        { name: high.name, declaredValue: high.declaredValue, sizeBytes: high.sizeBytes, costPerEpoch: high.costPerEpoch, datasetId: high.datasetId, pieceCid: high.pieceCid, provider: high.provider, status: 'active' },
        { name: low.name, declaredValue: low.declaredValue, sizeBytes: low.sizeBytes, costPerEpoch: low.costPerEpoch, datasetId: low.datasetId, pieceCid: low.pieceCid, provider: low.provider, status: 'active' },
      ]
      setDatasets(newDatasets)

      try {
        localStorage.setItem(`pm-datasets-${address!.toLowerCase()}`, JSON.stringify(newDatasets))
      } catch {}

      try {
        await fetch(`${API_BASE}/api/datasets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, datasets: newDatasets }),
        })
      } catch (err) {
        console.warn('Could not persist datasets to backend:', err)
      }
      await fetchAccount()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Setup failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 10000)
    return () => clearInterval(interval)
  }, [refreshAll])

  useEffect(() => {
    if (useWallet && walletClient) {
      fetchAccount()
      fetchDatasets()
    }
  }, [useWallet, walletClient, address, chain?.id, fetchAccount, fetchDatasets])

  useEffect(() => {
    if (useWallet && walletClient && datasets.length > 0 && !latestDecision) {
      runCheck()
    }
  }, [useWallet, walletClient, datasets.length, latestDecision])

  useEffect(() => {
    if (!useWallet || !address) return
    if (wagmiWalletClient) {
      setWalletClient(wagmiWalletClient)
      return
    }
    if (isConnected && address) {
      setError(null)
    }
  }, [useWallet, connector, address, wagmiWalletClient])

  const rawRemainingEpochs = account ? Number(account.runway) : null
  const lockupRateWei = account ? BigInt(account.lockupRate) : 0n
  const balanceWei = account ? BigInt(account.balance) : 0n
  const noStorage = lockupRateWei === 0n && balanceWei === 0n
  const MAX_EPOCHS = 115_792_089_237_316_195_423_570_985_008_687_907_853_269_984_665_640_564_039_457_584_007_913_129_639_936n
  const isUncapped = rawRemainingEpochs !== null && BigInt(account?.runway ?? '0') > MAX_EPOCHS / 2n
  const remainingEpochs = (rawRemainingEpochs === null || isUncapped) ? 0 : rawRemainingEpochs
  const threshold = latestDecision ? Number(latestDecision.threshold) : 100000000
  const healthyOutcomes = ['healthy', 'resume_safe', 'resume_available']
  const isHealthy = latestDecision ? healthyOutcomes.includes(latestDecision.outcome) : remainingEpochs >= threshold
  const progress = remainingEpochs > 0 ? Math.min(100, Math.max(0, (remainingEpochs / threshold) * 100)) : 0

  return (
    <div className="min-h-screen canvas">
      <Navbar />

      <section className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 mb-3">Live Demo</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink mb-3">Live Demo</h1>
            <p className="text-ink-2 max-w-2xl mx-auto text-base">
              {useWallet
                ? <>Connected to your wallet <span className="font-mono text-ink">{address?.slice(0, 6)}…{address?.slice(-4)}</span> on Calibration testnet. All reads and writes are signed by your wallet.</>
                : <>This dashboard is connected to a real Calibration testnet account. Every number you see is pulled from Filecoin Pay via the Synapse SDK. Connect your wallet to use your own account.</>
              }
            </p>

            {isConnected && (
              <div className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                useWallet
                  ? 'status-pill status-healthy'
                  : 'status-pill status-warning'
              }`}>
                {useWallet ? (
                  <>
                    <span className="pulse-dot" />
                    <span>Connected: <span className="font-mono">{address?.slice(0, 6)}…{address?.slice(-4)}</span></span>
                    <span className="text-ink-3">· actions sign with your wallet</span>
                  </>
                ) : (
                  <>
                    <span>Wrong network — switch to Calibration testnet to interact with your own account</span>
                    <button
                      onClick={() => switchChain({ chainId: calibrationChain.id })}
                      className="ml-2 underline hover:no-underline font-semibold"
                    >
                      Switch
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-6 inline-flex flex-col items-stretch gap-4 p-5 rounded-2xl card max-w-3xl">
              {/* Row 1: Check Now + Create Datasets */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={runCheck}
                  disabled={loading}
                  className="btn-primary group"
                >
                  {loading ? <><span className="spinner" /> Checking…</> : <>
                    Check Now
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </>}
                </button>
                {useWallet && (
                  <button
                    onClick={runSetupDemo}
                    disabled={loading || datasets.length > 0}
                    title="Upload 2 demo datasets onchain from this wallet"
                    className="btn-secondary"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {datasets.length > 0 ? `Datasets Ready (${datasets.length})` : 'Create Demo Datasets'}
                  </button>
                )}
              </div>

              {/* Row 2: Deposit with input */}
              <div className="flex flex-wrap items-center gap-2 justify-center">
                <label className="label mb-0">Deposit</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="input w-24 font-mono"
                  placeholder="USDFC"
                  aria-label="Deposit amount in USDFC"
                />
                <button
                  onClick={() => runDeposit(depositAmount)}
                  disabled={loading || !depositAmount || Number(depositAmount) <= 0}
                  className="btn-success"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4M4 20h16" />
                  </svg>
                  Top up
                </button>
              </div>

              {/* Row 3: Withdraw (input + button + critical) */}
              <div className="flex flex-wrap items-center gap-2 justify-center">
                <label className="label mb-0">Withdraw</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="input w-24 font-mono"
                  placeholder="USDFC"
                  aria-label="Withdraw amount in USDFC"
                />
                <button
                  onClick={() => runWithdraw(withdrawAmount)}
                  disabled={loading || !withdrawAmount || Number(withdrawAmount) <= 0}
                  className="btn-warning"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l-4-4m4 4l4-4M4 4h16" />
                  </svg>
                  Withdraw
                </button>
                <button
                  onClick={() => runWithdraw('all')}
                  disabled={loading}
                  title="Withdraw everything above the critical threshold"
                  className="btn-danger"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  To Critical
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-ink-3 justify-center">
                <span className="pulse-dot text-emerald-600" />
                Every action is a real onchain transaction on Calibration testnet.
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 surface-danger rounded-xl text-danger-fg flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Recent Transactions */}
          <div className="mb-8 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Recent Transactions</h3>
              <span className="text-xs text-ink-3 font-mono">{transactions.length} on this page</span>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-ink-3">No transactions yet. Try "Top up 10 USDFC" or "Withdraw 100".</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {transactions.map((t) => {
                  const kindClass =
                    t.kind === 'deposit' ? 'badge-healthy' :
                    t.kind === 'withdraw' ? 'badge-warning' :
                    t.kind === 'pause' ? 'badge-danger' :
                    'badge-info'
                  return (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 surface-info border-line rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`shrink-0 badge ${kindClass}`}>
                          {t.kind}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm text-ink truncate">{t.label}</div>
                          {t.detail && <div className="text-xs text-ink-3 truncate">{t.detail}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {t.txHash && (
                          <ExplorerLink href={`https://calibration.filfox.info/en/tx/${t.txHash}`}>
                            {shortenHash(t.txHash)}
                          </ExplorerLink>
                        )}
                        <span className={`badge ${
                          t.status === 'completed' ? 'badge-completed' :
                          t.status === 'pending' ? 'badge-pending' :
                          'badge-failed'
                        }`}>
                          {t.status === 'pending' && <span className="spinner w-2 h-2" />}
                          {t.status}
                        </span>
                        <span className="text-xs text-ink-3 font-mono w-20 text-right">
                          {new Date(t.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top Status Bar */}
          {account && (
            <div className={`mb-8 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5 ${
              isHealthy ? 'surface-healthy' : 'surface-danger'
            }`}>
              <div className="flex items-center gap-4">
                <div className="relative flex h-3 w-3">
                  {isHealthy && (
                    <span className="pulse-dot text-emerald-600" />
                  )}
                  {!isHealthy && (
                    <span className="pulse-dot text-red-600" />
                  )}
                </div>
                <div>
                  <div className={`text-2xl font-bold tracking-tight ${
                    isHealthy ? 'text-success-fg' : 'text-danger-fg'
                  }`}>
                    {isHealthy ? 'HEALTHY' : 'CRITICAL'}
                  </div>
                  <div className="text-sm text-ink-2">
                    {noStorage
                      ? 'No active storage on this account'
                      : remainingEpochs > 0
                        ? `${remainingEpochs.toLocaleString()} epochs remaining`
                        : '0 epochs remaining'}
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-md w-full">
                <div className="flex justify-between text-xs text-ink-3 mb-1.5">
                  <span>Runway remaining</span>
                  <span className="font-mono">{progress.toFixed(0)}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${isHealthy ? 'progress-healthy' : 'progress-danger'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-ink-3">Triage Threshold</div>
                <div className="text-lg font-mono font-semibold text-ink">{threshold.toLocaleString()} epochs</div>
              </div>
            </div>
          )}

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
            {/* Account State */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="card p-6">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-6">Account State</h3>
                {account ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-3 text-sm">USDFC Balance</span>
                      <span className="text-xl font-mono font-semibold text-ink">{formatWei(account.balance)} <span className="text-xs text-ink-3 font-normal">USDFC</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-3 text-sm">Runway</span>
                      <span className="text-xl font-mono font-semibold text-ink">
                        {isUncapped ? <span className="text-ink-3">∞</span> : `${Number(account.runway).toLocaleString()} `}<span className="text-xs text-ink-3 font-normal">epochs</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-3 text-sm">Lockup Rate</span>
                      <span className="text-xl font-mono font-semibold text-ink">{formatWei(account.lockupRate)} <span className="text-xs text-ink-3 font-normal">/epoch</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-3 text-sm">Current Epoch</span>
                      <span className="text-xl font-mono font-semibold text-ink">{Number(account.currentEpoch).toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-line">
                      <div className="text-xs text-ink-3 mb-2">Chain Verification</div>
                      <div className="rounded-lg surface-info p-3 font-mono text-xs text-ink-2 space-y-1">
                        <div>Balance: {formatWei(account.balance)} USDFC | Epoch: {account.currentEpoch}</div>
                        <div>Runway: {isUncapped ? '∞' : Number(account.runway).toLocaleString()} epochs | Lockup: {formatWei(account.lockupRate)}/epoch</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-4 w-2/3" />
                  </div>
                )}
              </div>

              <div className="card p-6">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-6">Portfolio</h3>
                {account ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-3 text-sm">Total Cost / Epoch</span>
                      <span className="text-xl font-mono font-semibold text-ink">{formatWei(account.lockupRate)} <span className="text-xs text-ink-3 font-normal">USDFC</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-3 text-sm">Remaining Epochs</span>
                      <span className="text-xl font-mono font-semibold text-ink">
                        {isUncapped ? <span className="text-ink-3">∞</span> : remainingEpochs > 0 ? remainingEpochs.toLocaleString() : '0'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-3 text-sm">Threshold</span>
                      <span className="text-xl font-mono font-semibold text-ink">{threshold.toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-line">
                      <div className="text-xs text-ink-3 mb-2">Status</div>
                      <div className={`text-lg font-semibold ${isHealthy ? 'text-success-fg' : 'text-danger-fg'}`}>
                        {isHealthy ? 'HEALTHY' : 'CRITICAL'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="skeleton h-4 w-full" />
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-4 w-2/3" />
                  </div>
                )}
              </div>
            </div>

            {/* Latest Decision */}
            <div className="card p-6">
              <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-6">Latest Decision</h3>
              {latestDecision ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-ink-3 mb-1">Outcome</div>
                    <div className={`text-2xl font-bold ${
                      latestDecision.outcome === 'critical' ? 'text-danger-fg' :
                      latestDecision.outcome === 'resume_insufficient' ? 'text-warning-fg' :
                      'text-success-fg'
                    }`}>
                      {latestDecision.outcome.toUpperCase()}
                    </div>
                  </div>

                  {latestDecision.protectedDataset && (
                    <div className="p-3 surface-healthy rounded-lg">
                      <div className="text-xs text-success-fg mb-1 font-semibold">Protected</div>
                      <div className="text-sm font-medium text-ink">{latestDecision.protectedDataset}</div>
                    </div>
                  )}

                  {latestDecision.pausedDataset && (
                    <div className="p-3 surface-danger rounded-lg">
                      <div className="text-xs text-danger-fg mb-1 font-semibold">Paused / Dropped</div>
                      <div className="text-sm font-medium text-ink">{latestDecision.pausedDataset}</div>
                    </div>
                  )}

                  {latestDecision.resumeCandidate && (
                    <div className="p-3 surface-info rounded-lg">
                      <div className="text-xs text-info-fg mb-1 font-semibold">Resume Candidate</div>
                      <div className="text-sm font-medium text-ink">{latestDecision.resumeCandidate}</div>
                    </div>
                  )}

                  {latestDecision.outcome === 'critical' && latestDecision.pausedDataset && (() => {
                    const alreadyPaused = datasets.some(
                      (d) => d.name === latestDecision.pausedDataset && d.status === 'paused'
                    )
                    if (alreadyPaused) {
                      return (
                        <div className="p-3 surface-warning rounded-lg">
                          <div className="text-xs text-warning-fg font-semibold">Intervention already executed</div>
                          <p className="text-xs text-ink-3 mt-1">
                            {latestDecision.pausedDataset} has been paused on-chain.
                          </p>
                        </div>
                      )
                    }
                    return (
                      <button
                        onClick={executeIntervention}
                        disabled={loading}
                        className="btn-danger"
                      >
                        {loading ? <><span className="spinner" /> Pausing…</> : `Pause ${latestDecision.pausedDataset}`}
                      </button>
                    )
                  })()}

                  {(latestDecision.outcome === 'resume_safe' || latestDecision.outcome === 'resume_available') && latestDecision.resumeCandidate && (() => {
                    const isPaused = datasets.some(
                      (d) => d.name === latestDecision.resumeCandidate && d.status === 'paused'
                    )
                    if (!isPaused) {
                      return (
                        <div className="p-3 surface-healthy rounded-lg">
                          <div className="text-xs text-success-fg font-semibold">Already active</div>
                          <p className="text-xs text-ink-3 mt-1">
                            {latestDecision.resumeCandidate} is already active.
                          </p>
                        </div>
                      )
                    }
                    return (
                      <button
                        onClick={resumeDataset}
                        disabled={loading}
                        className="btn-success"
                      >
                        {loading ? <><span className="spinner" /> Resuming…</> : `Resume ${latestDecision.resumeCandidate}`}
                      </button>
                    )
                  })()}

                  {latestDecision.outcome === 'resume_insufficient' && latestDecision.resumeCandidate && (
                    <div className="p-3 surface-warning rounded-lg">
                      <div className="text-xs text-warning-fg font-semibold">Resume not safe yet</div>
                      <p className="text-xs text-ink-3 mt-1">
                        Runway has recovered but resuming {latestDecision.resumeCandidate} would still put the account below threshold.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-ink-3 mb-1">Reason</div>
                    <div className="text-sm text-ink-2 leading-relaxed">{latestDecision.reason}</div>
                  </div>

                  <div className="pt-3 border-t border-line">
                    <div className="text-xs text-ink-3">Checked At</div>
                    <div className="text-sm text-ink-2 font-mono">
                      {new Date(latestDecision.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 grid place-items-center mb-3">
                    <svg className="w-5 h-5 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-ink-2 font-medium">No checks yet</p>
                  <p className="text-xs text-ink-3 mt-1">Click "Check Now" to begin triage.</p>
                </div>
              )}
            </div>
          </div>

          {/* Dataset Cards */}
          {useWallet && datasets.length === 0 ? (
            <div className="card p-10 mb-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 mb-4">
                <svg className="w-6 h-6 text-brand-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">No datasets on this account</h3>
              <p className="text-sm text-ink-2 max-w-md mx-auto">
                {noStorage
                  ? 'Your wallet has no USDFC in Filecoin Pay and no active storage. Use "Top up 10 USDFC" to deposit, then upload a dataset to start monitoring.'
                  : 'This account is funded but has no registered datasets. Upload a dataset via the Synapse SDK to begin triage monitoring.'}
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {datasets.map((ds) => (
              <div key={ds.datasetId} className="card p-6 card-hover">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold text-ink">{ds.name}</h3>
                  <span className={`badge ${ds.status === 'active' ? 'badge-healthy' : 'badge-warning'}`}>
                    {ds.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-3 text-sm">Declared Value<RealBadge /></span>
                    <span className="text-base font-mono font-semibold text-ink">{ds.declaredValue}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-3 text-sm">Size</span>
                    <span className="text-base font-mono text-ink">{ds.sizeBytes} bytes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-3 text-sm">Cost / Epoch<SimulatedBadge /></span>
                    <span className="text-base font-mono text-ink">{formatWei(ds.costPerEpoch)} USDFC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-3 text-sm">Dataset ID<RealBadge /></span>
                    <ExplorerLink href={`https://calibration.filfox.info/en/address/${account ? '0x6c79C23ef70df857a0544111a29A21b655709090' : ''}`}>
                      #{ds.datasetId}
                    </ExplorerLink>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-3 text-sm">PieceCID</span>
                    <ExplorerLink href={`https://cid.ipfs.io/#${ds.pieceCid}`}>
                      {shortenHash(ds.pieceCid, 10, 4)}
                    </ExplorerLink>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-3 text-sm">Provider</span>
                    <a href={ds.provider} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-ink-2 hover:text-ink transition truncate max-w-[200px]">
                      {ds.provider.replace('https://', '')}
                    </a>
                  </div>

                  {ds.status === 'paused' && (
                    <div className="pt-4 border-t border-line mt-4">
                      <button
                        onClick={() => verifyPause(ds.datasetId)}
                        disabled={verifyingId === ds.datasetId}
                        className="btn-secondary w-full"
                      >
                        {verifyingId === ds.datasetId ? <><span className="spinner" /> Verifying…</> : 'Verify Pause'}
                      </button>
                      {verifyResult[ds.datasetId] && (
                        <div className={`mt-3 text-sm p-3 rounded-lg ${
                          verifyResult[ds.datasetId].accessible ? 'surface-warning text-warning-fg' : 'surface-healthy text-success-fg'
                        }`}>
                          {verifyResult[ds.datasetId].accessible
                            ? 'Provider still serves cached piece, but payment rail is terminated — no new charges.'
                            : verifyResult[ds.datasetId].message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Claude Explanation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">AI</span>
                </div>
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Claude Explanation</h3>
              </div>
              {latestDecision?.explanation ? (
                <p className="text-ink leading-relaxed">{latestDecision.explanation}</p>
              ) : useWallet ? (
                <p className="text-ink-3">Click <span className="text-ink font-medium">Check Now</span> to see a wallet-derived runway analysis.</p>
              ) : (
                <p className="text-ink-3">Run a check to generate an explanation.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
