import { Tooltip } from "./ui/tooltip"
import { HelpCircle } from "lucide-react"
import { motion } from "framer-motion"

interface ChartExplicationTooltipProps {
  content: string
  isDark?: boolean
  className?: string
}

export function ChartExplicationTooltip({ content, className }: ChartExplicationTooltipProps) {
  return (
    <Tooltip content={content} className={className}>
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        className="p-1 rounded-full transition-colors flex items-center justify-center cursor-help text-zinc-500 hover:text-zinc-300"
        aria-label="Explicação do gráfico"
      >
        <HelpCircle size={16} />
      </motion.div>
    </Tooltip>
  )
}
