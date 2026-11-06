import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
    value: number;
    format: (n: number) => string;
    durationMs?: number;
}

/** Número que "conta" até o valor final; respeita quem prefere menos movimento. */
export function AnimatedNumber({ value, format, durationMs = 900 }: AnimatedNumberProps) {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(0);

    useEffect(() => {
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduce || !Number.isFinite(value)) {
            setDisplay(value);
            fromRef.current = value;
            return;
        }
        const from = fromRef.current;
        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
            const p = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(from + (value - from) * eased);
            if (p < 1) frame = requestAnimationFrame(tick);
            else fromRef.current = value;
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value, durationMs]);

    return <>{format(display)}</>;
}
