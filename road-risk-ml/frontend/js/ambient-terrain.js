/**
 * NorthEastRiskAI — Ambient Geospatial Topography & Telemetry Canvas
 * Renders realistic Himalayan digital elevation contours, geodetic graticules,
 * corridor transponders, and satellite InSAR telemetry sweeps.
 */

(function initAmbientTopography() {
  const canvas = document.getElementById('ambient-topography-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let animId = null;

  // Mouse parallax tracking for realistic 3D contour depth
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;

  window.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 40;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 40;
  }, { passive: true });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Real Northeast Strategic Corridors with relative normalized coordinates (0..1)
  const BEACONS = [
    { name: 'IMPHAL VALLEY [NH-2/NH-37]', rx: 0.72, ry: 0.65, elv: '786m', status: 'MONITORED' },
    { name: 'SHILLONG PLATEAU [NH-6]', rx: 0.42, ry: 0.48, elv: '1,525m', status: 'ACTIVE' },
    { name: 'SILIGURI ARTERY [AH-2]', rx: 0.18, ry: 0.38, elv: '122m', status: 'OPTIMAL' },
    { name: 'TAWANG MOUNTAIN PASS [NH-13]', rx: 0.32, ry: 0.22, elv: '3,048m', status: 'CAUTION' },
    { name: 'KOHIMA-MANIPUR RIDGE [NH-29]', rx: 0.76, ry: 0.42, elv: '1,444m', status: 'ACTIVE' },
    { name: 'GANGTOK-SEVA ROAD [NH-10]', rx: 0.22, ry: 0.28, elv: '1,650m', status: 'STABLE' },
    { name: 'AIZAWL HILL RANGE [NH-54]', rx: 0.62, ry: 0.82, elv: '1,132m', status: 'MONITORED' },
    { name: 'BRAHMAPUTRA TRANSIT [NH-27]', rx: 0.48, ry: 0.32, elv: '55m', status: 'ACTIVE' },
  ];

  // Mountain contour field parameters
  const NUM_CONTOURS = 14;
  let time = 0;

  function draw() {
    time += 0.008;

    // Smooth mouse parallax damping
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Organic Topographic Elevation Contours (Himalayan / Northeast terrain)
    ctx.lineWidth = 1;
    for (let c = 0; c < NUM_CONTOURS; c++) {
      const isIndex = c % 4 === 0;
      const progress = c / NUM_CONTOURS;
      const baseY = height * (0.15 + progress * 0.75) + mouseY * (progress * 0.5 + 0.3);

      ctx.beginPath();

      const alpha = isIndex ? 0.13 : 0.055;
      ctx.strokeStyle = isIndex
        ? `rgba(31, 234, 0, ${alpha + Math.sin(time + c) * 0.02})`
        : `rgba(0, 220, 160, ${alpha})`;
      ctx.lineWidth = isIndex ? 1.4 : 0.75;

      const segments = 24;
      for (let s = 0; s <= segments; s++) {
        const x = (s / segments) * width;
        const normX = x / width;

        // Realistic multi-frequency topographic ridges
        const wave1 = Math.sin(normX * 4.2 + time * 0.3 + c * 0.4) * 38;
        const wave2 = Math.cos(normX * 8.5 - time * 0.2 + c * 0.6) * 18;
        const wave3 = Math.sin(normX * 14.0 + c * 0.8) * 8;
        const valleyDip = Math.sin(normX * Math.PI) * 45; // Broad tectonic valley form

        const y = baseY + wave1 + wave2 + wave3 - valleyDip + (mouseX * (s / segments - 0.5) * 0.3);

        if (s === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        // Draw periodic elevation labels on major index contours
        if (isIndex && (s === 6 || s === 18)) {
          const elevNumber = 600 + c * 220;
          ctx.font = '9px "JetBrains Mono", Consolas, monospace';
          ctx.fillStyle = 'rgba(31, 234, 0, 0.22)';
          ctx.fillText(`${elevNumber}m`, x + 5, y - 4);
        }
      }
      ctx.stroke();
    }

    // 2. Realistic Orbital InSAR Radar Telemetry Swath Beam
    const swathX = ((time * 35) % (width + 300)) - 150;
    const swathGrad = ctx.createLinearGradient(swathX - 90, 0, swathX + 90, 0);
    swathGrad.addColorStop(0, 'rgba(31, 234, 0, 0)');
    swathGrad.addColorStop(0.5, 'rgba(31, 234, 0, 0.05)');
    swathGrad.addColorStop(0.95, 'rgba(31, 234, 0, 0.12)');
    swathGrad.addColorStop(1, 'rgba(31, 234, 0, 0.25)');

    ctx.fillStyle = swathGrad;
    ctx.fillRect(swathX - 90, 0, 180, height);

    // Leading edge beam
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(31, 234, 0, 0.28)';
    ctx.lineWidth = 1;
    ctx.moveTo(swathX + 90, 0);
    ctx.lineTo(swathX + 90, height);
    ctx.stroke();

    // 3. Northeast Strategic Corridor Telemetry Waypoints
    BEACONS.forEach((b, idx) => {
      const bx = b.rx * width + mouseX * 0.4;
      const by = b.ry * height + mouseY * 0.4;

      const pulseRate = time * 2.5 + idx * 1.3;
      const pulseRadius = 5 + (Math.sin(pulseRate) + 1) * 7;
      const pulseAlpha = Math.max(0, 0.45 - (pulseRadius / 20));

      // Outer radar pulse
      ctx.beginPath();
      ctx.arc(bx, by, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(31, 234, 0, ${pulseAlpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Core anchor node
      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#1fea00';
      ctx.shadowColor = '#1fea00';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // Crosshair ticks
      ctx.strokeStyle = 'rgba(31, 234, 0, 0.28)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by); ctx.lineTo(bx + 6, by);
      ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by + 6);
      ctx.stroke();

      // Corridor Label & Elevation
      ctx.font = '9px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = 'rgba(160, 255, 180, 0.45)';
      ctx.fillText(b.name, bx + 10, by - 2);

      ctx.font = '8px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = 'rgba(31, 234, 0, 0.35)';
      ctx.fillText(`ELV ${b.elv} · ${b.status}`, bx + 10, by + 9);
    });

    // 4. Subtle Ambient Corner Telemetry Data Grids
    ctx.font = '9px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = 'rgba(31, 234, 0, 0.18)';
    ctx.fillText('GIS/DEM ELEVATION MODEL : EASTERN HIMALAYAN SECTOR', 24, height - 36);
    ctx.fillText(`SENSOR INGEST : ${(34.2 + Math.sin(time) * 1.5).toFixed(1)} GB/s · SYNCHRONIZED`, 24, height - 22);

    ctx.restore();

    if (!document.hidden) {
      animId = requestAnimationFrame(draw);
    }
  }

  // Lifecycle & Performance optimization
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animId) cancelAnimationFrame(animId);
    } else {
      animId = requestAnimationFrame(draw);
    }
  });

  animId = requestAnimationFrame(draw);
})();
