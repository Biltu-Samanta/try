import React from 'react';
import { Radio, Github, Twitter, Linkedin, Terminal, Globe2, Shield, Heart } from 'lucide-react';
import { GEO_NODES } from '../data/geoNodes';
import { GeoNode } from '../types';

interface FooterProps {
  onSelectNode: (node: GeoNode) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectNode }) => {
  return (
    <footer className="relative bg-black border-t border-[#1fea00]/20 pt-16 pb-12 px-4 sm:px-8 z-10 overflow-hidden">
      {/* Deep forest emerald subtle ambient reflection */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#002f06]/30 via-black to-black pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Brand & Mission Statement */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#002f06] border border-[#1fea00]/40 flex items-center justify-center text-[#1fea00] shadow-[0_0_15px_rgba(31,234,0,0.3)]">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <span className="font-display font-bold text-xl text-white tracking-wider">
                AETHERIA
              </span>
            </div>
            <p className="text-sm text-neutral-400 max-w-sm leading-relaxed">
              Combining geospatial intelligence, predictive risk analysis, real-time tracking, and adaptive routing to keep essential supplies moving.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                id="footer-social-github"
                className="w-9 h-9 rounded-xl bg-[#002005] border border-[#1fea00]/20 flex items-center justify-center text-neutral-400 hover:text-[#1fea00] hover:border-[#1fea00]/50 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                id="footer-social-twitter"
                className="w-9 h-9 rounded-xl bg-[#002005] border border-[#1fea00]/20 flex items-center justify-center text-neutral-400 hover:text-[#1fea00] hover:border-[#1fea00]/50 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                id="footer-social-linkedin"
                className="w-9 h-9 rounded-xl bg-[#002005] border border-[#1fea00]/20 flex items-center justify-center text-neutral-400 hover:text-[#1fea00] hover:border-[#1fea00]/50 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="#explorer"
                id="footer-social-terminal"
                className="w-9 h-9 rounded-xl bg-[#002005] border border-[#1fea00]/20 flex items-center justify-center text-neutral-400 hover:text-[#1fea00] hover:border-[#1fea00]/50 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                aria-label="Terminal"
              >
                <Terminal className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Calibrated Ground Stations Fly-To */}
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider text-[#1fea00] uppercase mb-4">
              Ground Stations
            </h4>
            <ul className="space-y-2.5 text-xs font-mono text-neutral-400">
              {GEO_NODES.slice(0, 4).map((node) => (
                <li key={node.id}>
                  <button
                    onClick={() => {
                      onSelectNode(node);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-emerald-300 transition-colors text-left flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1fea00]/60" />
                    <span>{node.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Architecture Links */}
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider text-[#1fea00] uppercase mb-4">
              Geospatial Stack
            </h4>
            <ul className="space-y-2.5 text-xs text-neutral-400">
              <li>
                <a href="#capabilities" className="hover:text-white transition-colors">
                  Digital Elevation Models
                </a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-white transition-colors">
                  Synthetic Aperture Radar
                </a>
              </li>
              <li>
                <a href="#telemetry" className="hover:text-white transition-colors">
                  LiDAR Point Cloud Engine
                </a>
              </li>
              <li>
                <a href="#mission" className="hover:text-white transition-colors">
                  Orbital Constellation Sync
                </a>
              </li>
            </ul>
          </div>

          {/* Telemetry Status */}
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wider text-[#1fea00] uppercase mb-4">
              Platform Status
            </h4>
            <div className="p-3.5 rounded-xl bg-[#001404] border border-[#1fea00]/20 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-neutral-300">
                <span>ORBIT CLUSTERS</span>
                <span className="text-[#1fea00] font-bold">100% OPERATIONAL</span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>GROUND DOWNLINKS</span>
                <span className="text-white">78 / 78 ACTIVE</span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>AVERAGE JITTER</span>
                <span className="text-emerald-300">0.42 ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-500">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} AETHERIA GEOSPATIAL INTELLIGENCE PLATFORM</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-neutral-400 cursor-pointer">PRIVACY PROTOCOL</span>
            <span className="hover:text-neutral-400 cursor-pointer">SPATIAL COMPLIANCE</span>
            <span className="hover:text-neutral-400 cursor-pointer">SECURITY DISCLOSURE</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
