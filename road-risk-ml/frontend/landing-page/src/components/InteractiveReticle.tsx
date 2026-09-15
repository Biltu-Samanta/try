import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'motion/react';

interface ClickRipple {
  id: number;
  x: number;
  y: number;
}

export const InteractiveReticle: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [ripples, setRipples] = useState<ClickRipple[]>([]);

  // Raw mouse coordinates
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Smooth springs for trailing outer reticle
  const springConfig = { stiffness: 450, damping: 28, mass: 0.2 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Spotlight springs for ambient glow illumination
  const spotlightConfig = { stiffness: 120, damping: 25 };
  const spotlightX = useSpring(mouseX, spotlightConfig);
  const spotlightY = useSpring(mouseY, spotlightConfig);

  // High-performance direct DOM motion template
  const spotlightBackground = useMotionTemplate`radial-gradient(650px circle at ${spotlightX}px ${spotlightY}px, rgba(31, 234, 0, 0.07), transparent 75%)`;

  useEffect(() => {
    // Only enable on pointer-fine devices (desktops/laptops with mouse/trackpad)
    if (window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);

      // Check if hovering interactive element
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest('button') ||
          target.closest('a') ||
          target.closest('input') ||
          target.closest('.cursor-pointer') ||
          target.closest('.glass-panel-glow') ||
          target.closest('[role="button"]')
        );
        setIsHovered(isInteractive);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      setIsMouseDown(true);
      const newRipple = { id: Date.now(), x: e.clientX, y: e.clientY };
      setRipples((prev) => [...prev.slice(-3), newRipple]);
    };

    const handleMouseUp = () => {
      setIsMouseDown(false);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible, mouseX, mouseY]);

  // Clean up old click ripples
  useEffect(() => {
    if (ripples.length === 0) return;
    const timer = setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, 600);
    return () => clearTimeout(timer);
  }, [ripples]);

  if (!isVisible) return null;

  return (
    <>
      {/* Dynamic Cursor Spotlight Layer in background */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-[2] overflow-hidden"
        style={{
          background: spotlightBackground,
        }}
      />

      {/* Click Sonar Ripples */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute rounded-full border border-[#1fea00] shadow-[0_0_15px_rgba(31,234,0,0.6)]"
            style={{
              width: 32,
              height: 32,
              left: ripple.x - 16,
              top: ripple.y - 16,
            }}
          />
        ))}
      </div>

      {/* Cybernetic Reticle Cursor Container */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {/* Crisp Laser Dot (instant positioning) */}
        <motion.div
          className="absolute rounded-full bg-[#1fea00] shadow-[0_0_8px_#1fea00]"
          style={{
            x: mouseX,
            y: mouseY,
            translateX: '-50%',
            translateY: '-50%',
            width: isMouseDown ? 3 : isHovered ? 6 : 4,
            height: isMouseDown ? 3 : isHovered ? 6 : 4,
            transition: 'width 0.15s, height 0.15s',
          }}
        />

        {/* Outer Spring-Damped Targeting Reticle Ring */}
        <motion.div
          className="absolute rounded-full border flex items-center justify-center"
          style={{
            x: smoothX,
            y: smoothY,
            translateX: '-50%',
            translateY: '-50%',
            width: isHovered ? 44 : isMouseDown ? 18 : 28,
            height: isHovered ? 44 : isMouseDown ? 18 : 28,
            borderColor: isHovered
              ? 'rgba(31, 234, 0, 0.7)'
              : 'rgba(31, 234, 0, 0.35)',
            boxShadow: isHovered
              ? '0 0 16px rgba(31, 234, 0, 0.45)'
              : '0 0 8px rgba(31, 234, 0, 0.15)',
            transition: 'width 0.2s ease-out, height 0.2s ease-out, border-color 0.2s, box-shadow 0.2s',
          }}
        >
          {/* Cybernetic target corner crosshairs when hovering interactive targets */}
          {isHovered && (
            <>
              <span className="absolute top-[-2px] left-1/2 -translate-x-1/2 w-1.5 h-[1.5px] bg-[#1fea00]" />
              <span className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-1.5 h-[1.5px] bg-[#1fea00]" />
              <span className="absolute left-[-2px] top-1/2 -translate-y-1/2 h-1.5 w-[1.5px] bg-[#1fea00]" />
              <span className="absolute right-[-2px] top-1/2 -translate-y-1/2 h-1.5 w-[1.5px] bg-[#1fea00]" />
            </>
          )}
        </motion.div>
      </div>
    </>
  );
};
