import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

export function ParticleGlobe({ className }: { className?: string }) {
    const globeRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Make the globe responsive
    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Setup globe physics strictly
    useEffect(() => {
        if (!globeRef.current) return;

        const controls = globeRef.current.controls();
        // Enable auto-rotate
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
        // Disable zoom for a cleaner bg feel
        controls.enableZoom = false;

        // Optional: add a tiny bit of "bounce" to the camera
        globeRef.current.pointOfView({ z: 2.2 }, 4000);
    }, []);

    return (
        <div className={`absolute inset-0 flex items-center justify-center opacity-60 z-0 select-none overflow-hidden ${className || ''}`}>
            <Globe
                ref={globeRef}
                width={dimensions.width}
                height={dimensions.height}
                // Essential mappings to make it look like the magical dot-globe from the screenshot:
                // A black/dark blue textured earth where city lights pop as dots
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                // Setup background as transparent to bleed the parent Tailwind CSS gradient grids
                backgroundColor="rgba(0,0,0,0)"
                showAtmosphere={true}
                atmosphereColor="#6b21a8" // Purple atmosphere glow matching our Googlar theme
                atmosphereAltitude={0.15}
            />
        </div>
    );
}
