import * as React from "react"
import { cn } from "../../lib/utils"

interface TooltipProps {
  children: React.ReactNode
  content: string
  className?: string
}

export function Tooltip({ children, content, className }: TooltipProps) {
  return (
    <div className="group relative inline-block">
      {children}
      <div className={cn(
        "absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900 pointer-events-none",
        className
      )}>
        {content}
        <div className="absolute top-full left-1/2 -ml-1 border-[4px] border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
      </div>
    </div>
  )
}
