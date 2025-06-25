//TradeFormBottomSheet.tsx
import { Fragment } from "react";
import TradingPanel from "./TradingPanel";

interface TradeFormBottomSheetProps {
  onClose: () => void;
  initialTab: "buy" | "sell";
  isOpen: boolean;
  tokenAddress: `0x${string}`;
  launchAddress: `0x${string}`;
  showSellTab: boolean;
  canSellNow: boolean;
  canBuyNow: boolean;
}

export default function TradeFormBottomSheet({
  onClose,
  initialTab,
  isOpen,
  tokenAddress,
  launchAddress,
  showSellTab,
  canSellNow,
  canBuyNow,
}: TradeFormBottomSheetProps) {
  return (
    <Fragment>
      <div
        className="
          fixed inset-0 
          z-50 
          bg-black/60 opacity-0
          data-[open=true]:opacity-60
          transition-opacity duration-200
        "
        onClick={onClose}
      />

      <div
        className={`
          fixed inset-x-0 bottom-[52px]
          z-50
          bg-[#132043]
          rounded-t-xl
          transition-transform
          duration-300
          ease-in-out
          max-h-[calc(100vh-64px)]
          overflow-y-auto
          ${isOpen ? "translate-y-0" : "translate-y-full"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <TradingPanel
            initialTab={initialTab}
            centerHeader
            tokenAddress={tokenAddress}
            launchAddress={launchAddress}
            showSellTab={showSellTab}
            canSellNow={canSellNow}
            canBuyNow={canBuyNow}
          />
        </div>
      </div>
    </Fragment>
  );
}