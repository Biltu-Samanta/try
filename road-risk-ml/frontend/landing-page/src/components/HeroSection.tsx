import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { MagneticButton } from './MagneticButton';
import { GeoNode, ViewMode } from '../types';

interface HeroSectionProps {
  onGetStarted: () => void;
  onExploreTerrain?: () => void;
  viewMode?: ViewMode;
  activeNode?: GeoNode | null;
  onSelectNode?: (node: GeoNode) => void;
  nodes?: GeoNode[];
}

const WORDS = ['Smart', 'Easy Navigate', 'Deliver'];

export const HeroSection: React.FC<HeroSectionProps> = ({
  onGetStarted,
}) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  // Smooth scroll parallax transitions
  const heroOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.65], [0, -70]);
  const heroScale = useTransform(scrollYProgress, [0, 0.65], [1, 0.94]);

  useEffect(() => {
    const currentWord = WORDS[wordIndex];

    if (!isDeleting && subIndex === currentWord.length) {
      const timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 1800);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && subIndex === 0) {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % WORDS.length);
      return;
    }

    const speed = isDeleting ? 45 : 95;
    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, speed);

    return () => clearTimeout(timeout);
  }, [subIndex, isDeleting, wordIndex]);

  const displayedWord = WORDS[wordIndex].substring(0, subIndex);

  return (
    <section
      ref={sectionRef}
      id="hero-section"
      className="relative min-h-screen flex flex-col justify-end px-6 sm:px-12 lg:px-16 pt-28 pb-16 sm:pb-24 max-w-7xl mx-auto pointer-events-none"
    >
      <div className="max-w-3xl mr-auto w-full">
        {/* Main Hero Copy with Scroll Parallax */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto"
        >
          {/* Cinematic Headline with Animated Typewriter Cycle */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl xl:text-8xl font-extrabold tracking-tight leading-[1.08] text-white mb-8 sm:mb-10 text-left">
            Now Logistics are
            <span className="block mt-2 sm:mt-3 min-h-[1.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#1fea00] via-emerald-300 to-green-100 drop-shadow-[0_0_35px_rgba(31,234,0,0.45)]">
              {displayedWord}
              <span className="inline-block w-[3px] sm:w-[5px] h-[0.8em] bg-[#1fea00] ml-2.5 align-middle animate-pulse shadow-[0_0_12px_#1fea00]" />
            </span>
          </h1>

          {/* Primary CTA */}
          <div className="flex items-center justify-start w-full">
            <MagneticButton
              id="hero-primary-cta"
              onClick={onGetStarted}
              variant="primary"
              className="text-base"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
            </MagneticButton>
          </div>
        </motion.div>
      </div>

    </section>
  );
};
