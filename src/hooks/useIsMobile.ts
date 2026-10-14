import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

/** true quando a viewport está abaixo do breakpoint `md` (768px) do Tailwind. */
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

    useEffect(() => {
        const mql = window.matchMedia(QUERY)
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        setIsMobile(mql.matches)
        mql.addEventListener('change', onChange)
        return () => mql.removeEventListener('change', onChange)
    }, [])

    return isMobile
}
