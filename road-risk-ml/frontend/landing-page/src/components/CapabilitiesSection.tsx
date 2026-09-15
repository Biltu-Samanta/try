import React, { useState, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Mountain, Radar, Satellite, Zap } from 'lucide-react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { CAPABILITIES } from '../data/geoNodes';

export const CapabilitiesSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const cardY0 = useTransform(scrollYProgress, [0, 1], [35, -35]);
  const cardY1 = useTransform(scrollYProgress, [0, 1], [55, -55]);
  const cardY2 = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const cardYTransforms = [cardY0, cardY1, cardY2];

  const capabilitiesList = CAPABILITIES.filter((cap) => cap.id !== 'neural');

  const getIcon = (type: string, isHovered: boolean) => {
    const iconClass = `w-7 h-7 transition-all duration-300 ${
      isHovered ? 'text-white scale-110 drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]' : 'text-neutral-300'
    }`;
    switch (type) {
      case 'mountain':
        return <Mountain className={iconClass} />;
      case 'radar':
        return <Radar className={iconClass} />;
      case 'satellite':
        return <Satellite className={iconClass} />;
      default:
        return <Zap className={iconClass} />;
    }
  };

  return (
    <section ref={sectionRef} id="capabilities" className="relative py-28 px-4 sm:px-8 max-w-7xl mx-auto z-10">
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-16"
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
          Built for Unpredictable Roads
        </h2>
        <p className="text-base sm:text-lg text-neutral-300 leading-relaxed">
          Engineered from orbital physics to edge inference, delivering uninterrupted geospatial
          fidelity in any atmospheric condition.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {capabilitiesList.map((cap, idx) => {
          const isSelected = activeTab === idx;
          return (
            <motion.div
              key={cap.id}
              id={`capability-card-${cap.id}`}
              onClick={() => setActiveTab(idx)}
              style={{ y: cardYTransforms[idx] }}
              initial={{ opacity: 0, y: 45 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.65, delay: idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className="cursor-pointer"
            >
              <LiquidGlassCard
                glow={isSelected}
                className={`h-full flex flex-col justify-between p-6 sm:p-7 border transition-all ${
                  isSelected
                    ? 'border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.08)] bg-white/[0.025]'
                    : 'border-white/[0.08] hover:border-white/20 bg-transparent hover:bg-white/[0.015]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                      {getIcon(cap.iconType, isSelected)}
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-neutral-400 tracking-wider uppercase block mb-1">
                    {cap.tag}
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    {cap.title}
                  </h3>
                </div>
              </LiquidGlassCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
