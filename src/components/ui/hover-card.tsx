import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../../lib/utils"

interface HoverCardProps {
  children: React.ReactNode
  content: React.ReactNode
  className?: string
}

export function HoverCard({ children, content, className }: HoverCardProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-50 w-64 rounded-xl border bg-black p-4 text-white shadow-xl dark:bg-white dark:text-black mt-2",
              "-translate-x-1/2 left-1/2",
              className
            )}
          >
            <div className="text-xs leading-relaxed font-medium">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
