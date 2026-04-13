"use client";
import { useMotionValue } from "framer-motion";
import React, { useState, useEffect } from "react";
import { useMotionTemplate, motion } from "framer-motion";
import { cn } from "../../lib/utils";

export const EvervaultCard = ({
  text,
  className,
  isDark = false,
  label,
  trend,
  trendValue,
  showBorder = true,
  showText = true,
  variant = 'square',
  children
}: {
  text?: string | React.ReactNode;
  className?: string;
  isDark?: boolean;
  label?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  showBorder?: boolean;
  showText?: boolean;
  variant?: 'square' | 'circle';
  children?: React.ReactNode;
}) => {
  let mouseX = useMotionValue(0);
  let mouseY = useMotionValue(0);

  const [randomString, setRandomString] = useState("");

  useEffect(() => {
    let str = generateRandomString(1500);
    setRandomString(str);
  }, []);

  function onMouseMove({ currentTarget, clientX, clientY }: any) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);

    const str = generateRandomString(1500);
    setRandomString(str);
  }

  return (
    <div
      className={cn(
        "p-0.5 bg-transparent aspect-video flex items-center justify-center w-full h-full relative overflow-visible",
        className
      )}
    >
      <div
        onMouseMove={onMouseMove}
        className={cn(
            "group/card w-full relative overflow-hidden bg-transparent flex items-center justify-center h-full transition-all duration-300",
            variant === 'circle' ? "rounded-full" : "rounded-[20px]",
            showBorder ? "border border-zinc-200 dark:border-zinc-800 shadow-sm" : "border-none shadow-none"
        )}
      >
        <CardPattern
          mouseX={mouseX}
          mouseY={mouseY}
          randomString={randomString}
          isDark={isDark}
          variant={variant}
        />
        {(showText || label || trend || children) && (
            <div className="relative z-10 flex flex-col items-center justify-center">
            {variant === 'circle' ? (
                <div className="relative h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center text-white font-bold">
                    <div className="absolute w-full h-full bg-white/[0.2] dark:bg-black/[0.4] blur-sm rounded-full border border-white/10 dark:border-white/5" />
                    <div className="z-20 flex items-center justify-center w-full h-full">
                        {children || (
                            <span className={cn(
                                "font-mono text-xl font-extrabold transition-all duration-300 group-hover/card:scale-110",
                                isDark ? "text-white" : "text-zinc-950"
                            )}>
                                {text}
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                <div className="relative h-24 w-full flex items-center justify-center">
                    <div className="absolute w-full h-full bg-white/[0.05] dark:bg-black/[0.05] blur-[10px]" />
                    {label && (
                        <p className={cn(
                            "absolute top-0 text-[10px] font-bold uppercase tracking-widest mb-2 z-20",
                            isDark ? "text-zinc-500" : "text-zinc-400"
                        )}>
                            {label}
                        </p>
                    )}
                    {showText && (
                        <div className="z-20 flex items-center justify-center w-full h-full">
                            {children || (
                                <span className={cn(
                                    "font-mono text-3xl font-extrabold transition-all duration-300 group-hover/card:scale-110",
                                    isDark ? "text-white" : "text-zinc-950"
                                )}>
                                    {text}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {trend && trendValue && (
                <div className="mt-2 flex items-center gap-1.5 z-20">
                    <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        trend === 'up' ? "bg-emerald-500/10 text-emerald-500" : trend === 'down' ? "bg-red-500/10 text-red-500" : "bg-zinc-500/10 text-zinc-500"
                    )}>
                        {trendValue}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-medium whitespace-nowrap uppercase tracking-wider">do período</span>
                </div>
            )}
            </div>
        )}
      </div>
    </div>
  );
};

export function CardPattern({ mouseX, mouseY, randomString, isDark, variant = 'square' }: any) {
  let maskImage = useMotionTemplate`radial-gradient(250px at ${mouseX}px ${mouseY}px, white, transparent)`;
  let style = { maskImage, WebkitMaskImage: maskImage };

  return (
    <div className="pointer-events-none">
      <div className={cn(
          "absolute inset-0 [mask-image:linear-gradient(white,transparent)] group-hover/card:opacity-50",
          variant === 'circle' ? "rounded-full" : "rounded-[20px]"
      )}></div>
      <motion.div
        className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 group-hover/card:opacity-100 transition duration-500",
            variant === 'circle' ? "rounded-full" : "rounded-[20px]",
            isDark ? "from-black to-zinc-800" : "from-white to-zinc-100"
        )}
        style={style}
      />
      <motion.div
        className={cn(
            "absolute inset-0 opacity-0 group-hover/card:opacity-100 mix-blend-overlay transition duration-500",
            variant === 'circle' ? "rounded-full" : "rounded-[20px]"
        )}
        style={style}
      >
        <p className={cn(
            "absolute inset-x-0 text-xs h-full break-revert font-mono font-bold transition duration-500",
            isDark ? "text-white" : "text-zinc-300"
        )}>
          {randomString}
        </p>
      </motion.div>
    </div>
  );
}

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const generateRandomString = (length: number) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const Icon = ({ className, ...rest }: any) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className={className}
      {...rest}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
  );
};
