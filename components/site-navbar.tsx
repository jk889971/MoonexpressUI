//components/site-navbar.tsx
"use client";

import { Button } from "@/components/ui/button";
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { Send } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CHAINS, ChainKey } from "@/lib/chains/catalog";
import { useChain } from '@/hooks/useChain';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SiteNavbar() {
  const pathname = usePathname();

  const [chainCfg, setChain] = useChain();
  const chainOptions = Object.keys(CHAINS) as ChainKey[];

  return (
    <>
      <header
        className="
          z-20 
          relative
          flex items-center justify-between px-6 py-4 
          bg-[#132043]
          max-[250px]:flex-col
          max-[250px]:items-center
        "
      >
        <Link href="/" className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/fulllogo.png"
              alt="Moonexpress"
              className="h-8 max-[550px]:hidden"
            />

            <img
              src="/logo.png"
              alt="M"
              className="hidden max-[550px]:block h-8"
            />
          </div>
        </Link>

        <nav className="hidden min-[900px]:flex flex-1 justify-start space-x-8 pl-8">
          <Link
            href="/"
            className={`
              text-white hover:text-[#19c0f4] 
              ${pathname === "/" ? "text-[#19c0f4]" : ""}
            `}
          >
            Home
          </Link>
          <Link
            href="/create"
            className={`
              text-white hover:text-[#19c0f4] 
              ${pathname === "/create" ? "text-[#19c0f4]" : ""}
            `}
          >
            Create
          </Link>
          <a href="https://moonexpress-fun.gitbook.io/moonexpress.fun" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#19c0f4]">
            Docs
          </a>
        </nav>

        <div
          className="
            flex items-center gap-4 
            max-[250px]:mt-2
          "
        >
          <div className="absolute left-1/2 transform -translate-x-1/2 flex space-x-0 justify-center max-[1280px]:hidden">
            <a
              href="https://t.me/moonexpressfun"
              target="_blank"
              rel="noopener noreferrer"
            >
            <Button variant="ghost" size="icon" className="text-[#19c0f4]">
              <Send className="w-6 h-6" />
            </Button>
            </a>
            <a
              href="https://x.com/MoonexpressFun"
              target="_blank"
              rel="noopener noreferrer"
            >
            <Button
              variant="ghost"
              size="icon"
              className="text-[#19c0f4] transition-colors duration-300"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Button>
            </a>
          </div>
          <div>
            <Select value={chainCfg.key} onValueChange={(v) => setChain(v as ChainKey)}>
              <SelectTrigger className="w-[140px] h-[40px] max-[400px]:w-[120px] max-[370px]:w-[110px] max-[340px]:w-[100px] max-[325px]:w-[70px] bg-[#21325e]/50 border-[#21325e] text-white">
                <SelectValue asChild>
                <span className="flex items-center gap-2">
                  <img
                    src={chainCfg.nativeLogo}
                    className="w-5 h-5 rounded-full"
                  />
                  <span>{chainCfg.label}</span>
                </span>
              </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#0e1a38] border border-[#21325e] text-white max-h-64 overflow-y-auto">
                {chainOptions.map((k) => (
                  <SelectItem
                    key={k}
                    value={k}
                    className="data-[highlighted]:bg-[#19c0f4] data-[highlighted]:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <img
                        src={CHAINS[k].nativeLogo}
                        alt={`${CHAINS[k].label} logo`}
                        className="w-5 h-5 rounded-full"
                      />
                      <span>{CHAINS[k].label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
            <ConnectWalletButton />
        </div>
      </header>

      <div
        className="
          fixed bottom-0 left-0 right-0 z-[996]
          flex h-16 items-center justify-around
          border-t border-t-[rgba(248,250,252,0.1)]
          bg-[#132043]
          hidden max-[1023px]:flex
        "
      >
        <Link
          href="/"
          className={`
            flex flex-col items-center justify-center p-2
            transition-colors duration-200
            ${
              pathname === "/"
                ? "text-[#19c0f4]"
                : "text-white hover:text-[#19c0f4]"
            }
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="25"
            viewBox="0 0 24 25"
            fill="none"
            className="h-[30px] w-[30px]"
          >
            <path
              d="M13.8153 2.55582C12.7771 1.64342 11.2229 1.64342 10.1847 2.55582L3.93468 8.04824C3.34056 8.57035 3 9.323 3 10.1139V18.459C3 19.9778 4.23122 21.209 5.75 21.209H8.16057C9.12707 21.209 9.91057 20.4255 9.91057 19.459V17.209C9.91057 16.1044 10.806 15.209 11.9106 15.209H12C13.1046 15.209 14 16.1044 14 17.209V19.459C14 20.4255 14.7835 21.209 15.75 21.209H18.25C19.7688 21.209 21 19.9778 21 18.459V10.1139C21 9.323 20.6594 8.57035 20.0653 8.04824L13.8153 2.55582Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-[0.65rem]">Home</span>
        </Link>

        <Link
          href="/create"
          data-testid="create-coin-button-mobile-menu"
          className={`
            flex flex-col items-center justify-center p-2
            transition-colors duration-200
            ${
              pathname === "/create"
                ? "text-[#19c0f4]"
                : "text-white hover:text-[#19c0f4]"
            }
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="25"
            viewBox="0 0 24 25"
            fill="none"
            className="h-[30px] w-[30px]"
          >
            <path
              d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-[0.65rem]">Create</span>
        </Link>

        <a
          href="https://moonexpress-fun.gitbook.io/moonexpress.fun"
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex flex-col items-center justify-center p-2
            transition-colors duration-200
            text-white hover:text-[#19c0f4]
          "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="25"
            viewBox="0 0 24 25"
            fill="none"
            className="h-[30px] w-[30px]"
          >
            <path
              d="M4 2h12l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 2v4h4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[0.65rem]">Docs</span>
        </a>
      </div>
    </>
  );
}