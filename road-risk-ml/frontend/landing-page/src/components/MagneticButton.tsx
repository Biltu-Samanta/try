import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'glass';
  id?: string;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  onClick,
  className = '',
  variant = 'primary',
  id = 'magnetic-button',
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = buttonRef.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const deltaX = (clientX - centerX) * 0.35;
    const deltaY = (clientY - centerY) * 0.35;
    setPosition({ x: deltaX, y: deltaY });
    setGlowPos({
      x: ((clientX - left) / width) * 100,
      y: ((clientY - top) / height) * 100,
    });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const isPrimary = variant === 'primary';

  return (
    <motion.button
      ref={buttonRef}
      id={id}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 240, damping: 18, mass: 0.4 }}
      whileTap={{ scale: 0.94 }}
      className={`relative group inline-flex items-center justify-center font-medium tracking-wide transition-all cursor-pointer select-none overflow-hidden ${
        isPrimary
          ? 'px-8 py-4 rounded-xl text-black font-semibold bg-gradient-to-r from-[#1fea00] to-[#12bd00] shadow-[0_0_30px_rgba(31,234,0,0.45)] hover:shadow-[0_0_50px_rgba(31,234,0,0.7)]'
          : 'px-7 py-3.5 rounded-xl text-white font-medium bg-[#002f06]/40 hover:bg-[#002f06]/70 border border-[#1fea00]/30 hover:border-[#1fea00]/60 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
      } ${className}`}
    >
      {/* Interactive Cursor Spotlight Glint inside Button */}
      <span
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 90px at ${glowPos.x}% ${glowPos.y}%, rgba(255, 255, 255, ${isPrimary ? '0.35' : '0.18'}), transparent 70%)`,
        }}
      />

      {/* Specular sheen refraction sweep */}
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />

      {/* Top subtle highlight rim */}
      <span className="absolute top-0 inset-x-0 h-px bg-white/40 pointer-events-none" />

      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};
