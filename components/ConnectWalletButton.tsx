// components/ConnectWalletButton.tsx
"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"

export default function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openConnectModal,
        openAccountModal,
        mounted,
        authenticationStatus,
      }) => {
        const ready = mounted && authenticationStatus !== "loading"
        const connected = ready && account && chain

        return (
          <button
            className="
              text-white
              w-[140px] h-[40px]
              max-[370px]:w-[120px]
              max-[300px]:w-[100px]
              rounded-[12px]
              shadow-[inset_0px_2px_2px_0px_#FFFFFF66]
              font-bold text-[14px]
              bg-[#19c0f4]
              hover:bg-[#19c0f4]
              hover:ring-4 hover:ring-[#19c0f4]/30
              active:brightness-90
              transition-all duration-300
            "
            disabled={!ready}
            onClick={() => {
              if (!connected) {
                openConnectModal?.()
              } else {
                openAccountModal?.()
              }
            }}
          >
            {connected
              ? 
                `${account.displayName.slice(0,4)}…${account.displayName.slice(-4)}`
              : "Connect Wallet"}
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}