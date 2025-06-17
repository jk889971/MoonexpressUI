"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Globe } from "lucide-react"

// (Helper timer, unchanged)
function CountdownTimer({ initialTime }: { initialTime: number }) {
  const [timeLeft, setTimeLeft] = useState(initialTime)

  useEffect(() => {
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${days.toString().padStart(2, "0")}:${hours
      .toString()
      .padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (timeLeft <= 0) {
    return <div className="text-xs text-red-400">Expired</div>
  }

  return <div className="text-xs text-[#19c0f4] font-mono">{formatTime(timeLeft)}</div>
}

export default function Component() {
  const allMemecoins = Array.from({ length: 45 }).map((_, i) => ({
    name: "Flappy Bird",
    symbol: "$FBD",
    creator: "Devmoa",
    marketCap: "4100.84",
    replies: "07",
    createdOn: "14-03-2024",
    avatar: "/placeholder.svg?height=40&width=40",
  }));

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [cardsPerPage, setCardsPerPage] = useState<number>(15);

  const [searchQuery, setSearchQuery] = useState("")

  const indexOfLast = currentPage * cardsPerPage;
  const indexOfFirst = indexOfLast - cardsPerPage;
  const currentCoins = allMemecoins.slice(indexOfFirst, indexOfLast);

  const filtered = currentCoins.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(allMemecoins.length / cardsPerPage);

  const router = useRouter();

  const starfieldRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const newTotal = Math.ceil(allMemecoins.length / cardsPerPage);
    if (currentPage > newTotal) {
      setCurrentPage(newTotal);
    }
  }, [cardsPerPage]);

  useEffect(() => {
    function updateCardsPerPage() {
      const w = window.innerWidth;
      let columns = 1;

      if (w >= 1024) {
        columns = 3;   // lg:grid-cols-3
      } else if (w >= 768) {
        columns = 2;   // md:grid-cols-2
      } else {
        columns = 1;   // grid-cols-1
      }

      // if exactly 2 cards/row, show 14 per page; else show 15
      setCardsPerPage(columns === 2 ? 14 : 15);
    }

    updateCardsPerPage();
    window.addEventListener("resize", updateCardsPerPage);
    return () => window.removeEventListener("resize", updateCardsPerPage);
  }, []);

  /* ─── (1) STATIC star-field – no mouse interaction ─── */
  useEffect(() => {
    let frameId: number = 0

    const canvas = starfieldRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const DENSITY = 8_000           // px² / star   (smaller ⇒ more)
    const RADII   = [1, 1.5, 2.2]   // three dot sizes

    type Dot = { x: number; y: number; r: number }
    let dots: Dot[] = []

    const reset = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      dots = []
      const count = Math.ceil((canvas.width * canvas.height) / DENSITY)
      for (let i = 0; i < count; i++) {
        dots.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: RADII[Math.floor(Math.random() * RADII.length)],
        })
      }
    }

    const step = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#fff'
      for (const d of dots) ctx.fillRect(d.x, d.y, d.r, d.r)
      frameId = requestAnimationFrame(step)
    }

    reset()
    step()
    window.addEventListener('resize', reset)

    return () => {
      window.removeEventListener('resize', reset)
      cancelAnimationFrame(frameId)
    }
  }, [])

  /* ─── (2) Shooting stars – upper-left ➜ lower-right ─── */
  useEffect(() => {
    const canvas = starfieldRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let active = true

    const spawn = () => {
  if (!active) return

  const margin = 80                              // stars start off-screen
  const startX = -margin + Math.random() * (canvas.width * 0.25)  // –80 → 25 % width
  const startY = -margin + Math.random() * (canvas.height * 0.25) // –80 → 25 % height

  const len    = 350 + Math.random() * 550       // 350 – 900 px
  const endX   = startX + len                    // ↘ 45°
  const endY   = startY + len

  const SPEED  = 1200                            // pixels per second
  const duration = (len / SPEED) * 1000          // ms
  const born = performance.now()

  const draw = (now: number) => {
      if (!active) return
      const t = (now - born) / duration            // 0 → 1 over ‘duration’
      if (t > 1) return
      ctx.save()
      ctx.globalAlpha = 1 - t
      ctx.strokeStyle = '#fff'
      ctx.lineWidth   = 2
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(startX + len * t, startY + len * t)
      ctx.stroke()
      ctx.restore()
      requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)

    /* schedule the next star in 2–4 s  */
    setTimeout(spawn, 2000 + Math.random() * 2000)
  }

    spawn()
    return () => { active = false }
  }, [])


  return (
    <div className="min-h-screen bg-[#000025] text-white relative overflow-x-hidden">
      <canvas
        ref={starfieldRef}
        className="fixed inset-0  z-0  w-screen h-screen pointer-events-none select-none"
      />
      {/** ─────────── HERO SECTION ─────────── **/}
      <section className="relative z-10 text-center py-16 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center lg:justify-between justify-center">
            {/* ─── Moon + Rocket Container ─── */}
            <div className="w-full lg:w-1/2 mb-8 lg:mb-0">
              <div
                className="
                  relative w-full
                  lg:max-w-[576px]
                  md:max-w-[480px]
                  sm:max-w-[400px]
                  max-w-[320px]
                  aspect-square
                  mx-auto
                "
              >
                {/* Moon */}
                <img
                  src="/moon.svg"
                  alt="Moon"
                  className="absolute inset-0 w-full h-full object-contain"
                />

                {/* Rocket */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <img
                    src="/rocket.png"
                    alt="Rocket"
                    className="
                      w-1/2
                      sm:w-2/5
                      md:w-1/3
                      lg:w-64
                      h-auto
                      object-contain
                      animate-bounce-slow
                    "
                    style={{ animationDuration: '6s' }}
                  />
                </div>
              </div>
            </div>

            {/* ─── Text & Buttons ─── */}
            <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start">
              <h1
                className="
                  text-3xl
                  sm:text-4xl
                  md:text-5xl
                  lg:text-6xl
                  font-bold mb-6 leading-tight font-['Space_Grotesk']
                  text-center lg:text-left
                "
              >
                Memecoins Express
                <br />
                Way to the Moon
              </h1>

              <p
                className="
                  text-base
                  sm:text-lg
                  md:text-xl
                  lg:text-xl
                  text-white/80 mb-8 max-w-md
                  text-center lg:text-left mx-auto lg:mx-0
                "
              >
                Turn your meme into a Supra sensation in 30 seconds, no code, no hassle.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Button
                  className="
                    text-white
                    w-[150px]
                    h-[40px]
                    rounded-[12px]
                    shadow-[inset_0px_2px_2px_0px_#FFFFFF66]
                    text-sm
                    bg-[#19c0f4] hover:bg-[#19c0f4] hover:ring-4 hover:ring-[#19c0f4]/30 active:brightness-90 transition-all duration-300
                  "
                  onClick={() => router.push("/create")}
                >
                  Create Coin
                </Button>

                <Button
                  variant="outline"
                  className="
                    border-[#19c0f4]
                    text-[#19c0f4]
                    bg-transparent
                    w-[150px]
                    h-[40px]
                    rounded-[12px]
                    text-sm
                    hover:bg-[#19C0F4] hover:text-white transition-colors duration-300
                  "
                >
                  How it works?
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/** ─────────── BODY SECTION (everything else) ─────────── **/}
      <div className="relative z-0">
      <section className="relative z-10 px-6 pb-16 pt-4">
        <div className="max-w-7xl mx-auto bg-[#0B152F] p-8 rounded-3xl">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 max-[400px]:items-center">
            <div className="flex items-center space-x-4 max-[400px]:flex-col max-[400px]:items-center max-[400px]:space-y-1 max-[400px]:space-x-0">
              <span className="text-3xl font-bold">3570</span>
              <span className="text-xl text-white/60 max-[400px]:text-center">Coins Created</span>
            </div>

            <div className=" flex items-center space-x-4 w-full md:w-auto max-[400px]:flex-col max-[400px]:items-center max-[400px]:space-y-2 max-[400px]:space-x-0">
              {/** ─── Search field ─── **/}
              <div className="relative w-full md:w-80">
                <Input
                  placeholder="Search for Coins"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#21325e]/50 border-[#21325e] text-white placeholder:text-white/50 pr-12 w-full"
                />
                <Button className="absolute right-0 top-0 bottom-0 bg-[#19c0f4] hover:bg-[#16abd9] text-white rounded-l-none hover:brightness-110 transition-all duration-300">
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              {/** ─── Sort dropdown ─── **/}
              <Select>
                <SelectTrigger className="bg-[#21325e]/50 border-[#21325e] text-white w-full md:w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-[#0e1a38] border border-[#21325e] text-white">
                  <SelectItem
                    value="newest"
                    className="data-[highlighted]:bg-[#19c0f4] data-[highlighted]:text-white"
                  >
                    Newest
                  </SelectItem>
                  <SelectItem
                    value="oldest"
                    className="data-[highlighted]:bg-[#19c0f4] data-[highlighted]:text-white"
                  >
                    Oldest
                  </SelectItem>
                  <SelectItem
                    value="market-cap"
                    className="data-[highlighted]:bg-[#19c0f4] data-[highlighted]:text-white"
                  >
                    Market Cap
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((coin, index) => (
              <div key={index} className="cursor-pointer" onClick={() => router.push("/token")}>
              <Card
                className="bg-[#21325e]/30 border-[#21325e] backdrop-blur-sm hover:bg-[#21325e]/50 transition-colors duration-300 rounded-2xl overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="flex items-center p-6 mb-0 max-[400px]:flex-col max-[400px]:items-center max-[400px]:space-y-2 max-[400px]:space-x-0">
                    <div className="flex items-center space-x-3 max-[400px]:flex-col max-[400px]:space-y-2 max-[400px]:space-x-0">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={coin.avatar || "/placeholder.svg"} alt={coin.name} />
                        <AvatarFallback className="bg-[#ffbb69] text-[#000025]">FB</AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold text-white text-center max-[400px]:mt-0">
                        {coin.name} ({coin.symbol})
                      </h3>
                    </div>
                  </div>

                  <div className="bg-[#21325e]/50 p-4 mx-4 rounded-xl">
                    <div className="grid grid-cols-3 gap-4 text-center max-[400px]:grid-cols-1 max-[400px]:gap-y-2">
                      <div>
                        <div className="text-xs text-white/60 mb-1">Symbol</div>
                        <div className="font-semibold text-white">{coin.symbol}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/60 mb-1">Market cap</div>
                        <div className="font-semibold text-white">{coin.marketCap}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/60 mb-1">Replies</div>
                        <div className="font-semibold text-white">{coin.replies}</div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pt-2 pb-4">
                    <div className="text-sm text-white/70 mb-1 text-left max-[400px]:text-center">
                      Bonding Curve
                    </div>
                    <div className="relative w-full h-2 bg-[#0e1a38] rounded-full overflow-hidden">
                      <div className="absolute top-0 left-0 h-full w-[18%] animate-pulse-bar bg-[#19c0f4]" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 max-[400px]:flex-col max-[400px]:items-center max-[400px]:space-y-2 max-[400px]:space-x-0">
                    <div className="flex space-x-2 max-[400px]:justify-center max-[400px]:space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#19c0f4] hover:bg-[#19c0f4]/10 w-8 h-8 transition-colors duration-300"
                      >
                        <Globe className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#19c0f4] hover:bg-[#19c0f4]/10 w-8 h-8 transition-colors duration-300"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[#19c0f4] hover:bg-[#19c0f4]/10 w-8 h-8 transition-colors duration-300"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </Button>
                    </div>
                    <div className="flex flex-col items-end max-[400px]:items-center">
                      <div className="text-xs text-white/60 mb-1">Refunds in</div>
                      <CountdownTimer initialTime={Math.floor(Math.random() * 86400) + 3600} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-8 space-x-4 items-center">
            {/* Left arrow: go to previous page */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className={`
                px-3 py-1 rounded-md text-sm
                ${currentPage === 1 ? "text-white/50 cursor-not-allowed" : "text-white hover:text-[#19c0f4]"}
              `}
            >
              «
            </button>

            {/* Just show the active page */}
            <span className="px-3 py-1 rounded-md text-sm text-[#19c0f4]">
              {currentPage}
            </span>

            {/* Right arrow: go to next page */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`
                px-3 py-1 rounded-md text-sm
                ${currentPage === totalPages ? "text-white/50 cursor-not-allowed" : "text-white hover:text-[#19c0f4]"}
              `}
            >
              »
            </button>
          </div>
        </div>
      </section>
      </div>
    </div>
  )
}