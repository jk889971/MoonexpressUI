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
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

// Countdown timer component
function CountdownTimer({ endTime }: { endTime: number }) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (endTime <= 0) return
    
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, endTime - now);
    }

    setTimeLeft(calculateTimeLeft())
    
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft()
      setTimeLeft(newTimeLeft)
      if (newTimeLeft <= 0) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime])

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
    return <div className="text-sm text-[#19c0f4] font-mono">{formatTime(timeLeft)}</div>
  }

  return <div className="text-sm text-[#19c0f4] font-mono">{formatTime(timeLeft)}</div>
}

// Helper to get token status
function getTokenStatus(
  refundable: boolean,
  finalized: boolean,
  endTime: number,
  lpFailed: boolean,
  drainMode: boolean
) {
  const now = Math.floor(Date.now() / 1000);
  
  if (refundable) {
    if (!finalized) {
      return now < endTime ? "Live" : "Refunded";
    } else {
      return lpFailed ? "Failed" : "Migrated";
    }
  } else {
    if (drainMode) {
      return "Failed";
    } else if (!finalized) {
      return "Live";
    } else {
      return lpFailed ? "Failed" : "Migrated";
    }
  }
}

export default function Component() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [cardsPerPage, setCardsPerPage] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "market-cap">("newest")
  const [showCreator, setShowCreator] = useState(true)
  const [showNonRefundable, setShowNonRefundable] = useState(false)
  const [showLPs, setShowLPs] = useState(true)
  const starfieldRef = useRef<HTMLCanvasElement | null>(null);
  
  // Fix 1: Handle loading states
  const { data: staticLaunches, isLoading: staticLoading } = useSWR('/api/launches', fetcher);
  const staticLaunchesArray = Array.isArray(staticLaunches) ? staticLaunches : [];
  const launchAddresses = staticLaunchesArray.map((l: any) => l.launchAddress);

  // Fix 2: Add error handling to dynamic fetch
  const { 
    data: dynamicData = [], 
    isLoading: dynamicLoading,
    error: dynamicError 
  } = useSWR(
    launchAddresses.length > 0 ? ['/api/launch-dynamic', launchAddresses] : null,
    ([url, addresses]) => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launchAddresses: addresses })
    }).then(res => {
      if (!res.ok) throw new Error('Dynamic data failed');
      return res.json();
    }),
    { refreshInterval: 5000 }
  );
  
  // Fix 3: Add debug logs
  useEffect(() => {
    console.log('Static launches:', staticLaunches);
    console.log('Dynamic data:', dynamicData);
    if (dynamicError) console.error('Dynamic data error:', dynamicError);
  }, [staticLaunches, dynamicData, dynamicError]);

  // Fix 5: Add safe access to dynamic properties
  const launches = staticLaunchesArray.map((staticLaunch: any) => {
    const dynamic = dynamicData.find(
      (d: any) => d.launchAddress === staticLaunch.launchAddress
    ) || {};
    
    return {
      ...staticLaunch,
      ...dynamic,
      // Safely handle potentially undefined values
      status: getTokenStatus(
        dynamic.isRefundable || false,
        dynamic.finalized || false,
        dynamic.endTime || 0,
        dynamic.lpFailed || false,
        dynamic.drainMode || false
      )
    };
  });
  
  // 1) Apply tag-toggles (we’ll assume you’ve added those three pieces of state)
  let working = launches.filter(l => {
    if (!showCreator && l.creatorPreBuys) return false
    if (!showNonRefundable && !l.isRefundable) return false
    if (!showLPs && l.claimLP) return false
    return true
  })

  // 2) Sort by the selected sortBy value
  if (sortBy === "newest") {
    working.sort((a, b) => b.createdAt - a.createdAt)
  } else if (sortBy === "oldest") {
    working.sort((a, b) => a.createdAt - b.createdAt)
  } else { // "market-cap"
    // live ones first, each group sorted desc by marketCapUSD
    const live = working.filter(l => l.status === "Live")
    const other = working.filter(l => l.status !== "Live")
    live.sort((a, b) => (b.marketCapUSD || 0) - (a.marketCapUSD || 0))
    other.sort((a, b) => (b.marketCapUSD || 0) - (a.marketCapUSD || 0))
    working = [...live, ...other]
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy, showCreator, showNonRefundable, showLPs])

  // 3) Then apply your text-search filter
  const filteredAndSorted = working.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 4) Finally, paginate filteredAndSorted:
  const indexOfLast  = currentPage * cardsPerPage
  const indexOfFirst = indexOfLast - cardsPerPage
  const currentLaunches = filteredAndSorted.slice(indexOfFirst, indexOfLast)
  const totalPages       = Math.ceil(filteredAndSorted.length / cardsPerPage)

  useEffect(() => {
    function updateCardsPerPage() {
      const w = window.innerWidth;
      let columns = 1;

      if (w >= 1024) columns = 3;
      else if (w >= 768) columns = 2;
      else columns = 1;

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

  function normalizeUrl(maybeUrl?: string | null) {
    if (!maybeUrl) return null;
    if (!/^https?:\/\//i.test(maybeUrl)) {
      return 'https://' + maybeUrl;
    }
    return maybeUrl;
  }

  return (
    <div className="min-h-screen bg-[#000025] text-white relative">
      <canvas
        ref={starfieldRef}
        className="fixed inset-0 z-0 w-screen h-screen pointer-events-none select-none"
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

      {/** ─────────── BODY SECTION ─────────── **/}
      <div className="relative z-0">
        <section className="relative z-10 px-6 pb-16 pt-4">
          <div className="max-w-7xl mx-auto bg-[#0B152F] p-8 rounded-3xl">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 max-[400px]:items-center">
              <div className="flex items-center space-x-4 max-[400px]:flex-col max-[400px]:items-center max-[400px]:space-y-1 max-[400px]:space-x-0">
                <span className="text-3xl font-bold">{launches.length}</span>
                <span className="text-xl text-white/60 max-[400px]:text-center">Coins Created</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Toggles */}
                <div className="flex items-center space-x-6">
                  {/* Creator Bought */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white">Creator Bought</span>
                    <input
                      id="toggle-creator"
                      type="checkbox"
                      checked={showCreator}
                      onChange={() => setShowCreator(v => !v)}
                      className="sr-only"
                    />
                    <label
                      htmlFor="toggle-creator"
                      className={`
                        relative inline-flex h-6 w-12 items-center rounded-full
                        transition-colors duration-300 ease-in-out
                        ${showCreator ? "bg-[#19c0f4]" : "bg-white/30"}
                      `}
                    >
                      <span
                        className={`
                          block h-4 w-4 transform rounded-full bg-white shadow
                          transition-transform duration-200 ease-in-out
                          ${showCreator ? "translate-x-6" : "translate-x-1"}
                        `}
                      />
                    </label>
                  </div>

                  {/* Refundable */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white">Non-refundable</span>
                    <input
                      id="toggle-refundable"
                      type="checkbox"
                      checked={showNonRefundable}
                      onChange={() => setShowNonRefundable(v => !v)}
                      className="sr-only"
                    />
                    <label
                      htmlFor="toggle-refundable"
                      className={`
                        relative inline-flex h-6 w-12 items-center rounded-full
                        transition-colors duration-300 ease-in-out
                        ${showNonRefundable ? "bg-[#19c0f4]" : "bg-white/30"}
                      `}
                    >
                      <span
                        className={`
                          block h-4 w-4 transform rounded-full bg-white shadow
                          transition-transform duration-200 ease-in-out
                          ${showNonRefundable ? "translate-x-6" : "translate-x-1"}
                        `}
                      />
                    </label>
                  </div>

                  {/* LPs */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white">LPs</span>
                    <input
                      id="toggle-lps"
                      type="checkbox"
                      checked={showLPs}
                      onChange={() => setShowLPs(v => !v)}
                      className="sr-only"
                    />
                    <label
                      htmlFor="toggle-lps"
                      className={`
                        relative inline-flex h-6 w-12 items-center rounded-full
                        transition-colors duration-300 ease-in-out
                        ${showLPs ? "bg-[#19c0f4]" : "bg-white/30"}
                      `}
                    >
                      <span
                        className={`
                          block h-4 w-4 transform rounded-full bg-white shadow
                          transition-transform duration-200 ease-in-out
                          ${showLPs ? "translate-x-6" : "translate-x-1"}
                        `}
                      />
                    </label>
                  </div>
                </div>

                {/** ─── Sort dropdown ─── **/}
                <Select onValueChange={(v) => setSortBy(v as any)} defaultValue={sortBy}>
                  <SelectTrigger className="bg-[#21325e]/50 border-[#21325e] text-white w-full md:w-32">
                    <SelectValue>{sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : 'Market Cap'}</SelectValue>
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

            {/* Search bar */}
              <div className="mt-4 w-full md:w-80 relative">
                <Input
                  placeholder="Search for Coins"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-[#21325e]/50 border-[#21325e] text-white placeholder:text-white/50 pr-12 w-full"
                />
                <Button className="absolute right-0 top-0 bottom-0 bg-[#19c0f4] hover:bg-[#16abd9] text-white rounded-l-none hover:brightness-110 transition-all duration-300">
                  <Search className="w-4 h-4" />
                </Button>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staticLoading ? (
                Array.from({ length: 12 }).map((_, index) => (
                  <Card key={index} className="bg-[#21325e]/30 border-[#21325e] h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#19c0f4]"></div>
                  </Card>
                ))
              ) : currentLaunches.length === 0 ? (
                <div className="text-center py-12 col-span-3">
                  <p className="text-white/70">No tokens found!</p>
                </div>
              ) : (
                currentLaunches.map((launch: any) => {
                  
                  let dotColor = "bg-green-400"   // default for Live
                  let dotGlow  = "shadow-[0_0_6px_2px_rgba(34,197,94,.8)]"

                  if (launch.status === "Migrated") {
                    dotColor = "bg-green-800"
                    dotGlow  = ""
                  } else if (launch.status === "Failed") {
                    dotColor = "bg-red-500"
                    dotGlow  = ""
                  } else if (launch.status === "Refunded") {
                    dotColor = "bg-yellow-400"
                    dotGlow  = ""
                  }

                  // Convert IPFS URI to HTTP
                  const imageSrc = launch.imageURI?.startsWith("ipfs://") 
                    ? `https://ipfs.io/ipfs/${launch.imageURI.slice(7)}`
                    : launch.imageURI || "/placeholder.svg";
                  
                  // Determine status label
                  const statusLabel = 
                    launch.status === "Live" && launch.isRefundable ? "Refunds in" : 
                    launch.status === "Live" && !launch.isRefundable ? "Sells unlocking in" : 
                    launch.status === "Failed" ? "Failed" : 
                    launch.status === "Refunded" ? "Refunds available" : 
                    launch.status === "Migrated" ? "Claim available" : 
                    "Status";

                  const twitterLink = normalizeUrl(launch.twitterUrl);
                  const telegramLink = normalizeUrl(launch.telegramUrl);
                  const websiteLink = normalizeUrl(launch.websiteUrl);
                  
                  return (
                    <div 
                      key={launch.tokenAddress} 
                      className="cursor-pointer" 
                      onClick={() => router.push(
                        `/token/${launch.tokenAddress}?b=${launch.deployBlock}&s=${launch.symbol}`
                      )}
                    >
                      <Card className="bg-[#21325e]/30 border-[#21325e] backdrop-blur-sm hover:bg-[#21325e]/50 transition-colors duration-300 rounded-2xl overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex flex-wrap items-center p-6 mb-0 max-[400px]:flex-col max-[400px]:items-center max-[400px]:space-y-2 max-[400px]:space-x-0">
                            <div className="flex items-center mb-2">
                              <span className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${dotColor} ${dotGlow}`} />
                              <span className="text-white font-semibold ml-2">
                                {launch.status}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 w-full max-[400px]:flex-col max-[400px]:space-y-2 max-[400px]:space-x-0">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={imageSrc} alt={launch.name} />
                                <AvatarFallback className="bg-[#ffbb69] text-[#000025]">
                                  {launch.symbol.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex items-center max-[400px]:text-center">
                                <h3 className="font-semibold text-white">
                                  {launch.name} (${launch.symbol})
                                </h3>
                              </div>
                            </div>
                          </div>

                          <div className="bg-[#21325e]/50 p-4 mx-4 rounded-xl">
                            <div className="grid grid-cols-2 gap-4 text-center max-[400px]:grid-cols-1 max-[400px]:gap-y-2">
                              <div>
                                <div className="text-sm text-white/60 mb-1">Market cap</div>
                                <div className="font-semibold text-white">
                                  ${(launch.marketCapUSD || 0 ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-white/60 mb-1">Replies</div>
                                <div className="font-semibold text-white">{launch.repliesCount || 0}</div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Tags */}
                          <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1 justify-start max-[400px]:justify-center">
                            {launch.isRefundable ? (
                              <span className="bg-[#19c0f4]/20 text-[#19c0f4] text-xs px-2 py-1 rounded">
                                Refundable
                              </span>
                            ) : (
                              <span className="bg-orange-500/20 text-orange-500 text-xs px-2 py-1 rounded">
                                Non-refundable
                              </span>
                            )}
                            {launch.claimLP ? (
                              <span className="bg-purple-500/20 text-purple-500 text-xs px-2 py-1 rounded">
                                LPs
                              </span>
                            ) : (
                              <span className="bg-green-500/20 text-green-500 text-xs px-2 py-1 rounded">
                                Tokens
                              </span>
                            )}
                            {launch.creatorPreBuys && (
                              <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded">
                                Creator Bought
                              </span>
                            )}
                          </div>
                          
                          <div className="px-4 pt-2 pb-4">
                            <div className="text-sm text-white/70 mb-1 text-left max-[400px]:text-center">
                              Bonding Curve
                            </div>
                            <div className="relative w-full h-2 bg-[#0e1a38] rounded-full overflow-hidden">
                              <div 
                                className="absolute top-0 left-0 h-full animate-pulse-bar bg-[#19c0f4] transition-all duration-500 ease-in-out" 
                                style={{ width: `${launch.progress || 0}%` }} 
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-4 max-[400px]:flex-col max-[400px]:items-center max-[400px]:space-y-2 max-[400px]:space-x-0">
                            <div className="flex space-x-2 max-[400px]:justify-center max-[400px]:space-x-2">
                              {/* ─── Social Links (always show icons, enable only when URL exists) ─── */}
                              <div className="flex space-x-2">
                                {/** Website **/}
                                {websiteLink ? (
                                  <a
                                    href={websiteLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-full text-[#19c0f4] hover:bg-[#19c0f4]/10 transition-colors"
                                  >
                                    <Globe className="w-4 h-4" />
                                  </a>
                                ) : (
                                  <span className="p-1 rounded-full text-white/40 cursor-not-allowed">
                                    <Globe className="w-4 h-4" />
                                  </span>
                                )}

                                {/** Telegram **/}
                                {telegramLink ? (
                                  <a
                                    href={telegramLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-full text-[#19c0f4] hover:bg-[#19c0f4]/10 transition-colors"
                                  >
                                    {/* your Telegram SVG */}
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="p-1 rounded-full text-white/40 cursor-not-allowed">
                                    {/* your Telegram SVG */}
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                    </svg>
                                  </span>
                                )}

                                {/** Twitter **/}
                                {twitterLink ? (
                                  <a
                                    href={twitterLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-full text-[#19c0f4] hover:bg-[#19c0f4]/10 transition-colors"
                                  >
                                    {/* your Twitter SVG */}
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="p-1 rounded-full text-white/40 cursor-not-allowed">
                                    {/* your Twitter SVG */}
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end max-[400px]:items-center">
                              <div className="text-sm text-white/60 mb-1">{statusLabel}</div>
                              <CountdownTimer endTime={launch.endTime} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })
              )}
            </div>
            
            <div className="flex justify-center mt-8 space-x-4 items-center">
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

              <span className="px-3 py-1 rounded-md text-sm text-[#19c0f4]">
                {currentPage}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`
                  px-3 py-1 rounded-md text-sm
                  ${currentPage === totalPages || totalPages === 0 ? "text-white/50 cursor-not-allowed" : "text-white hover:text-[#19c0f4]"}
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