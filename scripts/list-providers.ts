import { createClient, http } from 'viem'
import { calibration as calibrationChain } from '@filoz/synapse-core/chains'
import { getApprovedPDPProviders } from '@filoz/synapse-core/sp-registry'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xbb4bc6965eb968d2f3857cc7d5bdd792022794df2e0eab1565e6041dfcaac331')
const client = createClient({ chain: calibrationChain, transport: http('https://api.calibration.node.glif.io/rpc/v1'), account })
const providers = await getApprovedPDPProviders(client)
console.log('Providers:', JSON.stringify(providers.map(p => ({ id: p.id.toString(), serviceProvider: p.serviceProvider, pdp: p.pdp?.serviceURL })), null, 2))
