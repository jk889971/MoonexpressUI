//components/site-footer.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="z-20 bg-[#132043] border-t border-[#21325e]/30 px-6 py-4">
      <div className="hidden lg:flex items-center relative">
        <div className="flex space-x-0">
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
          <Button variant="ghost" size="icon" className="text-[#19c0f4] transition-colors duration-300">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </Button>
          </a>
        </div>

        <span className="absolute left-1/2 transform -translate-x-1/2 text-sm text-white/60">
          All rights reserved © moonexpress.fun
        </span>
      </div>

      <div className="flex flex-col items-center lg:hidden">
        <span className="text-sm text-white/60 text-center">
          All rights reserved © moonexpress.fun
        </span>

        <div className="mt-2 flex space-x-0">
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
          <Button variant="ghost" size="icon" className="text-[#19c0f4] transition-colors duration-300">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </Button>
          </a>
        </div>
      </div>
    </footer>
  );
}