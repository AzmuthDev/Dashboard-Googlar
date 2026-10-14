"use client";
import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { BarChart3, Users, Lightbulb, Activity, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const dashboardTabs = [
    { id: 1, title: "Analytics", icon: <BarChart3 className="w-4 h-4" />, src: "https://images.unsplash.com/photo-1551288049-bbda48658a7d?q=80&w=2070", alt: "Performance" },
    { id: 2, title: "Negativação", icon: <Users className="w-4 h-4" />, src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015", alt: "Gestão" },
    { id: 3, title: "Insights", icon: <Lightbulb className="w-4 h-4" />, src: "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070", alt: "Relatórios" },
    { id: 4, title: "Atividade", icon: <Activity className="w-4 h-4" />, src: "https://images.unsplash.com/photo-1504868584819-f8e90526354a?q=80&w=2070", alt: "Log de Atividades" },
    { id: 5, title: "Tendências", icon: <TrendingUp className="w-4 h-4" />, src: "https://images.unsplash.com/photo-1543286386-713bdd548da4?q=80&w=2070", alt: "Mercado" }
]

export function FeaturesDetail() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const sliderRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLDivElement>(null);

    // Auto-advance slides
    useEffect(() => {
        const slideInterval = setInterval(() => {
            setCurrentSlide((prev) => (prev === dashboardTabs.length - 1 ? 0 : prev + 1))
        }, 5000)
        return () => clearInterval(slideInterval)
    }, []);

    // Animação de entrada: IntersectionObserver em vez de ScrollTrigger, porque o scroll
    // do app acontece dentro do Layout (não na window) e o ScrollTrigger nunca disparava.
    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const reveal = () => gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" });
        if (typeof IntersectionObserver === "undefined") {
            reveal();
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                reveal();
                observer.disconnect();
            }
        }, { threshold: 0.05 });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={sectionRef}
            className="py-8 md:py-14 bg-card border border-border rounded-3xl mt-8 md:mt-10 px-5 md:px-10 shadow-xl"
            style={{ opacity: 0 }} // starts invisible, GSAP animates in
        >
            <div className="max-w-6xl mx-auto text-center md:text-left">
                {/* Header */}
                <h2 className="text-2xl sm:text-4xl font-bold mb-3 tracking-tight text-foreground">
                    Análise Profunda{" "}
                    <span className="text-muted-foreground font-normal">sem complicação</span>
                </h2>
                <p className="text-muted-foreground mb-6 md:mb-10 text-base sm:text-lg">
                    Otimize investimentos e valide termos de pesquisa em segundos.
                </p>

                {/* Slider */}
                <div
                    ref={sliderRef}
                    className="relative h-[280px] md:h-[460px] overflow-hidden mb-8 rounded-2xl shadow-2xl border border-border bg-muted"
                >
                    {dashboardTabs.map((tab, index) => (
                        <div
                            key={tab.id}
                            className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                        >
                            <img src={tab.src} alt={tab.alt} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent flex items-end p-4 sm:p-7">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white">
                                        {tab.icon}
                                    </span>
                                    <span className="text-white font-semibold text-xl md:text-2xl drop-shadow-md tracking-tight">
                                        {tab.title}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Slide progress dots */}
                    <div className="absolute bottom-4 right-5 flex gap-1.5 z-20">
                        {dashboardTabs.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentSlide(i)}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    i === currentSlide ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Tab buttons — B&W Blackout style */}
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    {dashboardTabs.map((tab, index) => (
                        <button
                            key={tab.id}
                            onClick={() => setCurrentSlide(index)}
                            className={cn(
                                "flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border",
                                currentSlide === index
                                    // Active: B&W Blackout
                                    ? "bg-foreground text-background border-foreground shadow-md scale-105"
                                    // Inactive: subtle, no blue
                                    : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/40 shadow-sm"
                            )}
                        >
                            {tab.icon}
                            {tab.title}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
