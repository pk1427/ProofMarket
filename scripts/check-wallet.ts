import { createClient, http } from 'viem'
import { Synapse, TOKENS } from '@filoz/synapse-sdk'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xbb4bc6965eb968d2f3857cc7d5bdd792022794df2e0eab1565e6041dfcaac331')
const client = createClient({ chain: calibrationChain, transport: http('https://api.calibration.node.glif.io/rpc/v1'), account })
const synapse = new Synapse({ client, source: 'proofmarket-check' })
const walletBalance = await synapse.payments.walletBalance({ token: TOKENS.USDFC })
console.log('Wallet USDFC balance:', Number(walletBalance) / 1e18, 'USDFC')
