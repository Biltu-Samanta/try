import React, { useState, useEffect } from 'react';
import { useScroll, useSpring } from 'motion/react';
import { GeospatialScene } from './components/GeospatialScene';
import { HeroSection } from './components/HeroSection';
import { CapabilitiesSection } from './components/CapabilitiesSection';
import { MetricsSection } from './components/MetricsSection';
import { Footer } from './components/Footer';
import { InteractiveReticle } from './components/InteractiveReticle';
import { GEO_NODES } from './data/geoNodes';
import { GeoNode, ViewMode } from './types';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('globe');
  const [activeNode, setActiveNode] = useState<GeoNode | null>(GEO_NODES[0]);
  const [scrollProgress, setScrollProgress] = useState(0);

  // High-precision spring-smoothed scroll tracking for silky 60fps momentum
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 75,
    damping: 20,
    mass: 0.5,
    restDelta: 0.0001,
  });

  useEffect(() => {
    return smoothProgress.on('change', (latest) => {
      setScrollProgress(latest);
    });
  }, [smoothProgress]);

  const handleToggleTerrain = () => {
    setViewMode((prev) => (prev === 'terrain' ? 'globe' : 'terrain'));
  };

  const handleGetStarted = () => {
    setTimeout(() => {
      if (window.location.protocol === 'file:') {
        const path = window.location.pathname;
        if (path.includes('/dist/') || path.includes('\\dist\\')) {
          window.location.href = '../../index.html';
        } else {
          window.location.href = '../index.html';
        }
      } else {
        window.location.href = '/dashboard.html';
      }
    }, 120);
  };

  return (
    <div className="relative min-h-screen bg-[#000000] text-neutral-100 selection:bg-[#1fea00]/30 selection:text-[#1fea00] overflow-x-hidden">
      {/* Real 3D Geospatial MapLibre GL Engine with Globe Projection & 3D Terrain */}
      <GeospatialScene
        activeNode={activeNode}
        onSelectNode={setActiveNode}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        scrollProgress={scrollProgress}
      />

      {/* Atmospheric Ambient Light Gradients with Scroll-Adaptive Contrast */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] transition-opacity duration-300 bg-radial from-transparent via-[#000000]/50 to-[#000000]/85"
        style={{ opacity: 0.3 + scrollProgress * 0.45 }}
      />

      {/* Main Content Layout */}
      <main className="relative z-10">
        <HeroSection
          onGetStarted={handleGetStarted}
          onExploreTerrain={handleToggleTerrain}
          viewMode={viewMode}
          activeNode={activeNode}
          onSelectNode={setActiveNode}
          nodes={GEO_NODES}
        />

        <CapabilitiesSection />

        <MetricsSection />
      </main>

      {/* Footer */}
      <Footer onSelectNode={setActiveNode} />

      {/* Cybernetic Mouse Reticle, Spotlight & Click Wave Animations */}
      <InteractiveReticle />
    </div>
  );
}
