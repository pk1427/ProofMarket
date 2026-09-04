import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { calibration } from '@filoz/synapse-core/chains'
import { http } from 'wagmi'

const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000'

export const wagmiConfig = getDefaultConfig({
  appName: 'ProofMarket',
  projectId: WALLET_CONNECT_PROJECT_ID,
  chains: [calibration as any],
  transports: {
    [calibration.id]: http('https://api.calibration.node.glif.io/rpc/v1'),
  },
  ssr: false,
})

export const CALIBRATION_CHAIN = calibration
