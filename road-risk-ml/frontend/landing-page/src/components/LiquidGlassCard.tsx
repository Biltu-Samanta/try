import React, { useRef, useState } from 'react';
import { motion, useSpring } from 'motion/react';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  glow?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  className = '',
  id,
  glow = false,
  interactive = false,
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  // Smooth 3D tilt spring physics
  const springConfig = { stiffness: 260, damping: 20, mass: 0.5 };
  const rotateX = useSpring(0, springConfig);
  const rotateY = useSpring(0, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlarePos({ x, y });

    // Calculate subtle 3D tilt angle based on mouse distance from center
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-normY * 10);
    rotateY.set(normX * 10);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      id={id}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 900,
      }}
      whileHover={interactive ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
      className={`relative rounded-2xl overflow-hidden transition-shadow duration-300 ${
        glow
          ? 'glass-panel-glow'
          : 'glass-panel'
      } ${interactive ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Liquid Glare Highlight responding to cursor position */}
      {isHovered && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 280px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.06), transparent 70%)`,
          }}
        />
      )}

      {/* Perimeter delicate bevel highlight */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl border border-white/[0.06]" />

      {/* Top light reflection border */}
      <div className="absolute top-0 inset-x-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Card Content with 3D depth pop */}
      <div className="relative z-10 p-6 md:p-8" style={{ transform: isHovered ? 'translateZ(18px)' : 'translateZ(0px)', transition: 'transform 0.25s ease-out' }}>
        {children}
      </div>
    </motion.div>
  );
};
