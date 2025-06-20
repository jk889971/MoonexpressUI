import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

interface GlowingCardProps {
  children: React.ReactNode
  isNew?: boolean
}

export function GlowingCard({ children, isNew = false }: GlowingCardProps) {
  return (
    <motion.div
      // only animate entrance on brand-new cards
      initial={isNew ? { opacity: 0, scale: 0.8 } : undefined}
      animate={isNew ? { opacity: 1, scale: 1 } : undefined}
      transition={isNew ? { type: "spring", stiffness: 260, damping: 20 } : undefined}
      className="relative"
    >
      {isNew && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-white/20 filter blur-xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1.1, opacity: [0, 0.3, 0] }}
          transition={{ duration: 2, repeat: 0 }}
        />
      )}

      {/* your regular card */}
      <Card className="relative">
        <CardContent className="p-0">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}