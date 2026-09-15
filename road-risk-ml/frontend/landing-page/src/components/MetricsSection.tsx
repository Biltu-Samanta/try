import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Radio, Cpu, Network, Zap } from 'lucide-react';
import { LiquidGlassCard } from './LiquidGlassCard';

export const MetricsSection: React.FC = () => {
  const [ticker, setTicker] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const mY0 = useTransform(scrollYProgress, [0, 1], [25, -25]);
  const mY1 = useTransform(scrollYProgress, [0, 1], [45, -45]);
  const mY2 = useTransform(scrollYProgress, [0, 1], [25, -25]);
  const mY3 = useTransform(scrollYProgress, [0, 1], [45, -45]);
  const metricYTransforms = [mY0, mY1, mY2, mY3];

  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((prev) => (prev + 1) % 1000);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      label: 'Orbital Satellites in Constellation',
      value: '842',
      unit: 'Nodes Active',
      sub: 'Laser inter-satellite mesh active',
      icon: Network,
    },
    {
      label: 'Elevation InSAR Resolution',
      value: '0.15',
      unit: 'Meters / Pixel',
      sub: 'LiDAR-ground calibrated',
      icon: Cpu,
    },
    {
      label: 'Global Interconnect Latency',
      value: (14.2 + Math.sin(ticker) * 0.4).toFixed(1),
      unit: 'Milliseconds',
      sub: 'Optical downlink edge nodes',
      icon: Zap,
    },
    {
      label: 'Streaming Ingest Volume',
      value: '4.8',
      unit: 'Petabytes / Day',
      sub: 'Autonomous neural categorization',
      icon: Radio,
    },
  ];

  return (
    <section ref={sectionRef} id="telemetry" className="relative py-28 px-4 sm:px-8 max-w-7xl mx-auto z-10">
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-16"
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
          Continuous Logistics Intelligence Across the Northeast
        </h2>
        <p className="text-base sm:text-lg text-neutral-300 leading-relaxed">
          Real-time network telemetry measured across global ground receivers, orbital laser arrays,
          and distributed GPU inference clusters.
        </p>
      </motion.div>

      {/* Metrics Cards with staggered scroll entry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              style={{ y: metricYTransforms[idx] }}
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="h-full"
            >
              <LiquidGlassCard glow={false} className="p-7 h-full flex flex-col justify-between border-white/[0.08] hover:border-white/20 bg-transparent hover:bg-white/[0.015]">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-mono text-neutral-300 px-2 py-0.5 rounded bg-white/[0.03] border border-white/10 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white font-display mb-1 flex items-baseline gap-1.5">
                    <span>{stat.value}</span>
                    <span className="text-xs font-mono font-normal text-neutral-400">{stat.unit}</span>
                  </div>
                  <div className="text-xs font-medium text-neutral-300 mt-2">{stat.label}</div>
                </div>
                <div className="text-[11px] font-mono text-neutral-400 mt-4 pt-3 border-t border-white/[0.07]">
                  {stat.sub}
                </div>
              </LiquidGlassCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
