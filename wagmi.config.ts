// wagmi.config.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http } from "wagmi"
import { CHAIN } from "@/lib/chains/current"

const rpcUrl =
  (CHAIN.envRpc ? process.env[CHAIN.envRpc] : undefined) ?? CHAIN.rpcUrls[0]

export const wagmiConfig = getDefaultConfig({
  appName: "Moonexpress",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [CHAIN.chain],
  ssr: true,
  transports: {
    [CHAIN.chain.id]: http(rpcUrl)
  }
})

export const chains = wagmiConfig.chains