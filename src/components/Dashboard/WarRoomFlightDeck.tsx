import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Server, Database, GitBranch, Users, Pause, Cpu, ShieldAlert, Terminal, Tv, Eye, Calendar } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchAPI } from '../../utils/api';
import toast, { Toaster } from 'react-hot-toast';

// Sound system has been removed

interface WarRoomProps {
  isOpen: boolean;
  onClose: () => void;
  stats: any;
  recentLogs: any[];
}

interface Stardust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  friction?: number;
}

interface Particle {
  id: string;
  leadName: string;
  sourceType: string;
  status: 'assigned' | 'rejected' | 'duplicate' | 'compensation' | 'pending_work_hours' | 'reminder';
  saleName: string;
  saleIndex: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  duration: number;
  duration2: number;
  stage: 0 | 1 | 2; // 0: to core, 1: vetting at core, 2: to sale
  holdTime: number; // seconds remaining
  maxHoldTime: number; // initial hold time
  color: string;
  size: number;
  trail?: { x: number; y: number; alpha: number }[];
}

const getInitials = (name: string) => {
  if (!name) return 'LD';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
};

// ============================================================================
// SPACE CANVAS BACKGROUND (100% Isolated Canvas Loop, Framerate Independent)
// ============================================================================
const getQuadraticBezierPoint = (t: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number) => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
    y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y
  };
};

const SpaceCanvasBackground: React.FC<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  bootPhase: 'loading' | 'active' | 'shutting_down';
  coreRef: React.RefObject<HTMLDivElement | null>;
  coreSphereRef: React.RefObject<HTMLDivElement | null>;
  sourceRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  saleRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  particlesRef: React.MutableRefObject<Particle[]>;
  triggerSaleRipple: (idx: number, sourceName: string, sourceColor: string, particleId: string, status: 'assigned' | 'compensation' | 'pending_work_hours' | 'reminder') => void;
  triggerRetainedRipple: (particleId: string, status: 'rejected' | 'duplicate') => void;
  mockSources: any[];
  salesList: any[];
  coordsRef: React.MutableRefObject<{
    sources: { x: number; y: number }[];
    core: { x: number; y: number };
    sales: { x: number; y: number }[];
  }>;
  lastActiveSaleIdx: number | null;
  isFocusMode: boolean;
  isRetainedGlow: boolean;
  isCoreHoveredRef: React.RefObject<boolean>;
  hoveredSaleIdx: number | null;
  hoveredSourceIdx: number | null;
  fairShareEquity: string;
  sheetsStatus: string;
  isTelemetryGlitch: boolean;
}> = React.memo(({
  containerRef,
  isPlaying,
  bootPhase,
  coreRef,
  coreSphereRef,
  sourceRefs,
  saleRefs,
  particlesRef,
  triggerSaleRipple,
  triggerRetainedRipple,
  mockSources,
  salesList,
  coordsRef,
  lastActiveSaleIdx,
  isFocusMode,
  isRetainedGlow,
  isCoreHoveredRef,
  hoveredSaleIdx,
  hoveredSourceIdx,
  fairShareEquity,
  sheetsStatus,
  isTelemetryGlitch
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Reference containerRef to satisfy TS6133 unused variable compiler rule
  if (containerRef) { /* no-op */ }

  // Stars with Parallax
  const starsRef = useRef<{
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
    fadeSpeed: number;
    layer: number;
    twinkleSpeed?: number;
    phase?: number;
  }[]>([]);

  // Subset of stars for Dynamic Constellation Links
  const constellationStarsIdxRef = useRef<number[]>([]);

  // Shooting Stars
  const shootingStarsRef = useRef<{
    x: number;
    y: number;
    speedX: number;
    speedY: number;
    len: number;
    opacity: number;
  }[]>([]);

  // Stardust Sparkles
  const stardustRef = useRef<Stardust[]>([]);

  // Mouse trail particles for stardust wormhole
  const mouseTrailRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string;
    decay: number;
  }[]>([]);

  // Laser beams for lead release
  const laserBeamsRef = useRef<{
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    progress: number;
    duration: number;
    color: string;
    width: number;
  }[]>([]);

  // 3D Core particles
  const core3DParticlesRef = useRef<{
    angle: number;
    speed: number;
    radiusX: number;
    radiusY: number;
    tilt: number;
    size: number;
    color: string;
    z: number;
  }[]>([]);

  // 3D Accretion Disk particles
  const accretionDiskRef = useRef<{
    angle: number;
    orbitRadius: number;
    speed: number;
    size: number;
    color: string;
    z: number;
    px: number;
    py: number;
  }[]>([]);

  // Screen glitch states
  const glitchActiveRef = useRef(false);
  const glitchTimerRef = useRef(0);
  const glitchDurationRef = useRef(0);
  const nextGlitchTimeRef = useRef(8.0);

  // Floating Nebula Clouds
  const nebulasRef = useRef([
    { x: 0.18, y: 0.28, r: 0.38, color: 'rgba(163, 20, 34, 0.10)', vx: 0.0018, vy: 0.0009 },
    { x: 0.82, y: 0.72, r: 0.46, color: 'rgba(189, 29, 45, 0.08)', vx: -0.0012, vy: 0.0016 },
    { x: 0.48, y: 0.42, r: 0.32, color: 'rgba(189, 29, 45, 0.09)', vx: 0.0014, vy: -0.0008 }
  ]);

  // Core Shockwaves
  const coreShockwavesRef = useRef<{
    radius: number;
    maxRadius: number;
    opacity: number;
    color: string;
    style: 'solid' | 'dashed' | 'sparks';
  }[]>([]);

  // Space-Time Liquid Grid Warp Ripples
  const gridRipplesRef = useRef<{
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    strength: number;
    speed: number;
  }[]>([]);

  // Red Matrix rain columns
  const matrixRainRef = useRef<{
    x: number;
    y: number;
    speed: number;
    chars: string[];
    opacity: number;
  }[]>([]);

  // Active lightning strikes triggered on successful release
  const activeLightningsRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    duration: number;
  }[]>([]);

  // Push propulsion shake intensity
  const pushShakeIntensityRef = useRef(0);

  // Core Glow Intensity
  const coreGlowIntensityRef = useRef(0);

  // Core Blast Intensity (for shrink-and-expand effect)
  const coreBlastIntensityRef = useRef(0);

  // Interactive mouse position
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  // Store last active sale index inside Ref to avoid restarting canvas useEffect loop
  const lastActiveSaleIdxRef = useRef<number | null>(null);
  lastActiveSaleIdxRef.current = lastActiveSaleIdx;

  const isRetainedGlowRef = useRef(isRetainedGlow);
  isRetainedGlowRef.current = isRetainedGlow;

  const hasTriggeredShutdownBlastRef = useRef(false);
  if (bootPhase !== 'shutting_down') {
    hasTriggeredShutdownBlastRef.current = false;
  }

  // Layout Measurement
  const recalculateCoordinates = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const isPortrait = window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;

    const width = isPortrait ? canvasRect.height : canvasRect.width;
    const height = isPortrait ? canvasRect.width : canvasRect.height;

    const getOffsetCenter = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const physCenterX = rect.left + rect.width / 2;
      const physCenterY = rect.top + rect.height / 2;

      if (isPortrait) {
        return {
          x: physCenterY - canvasRect.top,
          y: canvasRect.right - physCenterX
        };
      } else {
        return {
          x: physCenterX - canvasRect.left,
          y: physCenterY - canvasRect.top
        };
      }
    };

    const coreEl = coreRef.current;
    let coreX = width / 2;
    let coreY = height / 2;
    if (coreEl) {
      const pos = getOffsetCenter(coreEl);
      coreX = pos.x;
      coreY = pos.y;
    }

    const sources = mockSources.map((_, idx) => {
      const srcEl = sourceRefs.current[idx];
      if (srcEl) {
        const rect = srcEl.getBoundingClientRect();
        const center = getOffsetCenter(srcEl);
        const localWidth = isPortrait ? rect.height : rect.width;
        return {
          x: center.x + localWidth / 2 - 8,
          y: center.y
        };
      }
      return { x: 220, y: 150 + idx * 160 };
    });

    const sales = salesList.map((_, idx) => {
      const saleEl = saleRefs.current[idx];
      if (saleEl) {
        const rect = saleEl.getBoundingClientRect();
        const center = getOffsetCenter(saleEl);
        const localWidth = isPortrait ? rect.height : rect.width;
        return {
          x: center.x - localWidth / 2 + 8,
          y: center.y
        };
      }
      return { x: width - 290, y: 150 + idx * 90 };
    });

    coordsRef.current = { sources, core: { x: coreX, y: coreY }, sales };
  };

  useEffect(() => {
    recalculateCoordinates();
    const timer = setTimeout(recalculateCoordinates, 100);
    return () => clearTimeout(timer);
  }, [isFocusMode]);

  useEffect(() => {
    if (isRetainedGlow) {
      const coords = coordsRef.current;
      const coreX = coords.core.x;
      const coreY = coords.core.y;

      // Spawn red matrix binary code columns falling down around the core
      for (let i = 0; i < 28; i++) {
        const spawnX = coreX - 180 + Math.random() * 360;
        const spawnY = coreY - 100 + Math.random() * 80;
        const speed = 150 + Math.random() * 220;
        const len = 6 + Math.floor(Math.random() * 9);
        const chars = Array.from({ length: len }, () => Math.random() > 0.5 ? '1' : '0');
        matrixRainRef.current.push({
          x: spawnX,
          y: spawnY,
          speed,
          chars,
          opacity: 1.0
        });
      }
    }
  }, [isRetainedGlow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      const cssHeight = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      recalculateCoordinates();
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const isPortrait = window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
      const mX = isPortrait ? (e.clientY - rect.top) : (e.clientX - rect.left);
      const mY = isPortrait ? (rect.right - e.clientX) : (e.clientY - rect.top);

      const dx = mX - mouseRef.current.x;
      const dy = mY - mouseRef.current.y;

      mouseRef.current = {
        x: mX,
        y: mY,
        active: true
      };

      // Spawn stardust trails from mouse movement
      if (Math.random() < 0.85) {
        for (let i = 0; i < 2; i++) {
          mouseTrailRef.current.push({
            x: mX,
            y: mY,
            vx: (Math.random() - 0.5) * 16 + dx * 0.12,
            vy: (Math.random() - 0.5) * 16 + dy * 0.12,
            size: 0.8 + Math.random() * 1.8,
            alpha: 0.85,
            color: Math.random() > 0.5 ? '#e63946' : '#60a5fa',
            decay: 1.2 + Math.random() * 1.4
          });
        }
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const isPortrait = window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
      const clickX = isPortrait ? (e.clientY - rect.top) : (e.clientX - rect.left);
      const clickY = isPortrait ? (rect.right - e.clientX) : (e.clientY - rect.top);

      // Register Warp ripple
      gridRipplesRef.current.push({
        x: clickX,
        y: clickY,
        radius: 0,
        maxRadius: 460,
        strength: 0.7,
        speed: 550 // pixels per second
      });

      // Also trigger canvas sparks shockwave where clicked
      coreShockwavesRef.current.push({
        radius: 6,
        maxRadius: 180,
        opacity: 0.8,
        color: 'rgba(189, 29, 45, 0.45)',
        style: 'solid'
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleCanvasClick);

    // Initialize stars - SLOW space journey
    if (starsRef.current.length === 0) {
      const tempStars = [];
      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      for (let i = 0; i < 220; i++) {
        const layer = Math.floor(Math.random() * 3);
        let size = 0.4 + Math.random() * 0.4;
        let speedX = -0.015 - Math.random() * 0.015; // super slow drift
        if (layer === 1) {
          size = 0.7 + Math.random() * 0.4;
          speedX = -0.04 - Math.random() * 0.03;
        } else if (layer === 2) {
          size = 1.2 + Math.random() * 0.6;
          speedX = -0.09 - Math.random() * 0.06;
        }

        const phase = Math.random() * Math.PI * 2;
        const twinkleSpeed = 0.3 + Math.random() * 0.6;
        tempStars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size,
          speedX,
          speedY: (Math.random() - 0.5) * 0.015,
          opacity: 0.15 + (Math.sin(phase) * 0.5 + 0.5) * 0.8,
          fadeSpeed: 0,
          layer,
          twinkleSpeed,
          phase
        });
      }
      starsRef.current = tempStars;

      // Select constellation node stars (Layer 0 & 1 only, up to 55)
      const constellationCandidateIndices: number[] = [];
      tempStars.forEach((star, idx) => {
        if (star.layer < 2) constellationCandidateIndices.push(idx);
      });
      constellationStarsIdxRef.current = constellationCandidateIndices
        .sort(() => 0.5 - Math.random())
        .slice(0, 55);
    }

    // Initialize Accretion Disk particles
    if (accretionDiskRef.current.length === 0) {
      const diskParticles = [];
      const colors = ['#e63946', '#ffffff', '#BD1D2D', '#BD1D2D', '#ffccd5'];
      for (let i = 0; i < 120; i++) {
        // Varying orbit radius from 58px to 142px
        const orbitRadius = 58 + Math.random() * 84;
        // Keplerian speed: speed is inversely proportional to square root of radius
        const speed = (2.2 / Math.sqrt(orbitRadius)) * (0.85 + Math.random() * 0.3);
        const size = 0.8 + Math.random() * 1.5;
        const color = colors[Math.floor(Math.random() * colors.length)];

        diskParticles.push({
          angle: Math.random() * Math.PI * 2,
          orbitRadius,
          speed,
          size,
          color,
          z: 0,
          px: 0,
          py: 0
        });
      }
      accretionDiskRef.current = diskParticles;
    }

    // Space-Time Gravity Warp Grid & Click Ripples calculation
    const distortPoint = (x: number, y: number, coreX: number, coreY: number, timeVal: number = 0) => {
      let dx = x;
      let dy = y;

      // 1. Einstein Ring Gravitational Lensing (Core gravity warp)
      const dxCore = x - coreX;
      const dyCore = y - coreY;
      const distCore = Math.sqrt(dxCore * dxCore + dyCore * dyCore);
      if (distCore > 0 && distCore < 360) {
        const RE = 110; // Einstein Radius
        const deflection = Math.sqrt(distCore * distCore + RE * RE) - distCore;
        const strength = Math.pow(1 - distCore / 360, 1.5);
        dx += (dxCore / distCore) * deflection * strength;
        dy += (dyCore / distCore) * deflection * strength;
      }

      // 1b. Core vortex twist on Core Hover
      if (isCoreHoveredRef.current && distCore > 0 && distCore < 320) {
        const factor = (1 - distCore / 320);
        const twistAngle = 0.15 * factor * Math.sin(timeVal * 0.0035);
        const cosT = Math.cos(twistAngle);
        const sinT = Math.sin(twistAngle);
        const rx = dx - coreX;
        const ry = dy - coreY;
        dx = coreX + (rx * cosT - ry * sinT);
        dy = coreY + (rx * sinT + ry * cosT);
      }

      // 2. Mouse gravity & twist wormhole
      if (mouseRef.current.active) {
        const dxMouse = mouseRef.current.x - dx;
        const dyMouse = mouseRef.current.y - dy;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        if (distMouse > 0 && distMouse < 220) {
          const pull = 0.22 * Math.exp(-Math.pow(distMouse / 95, 2));
          dx += dxMouse * pull;
          dy += dyMouse * pull;

          // Vortex rotation twist
          const twistAngle = 0.25 * Math.exp(-Math.pow(distMouse / 70, 2));
          const cosT = Math.cos(twistAngle);
          const sinT = Math.sin(twistAngle);

          const rx = dx - mouseRef.current.x;
          const ry = dy - mouseRef.current.y;
          dx = mouseRef.current.x + (rx * cosT - ry * sinT);
          dy = mouseRef.current.y + (rx * sinT + ry * cosT);
        }
      }

      // 3. Liquid Space Grid Ripples on click
      gridRipplesRef.current.forEach(rip => {
        const dxRip = x - rip.x;
        const dyRip = y - rip.y;
        const distRip = Math.sqrt(dxRip * dxRip + dyRip * dyRip);
        if (distRip > 0 && distRip < rip.maxRadius) {
          const diff = Math.abs(distRip - rip.radius);
          if (diff < 70) {
            const strengthFactor = (1 - rip.radius / rip.maxRadius) * rip.strength;
            const wave = Math.sin((distRip - rip.radius) * 0.12) * 16 * strengthFactor;
            dx += (dxRip / distRip) * wave;
            dy += (dyRip / distRip) * wave;
          }
        }
      });

      return { x: dx, y: dy };
    };

    // Plasma Lightning energy arcs
    const drawLightning = (x1: number, y1: number, x2: number, y2: number, color: string) => {
      const steps = 7;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;

      const nx = -dy / len;
      const ny = dx / len;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const rx = x1 + dx * t;
        const ry = y1 + dy * t;
        const disp = (Math.random() - 0.5) * 11 * Math.sin(t * Math.PI);
        ctx.lineTo(rx + nx * disp, ry + ny * disp);
      }
      ctx.lineTo(x2, y2);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.strokeStyle = color + '66';
      ctx.lineWidth = 4.5;
      ctx.stroke();
    };

    // Drawing loop
    const draw = (timestamp: number) => {
      const deltaTime = Math.min(0.08, (timestamp - lastTime) / 1000);
      lastTime = timestamp;

      frameCount++;
      if (frameCount % 60 === 0) {
        recalculateCoordinates();
      }

      let maxCompression = 0;

      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;

      ctx.clearRect(0, 0, width, height);

      const coords = coordsRef.current;
      const coreX = coords.core.x;
      const coreY = coords.core.y;

      // Calculate gravitational vortex distortion for a star/particle
      const getDistortedStarPos = (sx: number, sy: number) => {
        let displayX = sx;
        let displayY = sy;

        // 1. Einstein Ring Gravitational Lensing (Deflecting background light around the Core)
        const dxCore = sx - coreX;
        const dyCore = sy - coreY;
        const distCore = Math.sqrt(dxCore * dxCore + dyCore * dyCore);
        if (distCore > 0 && distCore < 360) {
          const RE = 110; // Einstein Radius
          const deflection = Math.sqrt(distCore * distCore + RE * RE) - distCore;
          const strength = Math.pow(1 - distCore / 360, 1.5);
          displayX += (dxCore / distCore) * deflection * strength;
          displayY += (dyCore / distCore) * deflection * strength;
        }

        // 2. Mouse bending
        if (mouseRef.current.active) {
          const dxM = mouseRef.current.x - sx;
          const dyM = mouseRef.current.y - sy;
          const distM = Math.sqrt(dxM * dxM + dyM * dyM);
          if (distM < 160) {
            const pull = 0.16 * (1 - distM / 160);
            displayX += dxM * pull;
            displayY += dyM * pull;
          }
        }

        // 2. Gravitational Vortex (Click Ripples)
        gridRipplesRef.current.forEach(rip => {
          const dx = rip.x - displayX;
          const dy = rip.y - displayY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0 && dist < rip.maxRadius) {
            const wavefrontDist = dist - rip.radius;
            const widthLimit = 120;
            if (Math.abs(wavefrontDist) < widthLimit) {
              const factor = (1 - Math.abs(wavefrontDist) / widthLimit) * (1 - rip.radius / rip.maxRadius) * rip.strength;
              if (wavefrontDist > 0) {
                // Pull phase (spiral pull)
                const pull = factor * 0.85;
                displayX += dx * pull;
                displayY += dy * pull;

                const twist = factor * 0.9;
                const cosT = Math.cos(twist);
                const sinT = Math.sin(twist);
                const rx = displayX - rip.x;
                const ry = displayY - rip.y;
                displayX = rip.x + (rx * cosT - ry * sinT);
                displayY = rip.y + (rx * sinT + ry * cosT);
              } else {
                // Release/Burst phase (flung outwards)
                const push = factor * 1.6;
                displayX -= (dx / dist) * 110 * push;
                displayY -= (dy / dist) * 110 * push;
              }
            }
          }
        });

        return { x: displayX, y: displayY };
      };

      // Check if shutting down to trigger a massive physical particle blowout
      if (bootPhase === 'shutting_down' && !hasTriggeredShutdownBlastRef.current) {
        hasTriggeredShutdownBlastRef.current = true;

        // 1. Spawning 350 high-velocity explosive spark particles from center AI Core
        for (let i = 0; i < 350; i++) {
          const angle = Math.random() * Math.PI * 2;
          const velocity = 250 + Math.random() * 650; // high speed blowout
          const size = 1.2 + Math.random() * 3.5;
          const colors = ['#BD1D2D', '#BD1D2D', '#e63946', '#3b82f6', '#10b981', '#ffffff', '#ef4444'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          stardustRef.current.push({
            x: coreX,
            y: coreY,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            color,
            size,
            alpha: 1.0,
            decay: 0.6 + Math.random() * 0.9 // decay within 1-1.5s
          });
        }

        // 2. Trigger multiple nested grid warp ripples expanding outward at high speed
        for (let j = 0; j < 3; j++) {
          gridRipplesRef.current.push({
            x: coreX,
            y: coreY,
            radius: 0,
            maxRadius: 1800,
            strength: 2.8 - (j * 0.6),
            speed: 1200 + (j * 400)
          });
        }

        // 3. Create core shockwaves in rainbow/white overlay
        coreShockwavesRef.current.push({
          radius: 10,
          maxRadius: 800,
          opacity: 1.0,
          color: '#ffffff',
          style: 'solid'
        });
        coreShockwavesRef.current.push({
          radius: 10,
          maxRadius: 600,
          opacity: 1.0,
          color: '#e63946',
          style: 'sparks'
        });
      }

      // Update grid click ripples
      gridRipplesRef.current = gridRipplesRef.current.filter(rip => {
        rip.radius += rip.speed * deltaTime;
        return rip.radius < rip.maxRadius;
      });

      // Glitch simulation timer
      nextGlitchTimeRef.current -= deltaTime;
      if (nextGlitchTimeRef.current <= 0) {
        glitchActiveRef.current = true;
        glitchDurationRef.current = 0.08 + Math.random() * 0.15; // duration of glitch
        glitchTimerRef.current = 0;
        nextGlitchTimeRef.current = 10 + Math.random() * 15; // reset timer to 10-25s
      }

      let glitchOffsetX = 0;
      let glitchOffsetY = 0;

      // Decay and apply push propulsion shake
      if (pushShakeIntensityRef.current > 0) {
        pushShakeIntensityRef.current = Math.max(0, pushShakeIntensityRef.current - 45 * deltaTime);
        const intensity = pushShakeIntensityRef.current;
        glitchOffsetX += (Math.random() - 0.5) * intensity;
        glitchOffsetY += (Math.random() - 0.5) * intensity;
      }

      if (bootPhase === 'shutting_down') {
        // Build up massive screen shake/glitch effect towards exit
        glitchOffsetX += (Math.random() - 0.5) * 35;
        glitchOffsetY += (Math.random() - 0.5) * 20;

        // Randomly draw full screen lightning strikes directly on canvas
        if (Math.random() < 0.35) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(189, 29, 45, 0.25)' : 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(0, 0, width, height);

          // Random lightning bolts from core to window edge
          for (let bolts = 0; bolts < 3; bolts++) {
            const edgeX = Math.random() * width;
            const edgeY = Math.random() > 0.5 ? 0 : height;
            drawLightning(coreX, coreY, edgeX, edgeY, '#BD1D2D');
          }
        }
      } else if (glitchActiveRef.current) {
        glitchTimerRef.current += deltaTime;
        if (glitchTimerRef.current >= glitchDurationRef.current) {
          glitchActiveRef.current = false;
        } else {
          glitchOffsetX += (Math.random() - 0.5) * 12;
          glitchOffsetY += (Math.random() - 0.5) * 5;
        }
      }

      // Save canvas state and apply screen shake/glitch translation
      ctx.save();
      if (glitchActiveRef.current || bootPhase === 'shutting_down' || pushShakeIntensityRef.current > 0) {
        ctx.translate(glitchOffsetX, glitchOffsetY);
      }

      // Draw red screen glitch flash occasionally during retained state
      if (isRetainedGlowRef.current && Math.random() < 0.12) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(0, 0, width, height);
      }

      // 1. Glowing Space Nebula Background
      nebulasRef.current.forEach(neb => {
        neb.x += neb.vx * deltaTime;
        neb.y += neb.vy * deltaTime;
        if (neb.x < 0.02 || neb.x > 0.98) neb.vx *= -1;
        if (neb.y < 0.02 || neb.y > 0.98) neb.vy *= -1;

        const size = neb.r * Math.max(width, height);
        const grad = ctx.createRadialGradient(
          neb.x * width, neb.y * height, 0,
          neb.x * width, neb.y * height, size
        );
        grad.addColorStop(0, neb.color);
        grad.addColorStop(0.55, neb.color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1, $2, $3, 0.01)'));
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(neb.x * width, neb.y * height, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Tactical Warped Grid (BATCHED FOR 120HZ FEEL)
      ctx.strokeStyle = 'rgba(189, 29, 45, 0.03)';
      ctx.lineWidth = 0.8;
      const gridSize = 90;

      ctx.beginPath();
      for (let x = 0; x < width + gridSize; x += gridSize) {
        let first = true;
        for (let y = 0; y <= height + 50; y += 50) {
          const pt = distortPoint(x, y, coreX, coreY, timestamp);
          if (first) {
            ctx.moveTo(pt.x, pt.y);
            first = false;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
      for (let y = 0; y < height + gridSize; y += gridSize) {
        let first = true;
        for (let x = 0; x <= width + 50; x += 50) {
          const pt = distortPoint(x, y, coreX, coreY, timestamp);
          if (first) {
            ctx.moveTo(pt.x, pt.y);
            first = false;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
      ctx.stroke();

      // 3. Drifting background stars with mouse bending (BATCHED FOR 120HZ FEEL)
      const starsBin1: { x: number; y: number; r: number }[] = [];
      const starsBin2: { x: number; y: number; r: number }[] = [];
      const starsBin3: { x: number; y: number; r: number }[] = [];
      const layer2Stars: { x: number; y: number; size: number; opacity: number }[] = [];

      starsRef.current.forEach(star => {
        if (star.phase === undefined) star.phase = Math.random() * Math.PI * 2;
        if (star.twinkleSpeed === undefined) star.twinkleSpeed = 0.3 + Math.random() * 0.6;

        // Smooth wave-based twinkling
        star.phase += star.twinkleSpeed * deltaTime;
        star.opacity = 0.15 + (Math.sin(star.phase) * 0.5 + 0.5) * 0.8;

        // Smooth cosmic drift (adding slow vertical waving ocean-like motion)
        let starX = star.x + star.speedX * deltaTime * 60;
        let starY = star.y + (star.speedY + Math.sin(star.phase * 0.4) * 0.04) * deltaTime * 60;

        if (starX < 0) starX = width;
        if (starX > width) starX = 0;
        if (starY < 0) starY = height;
        if (starY > height) starY = 0;

        star.x = starX;
        star.y = starY;

        const distorted = getDistortedStarPos(star.x, star.y);
        const displayX = distorted.x;
        const displayY = distorted.y;

        if (star.layer === 2) {
          layer2Stars.push({ x: displayX, y: displayY, size: star.size, opacity: star.opacity });
        } else {
          if (star.opacity < 0.45) {
            starsBin1.push({ x: displayX, y: displayY, r: star.size });
          } else if (star.opacity < 0.75) {
            starsBin2.push({ x: displayX, y: displayY, r: star.size });
          } else {
            starsBin3.push({ x: displayX, y: displayY, r: star.size });
          }
        }
      });

      if (starsBin1.length > 0) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; // Dimmed background stars
        starsBin1.forEach(s => {
          ctx.moveTo(s.x + s.r, s.y);
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        });
        ctx.fill();
      }
      if (starsBin2.length > 0) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)'; // Dimmed background stars
        starsBin2.forEach(s => {
          ctx.moveTo(s.x + s.r, s.y);
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        });
        ctx.fill();
      }
      if (starsBin3.length > 0) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.50)'; // Dimmed background stars
        starsBin3.forEach(s => {
          ctx.moveTo(s.x + s.r, s.y);
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        });
        ctx.fill();
      }
      layer2Stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(228, 208, 255, ${s.opacity * 0.45})`; // Dimmed layer 2 stars
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(189, 29, 45, ${s.opacity * 0.08})`; // Dimmed layer 2 star glow
        ctx.fill();
      });

      // 4. Dynamic Constellations Connections & Neural data packet pulses (BATCHED FOR 120HZ FEEL)
      const cStarsIdx = constellationStarsIdxRef.current;
      const linesBin1: number[] = [];
      const linesBin2: number[] = [];
      const linesBin3: number[] = [];
      const packets: number[] = [];

      cStarsIdx.forEach((idx1, i) => {
        const s1 = starsRef.current[idx1];
        if (!s1) return;

        const distortedS1 = getDistortedStarPos(s1.x, s1.y);
        const s1x = distortedS1.x;
        const s1y = distortedS1.y;

        for (let j = i + 1; j < cStarsIdx.length; j++) {
          const s2 = starsRef.current[cStarsIdx[j]];
          if (!s2 || s1.layer !== s2.layer) continue;

          const distortedS2 = getDistortedStarPos(s2.x, s2.y);
          const s2x = distortedS2.x;
          const s2y = distortedS2.y;

          const dx = s1x - s2x;
          const dy = s1y - s2y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 90) {
            const alpha = (1 - dist / 90) * 0.15 * Math.min(s1.opacity, s2.opacity);
            if (alpha >= 0.10) {
              linesBin3.push(s1x, s1y, s2x, s2y);
            } else if (alpha >= 0.05) {
              linesBin2.push(s1x, s1y, s2x, s2y);
            } else if (alpha >= 0.02) {
              linesBin1.push(s1x, s1y, s2x, s2y);
            }

            if ((i + j) % 3 === 0) {
              const tPack = (timestamp * 0.0004 + (i * 0.15)) % 1.0;
              const px = s1x + (s2x - s1x) * tPack;
              const py = s1y + (s2y - s1y) * tPack;
              packets.push(px, py);
            }
          }
        }
      });

      ctx.lineWidth = 0.65;
      if (linesBin1.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(189, 29, 45, 0.04)';
        for (let k = 0; k < linesBin1.length; k += 4) {
          ctx.moveTo(linesBin1[k], linesBin1[k + 1]);
          ctx.lineTo(linesBin1[k + 2], linesBin1[k + 3]);
        }
        ctx.stroke();
      }
      if (linesBin2.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(189, 29, 45, 0.08)';
        for (let k = 0; k < linesBin2.length; k += 4) {
          ctx.moveTo(linesBin2[k], linesBin2[k + 1]);
          ctx.lineTo(linesBin2[k + 2], linesBin2[k + 3]);
        }
        ctx.stroke();
      }
      if (linesBin3.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(189, 29, 45, 0.12)';
        for (let k = 0; k < linesBin3.length; k += 4) {
          ctx.moveTo(linesBin3[k], linesBin3[k + 1]);
          ctx.lineTo(linesBin3[k + 2], linesBin3[k + 3]);
        }
        ctx.stroke();
      }

      if (packets.length > 0) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(224, 204, 255, 0.25)';
        for (let k = 0; k < packets.length; k += 2) {
          const px = packets[k];
          const py = packets[k + 1];
          ctx.moveTo(px + 1.2, py);
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // 4b. Draw and update mouse trail particles
      mouseTrailRef.current = mouseTrailRef.current.filter(mt => {
        mt.x += mt.vx * deltaTime;
        mt.y += mt.vy * deltaTime;
        mt.alpha -= mt.decay * deltaTime;

        if (mt.alpha > 0) {
          ctx.beginPath();
          ctx.arc(mt.x, mt.y, mt.size, 0, Math.PI * 2);
          ctx.fillStyle = mt.color + Math.round(mt.alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
          return true;
        }
        return false;
      });

      // 5. Spotlight Hover Gradient
      if (mouseRef.current.active) {
        const mGrad = ctx.createRadialGradient(
          mouseRef.current.x, mouseRef.current.y, 0,
          mouseRef.current.x, mouseRef.current.y, 110
        );
        mGrad.addColorStop(0, 'rgba(189, 29, 45, 0.05)');
        mGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.015)');
        mGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(mouseRef.current.x, mouseRef.current.y, 110, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3D Core Particles update
      if (coreRef.current) {
        if (core3DParticlesRef.current.length === 0) {
          const p3d = [];
          for (let i = 0; i < 45; i++) {
            const tilt = (Math.random() - 0.5) * Math.PI * 0.35;
            const color = Math.random() > 0.6 ? '#BD1D2D' : Math.random() > 0.3 ? '#BD1D2D' : '#e63946';
            p3d.push({
              angle: Math.random() * Math.PI * 2,
              speed: 0.15 + Math.random() * 0.25,
              radiusX: 52 + Math.random() * 32,
              radiusY: 18 + Math.random() * 12,
              tilt,
              size: 1.0 + Math.random() * 1.6,
              color,
              z: 0
            });
          }
          core3DParticlesRef.current = p3d;
        }

        const speedMultiplier = isCoreHoveredRef.current ? 2.5 : 1.0;
        core3DParticlesRef.current.forEach(p => {
          p.angle += p.speed * speedMultiplier * deltaTime;
          const cosA = Math.cos(p.angle);
          const sinA = Math.sin(p.angle);

          const x3d = cosA * p.radiusX;
          const y3d = sinA * p.radiusY;
          const z3d = sinA * p.radiusX;

          p.z = z3d;

          const cosT = Math.cos(p.tilt);
          const sinT = Math.sin(p.tilt);

          const rx = x3d * cosT - y3d * sinT;
          const ry = x3d * sinT + y3d * cosT;

          (p as any).px = coreX + rx;
          (p as any).py = coreY + ry;
        });

        // Update 3D Accretion Disk particles
        if (accretionDiskRef.current.length > 0) {
          const pitch = 0.45; // X-pitch
          const yaw = 0.22;   // Y-yaw

          const cosP = Math.cos(pitch);
          const sinP = Math.sin(pitch);
          const cosY = Math.cos(yaw);
          const sinY = Math.sin(yaw);

          accretionDiskRef.current.forEach(p => {
            p.angle += p.speed * speedMultiplier * deltaTime;
            const xo = Math.cos(p.angle) * p.orbitRadius;
            const yo = Math.sin(p.angle) * p.orbitRadius;

            // Rotate around X-axis (pitch)
            const x1 = xo;
            const y1 = yo * cosP;
            const z1 = yo * sinP;

            // Rotate around Y-axis (yaw)
            const rx = x1 * cosY + z1 * sinY;
            const ry = y1;
            const rz = -x1 * sinY + z1 * cosY;

            p.px = coreX + rx;
            p.py = coreY + ry;
            p.z = rz;
          });
        }
      }

      // Draw 3D Core Particles (Back depth level)
      core3DParticlesRef.current.forEach(p => {
        if (p.z < 0 && coreRef.current) {
          const depthScale = 0.75 + (p.z + p.radiusX) / (p.radiusX * 2) * 0.25;
          const alpha = 0.15 + (p.z + p.radiusX) / (p.radiusX * 2) * 0.45;
          ctx.beginPath();
          ctx.arc((p as any).px, (p as any).py, p.size * depthScale, 0, Math.PI * 2);
          ctx.fillStyle = (isRetainedGlowRef.current ? '#ef4444' : p.color) + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }
      });

      // Draw Accretion Disk (Back depth level: z < 0)
      if (coreRef.current && accretionDiskRef.current.length > 0) {
        const backGroups: Record<string, { px: number; py: number; size: number }[]> = {};

        accretionDiskRef.current.forEach(p => {
          if (p.z < 0) {
            const maxR = 142;
            const depthScale = 0.7 + (p.z + maxR) / (maxR * 2) * 0.3;
            const alpha = 0.2 + (p.z + maxR) / (maxR * 2) * 0.45;

            const color = isRetainedGlowRef.current ? '#ef4444' : p.color;
            const size = p.size * depthScale;

            let alphaBin = 0.6;
            if (alpha < 0.3) alphaBin = 0.25;
            else if (alpha < 0.45) alphaBin = 0.45;

            const alphaHex = Math.round(alphaBin * 255).toString(16).padStart(2, '0');
            const key = color + alphaHex;

            if (!backGroups[key]) {
              backGroups[key] = [];
            }
            backGroups[key].push({ px: p.px, py: p.py, size });
          }
        });

        Object.entries(backGroups).forEach(([colorWithAlpha, particles]) => {
          ctx.beginPath();
          ctx.fillStyle = colorWithAlpha;
          particles.forEach(p => {
            ctx.moveTo(p.px + p.size, p.py);
            ctx.arc(p.px, p.py, p.size, 0, Math.PI * 2);
          });
          ctx.fill();
        });
      }

      // Draw active lightning bolts triggered on successful distribution
      activeLightningsRef.current = activeLightningsRef.current.filter(lightning => {
        lightning.duration -= deltaTime;
        if (lightning.duration > 0) {
          drawLightning(lightning.x1, lightning.y1, lightning.x2, lightning.y2, lightning.color);
          return true;
        }
        return false;
      });

      // 6. Central AI Reactor Rings HUD
      if (coreRef.current) {
        // Draw Einstein Ring Gravitational Lensing Lens Boundary Halo
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Outer glowing refraction ring
        ctx.beginPath();
        ctx.arc(coreX, coreY, 110, 0, Math.PI * 2);
        ctx.strokeStyle = isRetainedGlowRef.current ? 'rgba(239, 68, 68, 0.09)' : 'rgba(189, 29, 45, 0.09)';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Sharp lensing boundary line
        ctx.beginPath();
        ctx.arc(coreX, coreY, 110, 0, Math.PI * 2);
        ctx.strokeStyle = isRetainedGlowRef.current ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Clockwise rotating dashed inner accent ring at radius 130
        ctx.strokeStyle = isRetainedGlowRef.current ? 'rgba(239, 68, 68, 0.25)' : 'rgba(96, 165, 250, 0.16)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 12]);
        ctx.beginPath();
        const innerRotation = timestamp * 0.00008; // Clockwise
        ctx.arc(coreX, coreY, 130, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Orbiting Satellite Nodes on the dashed ring
        for (let i = 0; i < 4; i++) {
          const nodeAngle = innerRotation + (i * Math.PI / 2);
          const nodeX = coreX + 130 * Math.cos(nodeAngle);
          const nodeY = coreY + 130 * Math.sin(nodeAngle);
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = isRetainedGlowRef.current ? '#ef4444' : '#60a5fa';
          ctx.fill();

          ctx.save();
          ctx.shadowBlur = 6;
          ctx.shadowColor = isRetainedGlowRef.current ? '#ef4444' : '#60a5fa';
          ctx.beginPath();
          ctx.arc(nodeX, nodeY, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();

        // Periodic flare animation for the tick-marked outer ring at radius 150
        const flareDuration = 1800; // 1.8 seconds flare duration
        const flareCycle = 10000;   // 10 seconds total cycle
        const timeInCycle = timestamp % flareCycle;
        let flareAlpha = 0;
        if (timeInCycle < flareDuration) {
          // Smooth sine pulse from 0 -> 1 -> 0
          flareAlpha = Math.sin((timeInCycle / flareDuration) * Math.PI);
        }

        const baseOpacity = isRetainedGlowRef.current ? 0.35 : 0.12;
        const maxFlareOpacity = isRetainedGlowRef.current ? 0.95 : 0.80;
        const currentOpacity = baseOpacity + (maxFlareOpacity - baseOpacity) * flareAlpha;
        const rColor = isRetainedGlowRef.current ? 239 : 139;
        const gColor = isRetainedGlowRef.current ? 68 : 92;
        const bColor = isRetainedGlowRef.current ? 68 : 246;

        // Draw a glowing underlay/shadow during flare
        if (flareAlpha > 0.05) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.shadowBlur = 10 * flareAlpha;
          ctx.shadowColor = isRetainedGlowRef.current ? 'rgba(239, 68, 68, 0.8)' : 'rgba(189, 29, 45, 0.8)';
          ctx.strokeStyle = isRetainedGlowRef.current ? `rgba(239, 68, 68, ${0.15 * flareAlpha})` : `rgba(189, 29, 45, ${0.15 * flareAlpha})`;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(coreX, coreY, 150, 0, Math.PI * 2);
          ctx.stroke();

          // And draw ticks underlay
          const outerRotation = -timestamp * 0.00007;
          for (let angle = 0; angle < 360; angle += 15) {
            const rad = (angle * Math.PI / 180) + outerRotation;
            const innerR = 146;
            const outerR = 154;
            ctx.beginPath();
            ctx.moveTo(coreX + innerR * Math.cos(rad), coreY + innerR * Math.sin(rad));
            ctx.lineTo(coreX + outerR * Math.cos(rad), coreY + outerR * Math.sin(rad));
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.strokeStyle = `rgba(${rColor}, ${gColor}, ${bColor}, ${currentOpacity})`;
        ctx.lineWidth = 0.8 + 0.4 * flareAlpha;
        ctx.beginPath();
        ctx.arc(coreX, coreY, 150, 0, Math.PI * 2);
        ctx.stroke();

        const outerRotation = -timestamp * 0.00007; // Slow counter-clockwise rotation
        for (let angle = 0; angle < 360; angle += 15) {
          const rad = (angle * Math.PI / 180) + outerRotation;
          const innerR = 146;
          const outerR = 154;
          ctx.beginPath();
          ctx.moveTo(coreX + innerR * Math.cos(rad), coreY + innerR * Math.sin(rad));
          ctx.lineTo(coreX + outerR * Math.cos(rad), coreY + outerR * Math.sin(rad));
          ctx.stroke();
        }

        const sweepAngle = (timestamp * 0.00015) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(coreX, coreY);
        ctx.arc(coreX, coreY, 260, sweepAngle - 0.25, sweepAngle);
        ctx.lineTo(coreX, coreY);
        const radarColor = isRetainedGlowRef.current ? '239, 68, 68' : '189, 29, 45';
        const radarColor2 = isRetainedGlowRef.current ? '220, 38, 38' : '189, 29, 45';
        const radarGrad = ctx.createRadialGradient(coreX, coreY, 40, coreX, coreY, 260);
        radarGrad.addColorStop(0, `rgba(${radarColor}, 0.08)`);
        radarGrad.addColorStop(0.6, `rgba(${radarColor2}, 0.02)`);
        radarGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = radarGrad;
        ctx.fill();
      }

      // Draw 3D Core Particles (Front depth level)
      core3DParticlesRef.current.forEach(p => {
        if (p.z >= 0 && coreRef.current) {
          const depthScale = 1.0 + (p.z) / p.radiusX * 0.35;
          const alpha = 0.55 + (p.z) / p.radiusX * 0.45;
          ctx.beginPath();
          ctx.arc((p as any).px, (p as any).py, p.size * depthScale, 0, Math.PI * 2);
          ctx.fillStyle = (isRetainedGlowRef.current ? '#ef4444' : p.color) + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();

          ctx.beginPath();
          ctx.arc((p as any).px, (p as any).py, p.size * depthScale * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = (isRetainedGlowRef.current ? '#ef4444' : p.color) + Math.round(alpha * 0.25 * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }
      });

      // Draw Accretion Disk (Front depth level: z >= 0)
      if (coreRef.current && accretionDiskRef.current.length > 0) {
        const frontGroups: Record<string, { px: number; py: number; size: number }[]> = {};

        accretionDiskRef.current.forEach(p => {
          if (p.z >= 0) {
            const maxR = 142;
            const depthScale = 1.0 + (p.z) / maxR * 0.4;
            const alpha = 0.65 + (p.z) / maxR * 0.35;

            const color = isRetainedGlowRef.current ? '#ef4444' : p.color;
            const size = p.size * depthScale;

            let alphaBin = 0.95;
            if (alpha < 0.78) alphaBin = 0.7;
            else if (alpha < 0.88) alphaBin = 0.85;

            const alphaHex = Math.round(alphaBin * 255).toString(16).padStart(2, '0');
            const key = color + alphaHex;

            if (!frontGroups[key]) {
              frontGroups[key] = [];
            }
            frontGroups[key].push({ px: p.px, py: p.py, size });
          }
        });

        Object.entries(frontGroups).forEach(([colorWithAlpha, particles]) => {
          ctx.beginPath();
          ctx.fillStyle = colorWithAlpha;
          particles.forEach(p => {
            ctx.moveTo(p.px + p.size, p.py);
            ctx.arc(p.px, p.py, p.size, 0, Math.PI * 2);
          });
          ctx.fill();

          // Subtle halo/glow for front particles
          ctx.beginPath();
          const opacityVal = parseInt(colorWithAlpha.substring(7), 16) / 255;
          const haloColor = colorWithAlpha.substring(0, 7) + Math.round(opacityVal * 0.25 * 255).toString(16).padStart(2, '0');
          ctx.fillStyle = haloColor;
          particles.forEach(p => {
            ctx.moveTo(p.px + p.size * 2.2, p.py);
            ctx.arc(p.px, p.py, p.size * 2.2, 0, Math.PI * 2);
          });
          ctx.fill();
        });
      }

      // 6b. Update and draw Laser Railgun beams
      laserBeamsRef.current = laserBeamsRef.current.filter(laser => {
        laser.progress += deltaTime / laser.duration;
        if (laser.progress >= 1.0) return false;

        const nowProgress = laser.progress;

        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = laser.color;

        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);

        const currentTargetX = laser.startX + (laser.targetX - laser.startX) * nowProgress;
        const currentTargetY = laser.startY + (laser.targetY - laser.startY) * nowProgress;

        ctx.lineTo(currentTargetX, currentTargetY);

        ctx.strokeStyle = laser.color + 'bb';
        ctx.lineWidth = laser.width * (1 - nowProgress);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = (laser.width * 0.45) * (1 - nowProgress);
        ctx.stroke();

        ctx.restore();

        // Emit high-speed particles along laser line
        if (Math.random() < 0.8) {
          const dx = laser.targetX - laser.startX;
          const dy = laser.targetY - laser.startY;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const px = laser.startX + dx * nowProgress * Math.random();
            const py = laser.startY + dy * nowProgress * Math.random();
            stardustRef.current.push({
              x: px,
              y: py,
              vx: (dx / len) * (190 + Math.random() * 110) + (Math.random() - 0.5) * 20,
              vy: (dy / len) * (190 + Math.random() * 110) + (Math.random() - 0.5) * 20,
              color: laser.color,
              size: 1.2 + Math.random() * 1.5,
              alpha: 0.95,
              decay: 1.2 + Math.random() * 1.2
            });
          }
        }

        return true;
      });

      // 7. Shooting Stars
      if (Math.random() < 0.0022 && shootingStarsRef.current.length < 2) {
        shootingStarsRef.current.push({
          x: Math.random() * width * 0.7,
          y: 0,
          speedX: 300 + Math.random() * 250,
          speedY: 250 + Math.random() * 200,
          len: 40 + Math.random() * 60,
          opacity: 0.95
        });
      }

      shootingStarsRef.current = shootingStarsRef.current.filter(ss => {
        ss.x += ss.speedX * deltaTime;
        ss.y += ss.speedY * deltaTime;
        ss.opacity -= 0.85 * deltaTime;

        if (ss.opacity > 0 && ss.x < width && ss.y < height) {
          ctx.beginPath();
          const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.speedX * 0.02, ss.y - ss.speedY * 0.02);
          grad.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.0;
          ctx.moveTo(ss.x, ss.y);
          ctx.lineTo(ss.x - ss.speedX * 0.015, ss.y - ss.speedY * 0.015);
          ctx.stroke();
          return true;
        }
        return false;
      });

      // 7b. Update and draw Red Matrix Binary Rain
      matrixRainRef.current = matrixRainRef.current.filter(drop => {
        drop.y += drop.speed * deltaTime;
        drop.opacity -= 0.65 * deltaTime; // decay within 1.5s

        if (drop.opacity > 0 && drop.y < height) {
          ctx.save();
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';

          drop.chars.forEach((char, idx) => {
            const charY = drop.y - idx * 11;
            if (charY > 0) {
              const alpha = drop.opacity * (1 - idx / drop.chars.length);
              // Make the head character glow bright white/pink
              if (idx === 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity})`;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 8;
              } else {
                ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.85})`;
                ctx.shadowBlur = 0;
              }
              ctx.fillText(char, drop.x, charY);
            }
          });
          ctx.restore();
          return true;
        }
        return false;
      });

      // 8. Cyber conduits
      if (coreRef.current) {
        const isErrorState = isRetainedGlowRef.current;
        const speed = isErrorState ? 0.00045 : 0.00022; // speed of packets
        
        ctx.lineWidth = 1.0;
        ctx.setLineDash([5, 12]);
        ctx.lineDashOffset = -timestamp * 0.03;

        // Draw sources to core conduits
        mockSources.forEach((src, idx) => {
          const sCoord = coords.sources[idx];
          if (sCoord) {
            const midX = (sCoord.x + coreX) / 2;
            
            ctx.beginPath();
            ctx.moveTo(sCoord.x, sCoord.y);
            ctx.quadraticCurveTo(midX, sCoord.y, coreX, coreY);
            ctx.strokeStyle = src.color + '22';
            ctx.stroke();

            if (isErrorState) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(sCoord.x, sCoord.y);
              ctx.quadraticCurveTo(midX, sCoord.y, coreX, coreY);
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)';
              ctx.lineWidth = 1.6;
              ctx.stroke();
              ctx.restore();
            }

            // Draw zipping energy packets along the curve
            const offsets = [0, 0.33, 0.66];
            offsets.forEach(offset => {
              const t = (timestamp * speed + offset) % 1.0;
              const pt = getQuadraticBezierPoint(t, sCoord.x, sCoord.y, midX, sCoord.y, coreX, coreY);
              
              ctx.save();
              ctx.beginPath();
              const size = isErrorState ? 0.5 : 0.25;
              ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
              ctx.fillStyle = isErrorState ? '#ef4444' : src.color;
              if (isErrorState) {
                ctx.shadowBlur = 3;
                ctx.shadowColor = '#ef4444';
              } else {
                ctx.shadowBlur = 1;
                ctx.shadowColor = src.color;
              }
              ctx.fill();
              ctx.restore();
            });
          }
        });

        // Core to Sales
        salesList.forEach((sale, idx) => {
          const saleCoord = coords.sales[idx];
          if (saleCoord) {
            const isActive = idx === lastActiveSaleIdxRef.current;
            const midX = (coreX + saleCoord.x) / 2;

            ctx.beginPath();
            ctx.moveTo(coreX, coreY);
            ctx.quadraticCurveTo(midX, saleCoord.y, saleCoord.x, saleCoord.y);

            if (isActive) {
              ctx.strokeStyle = sale.color + '77';
              ctx.lineWidth = 1.8;
              ctx.stroke();

              ctx.setLineDash([4, 8]);
              ctx.lineDashOffset = -timestamp * 0.045;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
              ctx.lineWidth = 1.0;
              ctx.stroke();
              ctx.setLineDash([]);
            } else {
              ctx.strokeStyle = 'rgba(189, 29, 45, 0.10)';
              ctx.lineWidth = 1.0;
              ctx.stroke();
            }

            if (isErrorState) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(coreX, coreY);
              ctx.quadraticCurveTo(midX, saleCoord.y, saleCoord.x, saleCoord.y);
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)';
              ctx.lineWidth = 1.6;
              ctx.stroke();
              ctx.restore();
            }

            // Draw zipping energy packets along the curve
            const offsets = [0, 0.33, 0.66];
            offsets.forEach(offset => {
              const t = (timestamp * speed + offset) % 1.0;
              const pt = getQuadraticBezierPoint(t, coreX, coreY, midX, saleCoord.y, saleCoord.x, saleCoord.y);

              ctx.save();
              ctx.beginPath();
              const size = isErrorState ? 0.5 : 0.25;
              ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
              ctx.fillStyle = isErrorState ? '#ef4444' : sale.color;
              if (isErrorState) {
                ctx.shadowBlur = 3;
                ctx.shadowColor = '#ef4444';
              } else {
                ctx.shadowBlur = 1;
                ctx.shadowColor = sale.color;
              }
              ctx.fill();
              ctx.restore();
            });
          }
        });

        // Draw continuous high-frequency plasma zaps on hover
        if (hoveredSaleIdx !== null && coords.sales[hoveredSaleIdx] && hoveredSaleIdx < salesList.length) {
          const saleCoord = coords.sales[hoveredSaleIdx];
          const targetColor = salesList[hoveredSaleIdx]?.color || '#BD1D2D';
          drawLightning(coreX, coreY, saleCoord.x, saleCoord.y, targetColor);
          drawLightning(coreX, coreY, saleCoord.x, saleCoord.y, '#ffffff');
        }

        if (hoveredSourceIdx !== null && coords.sources[hoveredSourceIdx] && hoveredSourceIdx < mockSources.length) {
          const srcCoord = coords.sources[hoveredSourceIdx];
          const targetColor = mockSources[hoveredSourceIdx]?.color || '#3b82f6';
          drawLightning(srcCoord.x, srcCoord.y, coreX, coreY, targetColor);
          drawLightning(srcCoord.x, srcCoord.y, coreX, coreY, '#ffffff');
        }

        ctx.setLineDash([]);
      }

      // 9. Particles flow and updates
      particlesRef.current = particlesRef.current.filter(p => {
        p.lastX = p.x;
        p.lastY = p.y;

        // Initialize and update trail for Comet Tail / Plasma Vortex effect
        if (!p.trail) p.trail = [];
        p.trail.unshift({ x: p.x, y: p.y, alpha: 1.0 });
        p.trail = p.trail.map(tp => ({
          ...tp,
          alpha: tp.alpha - (p.stage === 1 ? 0.05 : 0.08)
        })).filter(tp => tp.alpha > 0);

        const maxTrailLen = p.stage === 1 ? 25 : 12;
        if (p.trail.length > maxTrailLen) {
          p.trail = p.trail.slice(0, maxTrailLen);
        }

        if (p.stage === 0) {
          p.progress += deltaTime / p.duration;
          const t = p.progress;
          const midX = (p.startX + coreX) / 2;

          const x = (1 - t) * (1 - t) * p.startX + 2 * (1 - t) * t * midX + t * t * coreX;
          const wave = 18 * Math.sin(t * Math.PI * 3.5) * (1 - t);
          const y = (1 - t) * (1 - t) * p.startY + 2 * (1 - t) * t * p.startY + t * t * coreY + wave;

          p.x = x;
          p.y = y;

          // Emit stardust trail
          if (Math.random() < 0.45) {
            const dx = p.x - p.lastX;
            const dy = p.y - p.lastY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const dirX = len > 0 ? dx / len : 0;
            const dirY = len > 0 ? dy / len : 0;
            stardustRef.current.push({
              x: p.x,
              y: p.y,
              vx: -dirX * (15 + Math.random() * 20) + (Math.random() - 0.5) * 8,
              vy: -dirY * (15 + Math.random() * 20) + (Math.random() - 0.5) * 8,
              color: p.color,
              size: 1.0 + Math.random() * 1.5,
              alpha: 0.85,
              decay: 0.9 + Math.random() * 0.9
            });
          }

          if (p.progress >= 1.0) {
            p.progress = 0;
            p.stage = 1;
            p.x = coreX;
            p.y = coreY;
            if (p.status === 'rejected' || p.status === 'duplicate') {
              p.color = '#ef4444';
            }

            coreGlowIntensityRef.current = 2.0;
            coreShockwavesRef.current.push({
              radius: 10,
              maxRadius: 130,
              opacity: 1.0,
              color: p.color,
              style: 'dashed'
            });
          }
        } else if (p.stage === 1) {
          p.holdTime -= deltaTime;

          const tHold = 1 - Math.max(0, p.holdTime / p.maxHoldTime);
          if (p.status === 'assigned' || p.status === 'compensation' || p.status === 'pending_work_hours' || p.status === 'reminder') {
            const compression = 0.18 * Math.pow(tHold, 2.5);
            if (compression > maxCompression) {
              maxCompression = compression;
            }
          }

          const spiralAngle = tHold * Math.PI * 6.5;
          const spiralRadius = 38 * Math.cos(tHold * Math.PI / 2) + 2;

          p.x = coreX + spiralRadius * Math.cos(spiralAngle);
          p.y = coreY + spiralRadius * Math.sin(spiralAngle);

          if (Math.random() < 0.45) {
            const speed = 25 + Math.random() * 30;
            const angle = spiralAngle + Math.PI / 2;
            const vx = Math.cos(angle) * speed - Math.cos(spiralAngle) * 15;
            const vy = Math.sin(angle) * speed - Math.sin(spiralAngle) * 15;
            stardustRef.current.push({
              x: p.x,
              y: p.y,
              vx,
              vy,
              color: p.color,
              size: 0.8 + Math.random() * 1.4,
              alpha: 0.85,
              decay: 0.9 + Math.random() * 0.7
            });
          }

          if (Math.random() < 0.75) {
            drawLightning(coreX, coreY, p.x, p.y, p.color);
          }

          const scanPercent = Math.min(100, Math.round((1 - p.holdTime / p.maxHoldTime) * 100));
          const boxSize = 21;
          ctx.strokeStyle = p.color + 'aa';
          ctx.lineWidth = 1.2;

          ctx.beginPath();
          ctx.moveTo(p.x - boxSize, p.y - boxSize + 6);
          ctx.lineTo(p.x - boxSize, p.y - boxSize);
          ctx.lineTo(p.x - boxSize + 6, p.y - boxSize);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p.x + boxSize, p.y - boxSize + 6);
          ctx.lineTo(p.x + boxSize, p.y - boxSize);
          ctx.lineTo(p.x + boxSize - 6, p.y - boxSize);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p.x - boxSize, p.y + boxSize - 6);
          ctx.lineTo(p.x - boxSize, p.y + boxSize);
          ctx.lineTo(p.x - boxSize + 6, p.y + boxSize);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p.x + boxSize, p.y + boxSize - 6);
          ctx.lineTo(p.x + boxSize, p.y + boxSize);
          ctx.lineTo(p.x + boxSize - 6, p.y + boxSize);
          ctx.stroke();

          ctx.fillStyle = p.color;
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          let tag = `AI_VETTING: ${scanPercent}%`;
          if (p.status === 'duplicate') tag = `DUP_CHECK: ${scanPercent}%`;
          else if (p.status === 'rejected') tag = `ERR_CHECK: ${scanPercent}%`;
          ctx.fillText(tag, p.x, p.y - boxSize - 6);

          if (p.holdTime <= 0) {
            if (p.status === 'rejected' || p.status === 'duplicate') {
              triggerRetainedRipple(p.id, p.status);

              coreGlowIntensityRef.current = 2.0;
              coreShockwavesRef.current.push({
                radius: 12,
                maxRadius: 110,
                opacity: 0.95,
                color: '#ef4444',
                style: 'dashed'
              });

              for (let i = 0; i < 12; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 30 + Math.random() * 40;
                stardustRef.current.push({
                  x: coreX,
                  y: coreY,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  color: '#ef4444',
                  size: 1.0 + Math.random() * 1.5,
                  alpha: 1.0,
                  decay: 1.2 + Math.random() * 0.8
                });
              }

              return false;
            }

            p.stage = 2;
            p.progress = 0;
            p.startX = coreX;
            p.startY = coreY;
            if (p.status === 'assigned') {
              p.color = '#BD1D2D'; // Purple for APPROVED
            }

            gridRipplesRef.current.push({
              x: coreX,
              y: coreY,
              radius: 0,
              maxRadius: 650,
              strength: 1.6,
              speed: 750
            });

            activeLightningsRef.current.push({
              x1: coreX,
              y1: coreY,
              x2: p.targetX,
              y2: p.targetY,
              color: p.color,
              duration: 0.22
            });

            pushShakeIntensityRef.current = 16.0;
            coreBlastIntensityRef.current = 1.0;

            laserBeamsRef.current.push({
              startX: coreX,
              startY: coreY,
              targetX: p.targetX,
              targetY: p.targetY,
              progress: 0,
              duration: isPlaying ? 0.45 : 0.65,
              color: p.color,
              width: 4.5
            });

            coreGlowIntensityRef.current = 1.6;
            coreShockwavesRef.current.push({
              radius: 12,
              maxRadius: 100,
              opacity: 0.95,
              color: p.color,
              style: 'sparks'
            });

            const dxTarget = p.targetX - coreX;
            const dyTarget = p.targetY - coreY;
            const distTarget = Math.sqrt(dxTarget * dxTarget + dyTarget * dyTarget);
            if (distTarget > 0) {
              const dirX = dxTarget / distTarget;
              const dirY = dyTarget / distTarget;
              const sparkCount = 16 + Math.floor(Math.random() * 6); // 16 to 21 sparkles

              for (let i = 0; i < sparkCount; i++) {
                // Cone angle centered around the vector towards the target sale
                const spreadAngle = (Math.random() - 0.5) * 0.40;
                const cosSpread = Math.cos(spreadAngle);
                const sinSpread = Math.sin(spreadAngle);

                const initialSpeed = 240 + Math.random() * 260; // shoot out very fast
                const sparkVx = (dirX * cosSpread - dirY * sinSpread) * initialSpeed;
                const sparkVy = (dirX * sinSpread + dirY * cosSpread) * initialSpeed;

                stardustRef.current.push({
                  x: coreX,
                  y: coreY,
                  vx: sparkVx,
                  vy: sparkVy,
                  color: p.color,
                  size: 1.0 + Math.random() * 2.0,
                  alpha: 1.0,
                  decay: 0.65 + Math.random() * 0.55, // decays a bit slower to show braking
                  friction: 0.915 // dynamic braking factor
                });
              }
            }
          }
        } else if (p.stage === 2) {
          p.progress += deltaTime / p.duration2;
          const t = p.progress;
          const midX = (coreX + p.targetX) / 2;

          const x = (1 - t) * (1 - t) * coreX + 2 * (1 - t) * t * midX + t * t * p.targetX;
          const wave = 18 * Math.sin(t * Math.PI * 3.5) * t;
          const y = (1 - t) * (1 - t) * coreY + 2 * (1 - t) * t * p.targetY + t * t * p.targetY + wave;

          p.x = x;
          p.y = y;

          if (Math.random() < 0.45) {
            const dx = p.x - p.lastX;
            const dy = p.y - p.lastY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const dirX = len > 0 ? dx / len : 0;
            const dirY = len > 0 ? dy / len : 0;
            stardustRef.current.push({
              x: p.x,
              y: p.y,
              vx: -dirX * (15 + Math.random() * 20) + (Math.random() - 0.5) * 8,
              vy: -dirY * (15 + Math.random() * 20) + (Math.random() - 0.5) * 8,
              color: p.color,
              size: 1.0 + Math.random() * 1.5,
              alpha: 0.85,
              decay: 0.9 + Math.random() * 0.9
            });
          }

          // Trigger collision and shatter into stardust exactly 18px before reaching the target card
          // (which corresponds to ~10px outside the card boundary, before touching it)
          const distToTarget = p.targetX - p.x;
          if (distToTarget < 18) {
            triggerSaleRipple(p.saleIndex, p.sourceType, p.color, p.id, p.status as any);

            // Spawn 15 tiny stardust particles splashing outwards on collision with sales card
            for (let i = 0; i < 15; i++) {
              // Splash back to the left (cone of 120 to 240 degrees)
              const angle = Math.PI + (Math.random() - 0.5) * 1.6;
              const speed = 110 + Math.random() * 140; // High speed splash
              stardustRef.current.push({
                x: p.x, // Spawn exactly at the shatter point (outside the card)
                y: p.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: p.color,
                size: 1.4 + Math.random() * 1.8, // Slightly larger particles for visibility
                alpha: 1.0,
                decay: 5.2 + Math.random() * 4.8 // Fast fade out (0.1s - 0.2s) for crispness
              });
            }
            return false;
          }
        }

        let opacity = 1.0;
        if (p.stage === 1) {
          const fadeThreshold = Math.min(1.3, p.maxHoldTime * 0.4);
          const elapsed = p.maxHoldTime - p.holdTime;
          if (elapsed < fadeThreshold) {
            opacity = Math.max(0, 1 - (elapsed / fadeThreshold));
          } else if (p.holdTime < fadeThreshold) {
            opacity = Math.max(0, 1 - (p.holdTime / fadeThreshold));
          } else {
            opacity = 0.0;
          }
        }

        if (opacity > 0) {
          const isMobileView = width < 1180;
          const bubbleRadius = isMobileView ? 9 : 14;
          const initialsFont = isMobileView ? 'bold 7px monospace' : 'bold 9px monospace';
          const nameFont = isMobileView ? 'bold 7px monospace' : 'bold 9px monospace';
          const subtextFont = isMobileView ? '6px monospace' : '7px monospace';
          const offsetTextX = isMobileView ? 13 : 19;

          // Render Comet Tail / Plasma Vortex Trails
          const trail = p.trail;
          if (trail && trail.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            if (p.stage === 1) {
              // 1. Plasma Vortex Trail (Vetting stage)
              // Draw multiple layers of lines for a glowing hot neon vortex path
              ctx.beginPath();
              ctx.moveTo(trail[0].x, trail[0].y);
              for (let i = 1; i < trail.length; i++) {
                ctx.lineTo(trail[i].x, trail[i].y);
              }

              // Outer glow layer
              ctx.strokeStyle = p.color;
              ctx.lineWidth = 6;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.globalAlpha = opacity * 0.18;
              ctx.stroke();

              // Inner glow layer
              ctx.lineWidth = 3;
              ctx.globalAlpha = opacity * 0.45;
              ctx.stroke();

              // Central white core line
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.0;
              ctx.globalAlpha = opacity * 0.8;
              ctx.stroke();

              ctx.globalAlpha = 1.0; // reset

              // Draw glowing plasma blobs along the vortex path
              trail.forEach((pt, index) => {
                const trailOpacity = pt.alpha * opacity;
                if (trailOpacity <= 0) return;

                const ratio = 1 - (index / trail.length);
                const size = (3.5 + Math.sin(timestamp * 0.01 + index) * 1.5) * ratio;

                // Wobbling effect for plasma look
                const offsetAmp = 2.5 * (1 - ratio);
                const offsetX = Math.sin(timestamp * 0.02 + index) * offsetAmp;
                const offsetY = Math.cos(timestamp * 0.02 + index) * offsetAmp;

                ctx.beginPath();
                ctx.arc(pt.x + offsetX, pt.y + offsetY, size, 0, Math.PI * 2);

                const grad = ctx.createRadialGradient(
                  pt.x + offsetX, pt.y + offsetY, 0,
                  pt.x + offsetX, pt.y + offsetY, size
                );
                grad.addColorStop(0, `rgba(255, 255, 255, ${trailOpacity})`);
                grad.addColorStop(0.3, p.color + Math.round(trailOpacity * 0.7 * 255).toString(16).padStart(2, '0'));
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = grad;
                ctx.fill();
              });
            } else {
              // 2. Comet Tail (Transport stages 0 and 2)
              // Draw tapered line using segments
              for (let i = 0; i < trail.length - 1; i++) {
                const pt1 = trail[i];
                const pt2 = trail[i + 1];
                const ratio1 = 1 - (i / trail.length);

                const segmentOpacity = pt1.alpha * opacity * ratio1;
                if (segmentOpacity <= 0) continue;

                ctx.beginPath();
                ctx.moveTo(pt1.x, pt1.y);
                ctx.lineTo(pt2.x, pt2.y);
                ctx.lineWidth = 3.0 * ratio1;
                ctx.strokeStyle = p.color + Math.round(segmentOpacity * 0.65 * 255).toString(16).padStart(2, '0');
                ctx.lineCap = 'round';
                ctx.stroke();
              }

              // Draw tiny trailing dust sparks
              trail.forEach((pt, index) => {
                const trailOpacity = pt.alpha * opacity;
                if (trailOpacity <= 0) return;

                const ratio = 1 - (index / trail.length);
                if (index % 2 === 0) {
                  const size = (1.2 + Math.random() * 0.8) * ratio;
                  const spreadX = (Math.random() - 0.5) * 3 * (1 - ratio);
                  const spreadY = (Math.random() - 0.5) * 3 * (1 - ratio);

                  ctx.beginPath();
                  ctx.arc(pt.x + spreadX, pt.y + spreadY, size, 0, Math.PI * 2);
                  ctx.fillStyle = p.color + Math.round(trailOpacity * 0.85 * 255).toString(16).padStart(2, '0');
                  ctx.fill();
                }
              });
            }
            ctx.restore();
          }

          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, bubbleRadius, 0, Math.PI * 2);
          if (p.stage === 2 && p.status === 'assigned') {
            ctx.shadowColor = '#BD1D2D';
            ctx.shadowBlur = 12 * opacity;
            ctx.fillStyle = `rgba(189, 29, 45, ${0.95 * opacity})`;
            ctx.strokeStyle = `rgba(189, 29, 45, ${opacity})`;
          } else {
            ctx.fillStyle = `rgba(4, 6, 16, ${0.96 * opacity})`;
            ctx.strokeStyle = p.color + Math.round(opacity * 255).toString(16).padStart(2, '0');
          }
          ctx.lineWidth = 2.0;
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.font = initialsFont;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(getInitials(p.leadName), p.x, p.y);

          ctx.textAlign = 'left';
          ctx.font = nameFont;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.88 * opacity})`;
          ctx.fillText(p.leadName, p.x + offsetTextX, p.y + (isMobileView ? 1 : 2));

          ctx.fillStyle = p.color + Math.round(0.8 * opacity * 255).toString(16).padStart(2, '0');
          ctx.font = subtextFont;
          ctx.fillText(
            p.stage < 2
              ? 'RECEIVED'
              : p.status === 'assigned'
                ? 'APPROVED'
                : p.status === 'compensation'
                  ? 'COMPENSATE'
                  : p.status === 'pending_work_hours'
                    ? 'HOLD'
                    : p.status === 'reminder'
                      ? 'REMINDER'
                      : p.status === 'duplicate'
                        ? 'DUPLICATED'
                        : 'REJECTED',
            p.x + offsetTextX,
            p.y + (isMobileView ? 8 : 11)
          );
        }

        return true;
      });

      // 10. Update and draw stardust sparkles (BATCHED FOR 120HZ FEEL)
      const stardustGroups: Record<string, { x: number; y: number; size: number }[]> = {};

      stardustRef.current = stardustRef.current.filter(s => {
        if (s.friction) {
          s.vx *= Math.pow(s.friction, deltaTime * 60);
          s.vy *= Math.pow(s.friction, deltaTime * 60);
        }
        s.x += s.vx * deltaTime;
        s.y += s.vy * deltaTime;
        s.alpha -= s.decay * deltaTime;

        if (s.alpha > 0) {
          const distorted = getDistortedStarPos(s.x, s.y);
          const displayX = distorted.x;
          const displayY = distorted.y;

          let alphaBin = 0.95;
          if (s.alpha < 0.3) alphaBin = 0.2;
          else if (s.alpha < 0.6) alphaBin = 0.5;
          else if (s.alpha < 0.85) alphaBin = 0.75;

          const alphaHex = Math.round(alphaBin * 255).toString(16).padStart(2, '0');
          const key = s.color + alphaHex;

          if (!stardustGroups[key]) {
            stardustGroups[key] = [];
          }
          stardustGroups[key].push({ x: displayX, y: displayY, size: s.size });
          return true;
        }
        return false;
      });

      Object.entries(stardustGroups).forEach(([colorWithAlpha, particles]) => {
        ctx.beginPath();
        ctx.fillStyle = colorWithAlpha;
        particles.forEach(p => {
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        });
        ctx.fill();
      });

      // 11. Update and draw core shockwaves
      coreShockwavesRef.current = coreShockwavesRef.current.filter(sw => {
        sw.radius += 140 * deltaTime;
        sw.opacity = 1 - (sw.radius / sw.maxRadius);

        if (sw.radius < sw.maxRadius && sw.opacity > 0) {
          if (sw.style === 'solid') {
            ctx.beginPath();
            ctx.arc(coreX, coreY, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = sw.color + Math.round(sw.opacity * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 1.0;
            ctx.stroke();
          } else if (sw.style === 'dashed') {
            ctx.beginPath();
            ctx.arc(coreX, coreY, sw.radius, 0, Math.PI * 2);
            ctx.setLineDash([6, 12]);
            ctx.strokeStyle = sw.color + Math.round(sw.opacity * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (sw.style === 'sparks') {
            const count = 16;
            ctx.fillStyle = sw.color + Math.round(sw.opacity * 255).toString(16).padStart(2, '0');
            for (let i = 0; i < count; i++) {
              const rad = (i * Math.PI * 2) / count + (timestamp * 0.001);
              const sx = coreX + sw.radius * Math.cos(rad);
              const sy = coreY + sw.radius * Math.sin(rad);
              ctx.beginPath();
              ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          return true;
        }
        return false;
      });

      // 12. Floating Telemetry HUD text
      if (coreRef.current) {
        const breath = Math.sin(timestamp * 0.0035) * 5;
        ctx.save();
        ctx.textAlign = 'center';

        if (isTelemetryGlitch) {
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#f87171'; // Red highlight during glitch
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;

          const offsetX1 = (Math.random() - 0.5) * 5;
          const offsetY1 = (Math.random() - 0.5) * 5;
          const offsetX2 = (Math.random() - 0.5) * 5;
          const offsetY2 = (Math.random() - 0.5) * 5;

          ctx.fillText(`FAIR_SHARE: ${fairShareEquity}`, coreX - 148 + offsetX1, coreY - 115 + breath + offsetY1);
          ctx.fillText(`SHEETS_SYNC: ${sheetsStatus}`, coreX + 148 + offsetX2, coreY + 125 - breath + offsetY2);
        } else {
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = 'rgba(189, 29, 45, 0.4)';
          ctx.fillText(`FAIR_SHARE: ${fairShareEquity}`, coreX - 148, coreY - 115 + breath);
          ctx.fillText(`SHEETS_SYNC: ${sheetsStatus}`, coreX + 148, coreY + 125 - breath);
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(163, 20, 34, 0.09)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(coreX - 132, coreY); ctx.lineTo(coreX - 118, coreY);
        ctx.moveTo(coreX + 118, coreY); ctx.lineTo(coreX + 132, coreY);
        ctx.moveTo(coreX, coreY - 132); ctx.lineTo(coreX, coreY - 118);
        ctx.moveTo(coreX, coreY + 118); ctx.lineTo(coreX, coreY + 132);
        ctx.stroke();
      }


      // Restore canvas state after glitch translation
      ctx.restore();

      // Pulse Core sphere directly to bypass React virtual DOM reconciler lag
      if (coreSphereRef.current) {
        coreGlowIntensityRef.current = Math.max(0, coreGlowIntensityRef.current - 2.5 * deltaTime);
        coreBlastIntensityRef.current = Math.max(0, coreBlastIntensityRef.current - 3.5 * deltaTime);
        const intensity = coreGlowIntensityRef.current;
        const blast = coreBlastIntensityRef.current;
        const baseScale = 1.0 + 0.03 * Math.sin(timestamp / 240);
        
        const isCoreHovered = isCoreHoveredRef.current;
        const hoverScale = isCoreHovered ? (0.04 + 0.02 * Math.sin(timestamp * 0.015)) : 0;
        const scale = baseScale - maxCompression + blast * 0.12 + intensity * 0.05 + hoverScale;
        
        const hoverShadow = isCoreHovered ? (15 + 10 * Math.sin(timestamp * 0.015)) : 0;
        const shadowSpread = 35 + intensity * 48 + blast * 20 + hoverShadow;
        const opacity = 0.8 + intensity * 0.2 + blast * 0.15;
        
        const shakeX = isCoreHovered ? (Math.random() - 0.5) * 0.5 : 0;
        const shakeY = isCoreHovered ? (Math.random() - 0.5) * 0.5 : 0;

        coreSphereRef.current.style.transform = `scale(${scale}) translate(${shakeX}px, ${shakeY}px)`;
        
        if (isCoreHovered) {
          coreSphereRef.current.style.background = 'linear-gradient(135deg, rgba(189, 29, 45, 0.95) 0%, rgba(163, 20, 34, 0.95) 100%)';
          coreSphereRef.current.style.boxShadow = `0 0 ${shadowSpread}px rgba(189, 29, 45, 0.85), inset 0 0 20px rgba(255, 255, 255, 0.6)`;
        } else if (isRetainedGlowRef.current) {
          coreSphereRef.current.style.boxShadow = `0 0 ${shadowSpread}px rgba(239, 68, 68, ${0.5 + intensity * 0.5}), inset 0 0 20px rgba(255, 255, 255, 0.55)`;
          coreSphereRef.current.style.background = `linear-gradient(135deg, rgba(239, 68, 68, ${opacity}) 0%, rgba(185, 28, 28, ${opacity}) 100%)`;
        } else {
          coreSphereRef.current.style.boxShadow = `0 0 ${shadowSpread}px rgba(189, 29, 45, ${0.5 + intensity * 0.5 + blast * 0.3}), inset 0 0 20px rgba(255, 255, 255, 0.45)`;
          coreSphereRef.current.style.background = `linear-gradient(135deg, rgba(189, 29, 45, ${opacity}) 0%, rgba(163, 20, 34, ${opacity}) 100%)`;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [isPlaying, bootPhase, mockSources, salesList, coordsRef, coreRef, coreSphereRef, sourceRefs, saleRefs, particlesRef, triggerSaleRipple, triggerRetainedRipple, isCoreHoveredRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto', // Enable pointer events for background click ripples
        zIndex: 1
      }}
    />
  );
});
SpaceCanvasBackground.displayName = 'SpaceCanvasBackground';

const getFormattedDateRange = (rangeName: string, t: (key: string) => string) => {
  const today = new Date();
  const formatDate = (d: Date) => {
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  if (rangeName === 'Hôm nay') {
    return t('Hôm nay');
  }
  if (rangeName === 'Hôm qua') {
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    return t('Hôm qua');
  }
  if (rangeName === '7 ngày qua') {
    const start = new Date();
    start.setDate(today.getDate() - 7);
    return `${formatDate(start)} - ${formatDate(today)}`;
  }
  if (rangeName === '30 ngày qua') {
    const start = new Date();
    start.setDate(today.getDate() - 30);
    return `${formatDate(start)} - ${formatDate(today)}`;
  }
  if (rangeName === 'Tháng này') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return `${formatDate(start)} - ${formatDate(today)}`;
  }
  if (rangeName === 'Tháng trước') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  // Parse custom range: YYYY-MM-DD đến YYYY-MM-DD
  const match = rangeName.match(/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
  if (match) {
    const parseAndFormat = (dateStr: string) => {
      const d = new Date(dateStr);
      return formatDate(d);
    };
    if (match[1] === match[2]) {
      return parseAndFormat(match[1]);
    }
    return `${parseAndFormat(match[1])} - ${parseAndFormat(match[2])}`;
  }

  // If it's a single date (YYYY-MM-DD)
  const singleMatch = rangeName.match(/^\d{4}-\d{2}-\d{2}$/);
  if (singleMatch) {
    const d = new Date(rangeName);
    return formatDate(d);
  }

  return t(rangeName);
};

const isSingleDay = (dateStr: string) => {
  if (dateStr === 'Hôm nay' || dateStr === 'Hôm qua') {
    return true;
  }
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
  if (match) {
    return match[1] === match[2];
  }
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return true;
  }
  return false;
};

const isCurrentlyWorking = (consultant: any) => {
  // If they are on leave/vacation/inactive, they are not working
  if (
    consultant.vacation_mode === 1 ||
    Number(consultant.vacation_mode) === 1 ||
    consultant.status === 'leave' ||
    consultant.status === 'inactive' ||
    consultant.statusMsg === 'Vắng mặt' ||
    consultant.statusMsg === 'Inactive'
  ) {
    return false;
  }

  const now = new Date();
  const day = now.getDay(); // 0: Sunday, 1: Monday, ... 6: Saturday
  const key = day === 0 ? '7' : String(day);

  let startStr = consultant.work_start_time || '08:00';
  let endStr = consultant.work_end_time || '22:00';
  let active = true;

  if (consultant.work_schedule && consultant.work_schedule[key]) {
    const sched = consultant.work_schedule[key];
    active = sched.active;
    if (sched.start) startStr = sched.start;
    if (sched.end) endStr = sched.end;
  }

  if (!active) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTimeToMinutes = (tStr: string) => {
    const parts = String(tStr).split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    return h * 60 + m;
  };

  const startMinutes = parseTimeToMinutes(startStr);
  const endMinutes = parseTimeToMinutes(endStr);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight shift
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
};

// ============================================================================
// MAIN FLIGHT DECK COMPONENT
// ============================================================================
export const WarRoomFlightDeck: React.FC<WarRoomProps> = ({
  isOpen,
  onClose,
  stats,
  recentLogs
}) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Core & node DOM refs
  const coreRef = useRef<HTMLDivElement | null>(null);
  const coreSphereRef = useRef<HTMLDivElement | null>(null);
  const sourceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const saleRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const isCoreHoveredRef = useRef(false);

  // Coordinate Ref shared with Canvas child
  const coordsRef = useRef<{
    sources: { x: number; y: number }[];
    core: { x: number; y: number };
    sales: { x: number; y: number }[];
  }>({ sources: [], core: { x: 0, y: 0 }, sales: [] });

  // High performance particles ref
  const particlesRef = useRef<Particle[]>([]);

  // React HUD states (only trigger visual overlays occasionally)
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [hoveredSummary, setHoveredSummary] = useState<{ type: 'source' | 'sale'; data: any; x: number; y: number } | null>(null);
  const [activeSalesGlow, setActiveSalesGlow] = useState<Record<number, boolean>>({});
  const [lastActiveSaleIdx, setLastActiveSaleIdx] = useState<number | null>(null);
  const [activeSourcesGlow, setActiveSourcesGlow] = useState<Record<number, boolean>>({});
  const [sourceGlowKeys, setSourceGlowKeys] = useState<Record<number, number>>({});
  const [isTelemetryGlitch, setIsTelemetryGlitch] = useState(false);
  const [lastActiveSourceIdx, setLastActiveSourceIdx] = useState<number | null>(null);
  const [localRecentFeed, setLocalRecentFeed] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [hoveredSourceIdx, setHoveredSourceIdx] = useState<number | null>(null);
  const [hoveredSaleIdx, setHoveredSaleIdx] = useState<number | null>(null);

  const handleConnectionSyncEvent = (connName: string, lastSync: string, status: 'success' | 'error' = 'success', errorMsg?: string) => {
    const syncTime = new Date(lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (status === 'error' && errorMsg) {
      console.error(`Sync error on ${connName}: ${errorMsg}`);
    }

    toast.custom((t) => (
      <div
        style={{
          background: 'rgba(8, 12, 28, 0.95)',
          backdropFilter: 'blur(15px)',
          border: `1px solid ${status === 'error' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(189, 29, 45, 0.18)'}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
          borderRadius: '30px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          minWidth: '220px',
          maxWidth: '280px',
          animation: t.visible 
            ? 'slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' 
            : 'slideOutLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          zIndex: 999999,
          pointerEvents: 'none'
        }}
      >
        <span style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: status === 'error' ? '#ef4444' : '#10b981', 
          boxShadow: `0 0 4px ${status === 'error' ? '#ef4444' : '#10b981'}`,
          display: 'inline-block',
          flexShrink: 0
        }} />
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong style={{ color: status === 'error' ? '#ef4444' : '#e63946', fontSize: '0.65rem', marginRight: 4 }}>
            {status === 'error' ? 'ERR:' : 'SYNC:'}
          </strong>
          {connName}
        </div>
        <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
          {syncTime}
        </span>
      </div>
    ), { duration: 5000, id: `sync-${connName}-${Date.now()}` });
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchAPI('get_connections')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setConnections(res.data);
        }
      })
      .catch(err => console.error('Lỗi fetch connections on load:', err));
  }, [isOpen]);

  const [todayStats, setTodayStats] = useState<any>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [allConsultants, setAllConsultants] = useState<any[]>([]);
  const [summaryDate, setSummaryDate] = useState('7 ngày qua');
  const [yesterdayLogs, setYesterdayLogs] = useState<any[]>([]);

  const currentActiveLogs = useMemo(() => {
    if (isPlaying) {
      return yesterdayLogs;
    }
    return summaryDate === 'Hôm nay' ? todayLogs : yesterdayLogs;
  }, [isPlaying, todayLogs, yesterdayLogs, summaryDate]);

  const [isMobile, setIsMobile] = useState(false);
  const prevThemeRef = useRef<'light' | 'dark' | null>(null);

  // Sync theme when War Room is open
  useEffect(() => {
    if (isOpen) {
      // Clear any pending theme reversion timeouts
      if ((window as any).__themeTimeout__) {
        clearTimeout((window as any).__themeTimeout__);
        (window as any).__themeTimeout__ = null;
      }

      const currentTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      prevThemeRef.current = currentTheme;
      if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('richland_theme', 'dark');
        window.dispatchEvent(new Event('theme-change'));
      }
    }

    return () => {
      // Clear existing just in case
      if ((window as any).__themeTimeout__) {
        clearTimeout((window as any).__themeTimeout__);
      }

      (window as any).__themeTimeout__ = setTimeout(() => {
        const nextTheme = 'light';
        const triggerThemeChange = () => {
          document.documentElement.setAttribute('data-theme', nextTheme);
          localStorage.setItem('richland_theme', nextTheme);
          window.dispatchEvent(new Event('theme-change'));
        };

        // Check if View Transition is supported and user does not prefer reduced motion
        if (!(document as any).startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          triggerThemeChange();
          prevThemeRef.current = null;
          (window as any).__themeTimeout__ = null;
          return;
        }

        // Use center of viewport as origin for circle transition
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        const endRadius = Math.hypot(x, y);

        const transition = (document as any).startViewTransition(() => {
          triggerThemeChange();
        });

        transition.ready.then(() => {
          const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ];
          document.documentElement.animate(
            {
              clipPath: clipPath,
            },
            {
              duration: 600,
              easing: 'ease-in-out',
              pseudoElement: '::view-transition-new(root)',
            }
          );
        });

        prevThemeRef.current = null;
        (window as any).__themeTimeout__ = null;
      }, 200); // 200ms delay before returning to light theme
    };
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1180);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Reset simulation when summaryDate or yesterdayLogs changes
  useEffect(() => {
    setSimElapsedTime(0);
    setSimCurrentIndex(0);
    setSimTotalCount(0);
    setSimSharedCount(0);
    setSimErrorCount(0);
    setSimulatedLeadsPerSale({});
    setSimulatedLeadsPerSource({});
    setLocalRecentFeed([]);
    particlesRef.current = [];
  }, [summaryDate, yesterdayLogs]);

  // Clear particles and reset all simulation stats when toggling play/pause mode
  useEffect(() => {
    particlesRef.current = [];
    setSimElapsedTime(0);
    setSimCurrentIndex(0);
    setSimTotalCount(0);
    setSimSharedCount(0);
    setSimErrorCount(0);
    setSimulatedLeadsPerSale({});
    setSimulatedLeadsPerSource({});
  }, [isPlaying]);

  // Polling today's stats and logs periodically in Real-time mode
  useEffect(() => {
    if (!isOpen || isPlaying) return;

    const pollData = () => {
      Promise.all([
        fetchAPI('get_dashboard_stats&date=Hôm nay'),
        fetchAPI('get_logs&date=Hôm nay&exclude_status=silent&page=1&pageSize=100'),
        fetchAPI('get_connections')
      ])
        .then(([statsRes, logsRes, connsRes]) => {
          if (statsRes.success && statsRes.data) {
            setTodayStats(statsRes.data);
          }
          if (logsRes.success && Array.isArray(logsRes.data)) {
            const filtered = logsRes.data.filter((log: any) => log.status !== 'silent');
            setTodayLogs(filtered);
          }
          if (connsRes.success && Array.isArray(connsRes.data)) {
            setConnections(prev => {
              if (prev && prev.length > 0) {
                let delayOffset = 0;
                connsRes.data.forEach((conn: any) => {
                  // Only trace sheet connections
                  if (conn.connection_type !== 'sheets') return;

                  const matched = prev.find((p: any) => String(p.id) === String(conn.id));
                  if (matched && matched.last_sync_at !== conn.last_sync_at && conn.last_sync_at) {
                    setTimeout(() => {
                      handleConnectionSyncEvent(conn.sheet_name, conn.last_sync_at, conn.sync_status || 'success', conn.last_error);
                    }, delayOffset);
                    delayOffset += 1800; // Stagger subsequent toasts by 1800ms
                  }
                });
              }
              return connsRes.data;
            });
          }
        })
        .catch(err => console.error('Lỗi poll realtime stats/logs/connections:', err));
    };

    // Poll immediately on transition to real-time mode
    pollData();

    const interval = setInterval(pollData, 5000);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [tempDateMode, setTempDateMode] = useState('preset'); // 'preset' | 'single' | 'range'
  const [tempPreset, setTempPreset] = useState('7 ngày qua');
  const [tempSingleDate, setTempSingleDate] = useState('');
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  // Initialize modal values when opened
  useEffect(() => {
    if (isDateModalOpen) {
      if (summaryDate === 'Hôm nay' || summaryDate === 'Hôm qua' || summaryDate === '7 ngày qua' || summaryDate === '30 ngày qua' || summaryDate === 'Tháng này' || summaryDate === 'Tháng trước') {
        setTempDateMode('preset');
        setTempPreset(summaryDate);
      } else {
        const match = summaryDate.match(/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
        if (match) {
          if (match[1] === match[2]) {
            setTempDateMode('single');
            setTempSingleDate(match[1]);
          } else {
            setTempDateMode('range');
            setTempStartDate(match[1]);
            setTempEndDate(match[2]);
          }
        } else {
          // Check if single date YYYY-MM-DD
          const singleMatch = summaryDate.match(/^\d{4}-\d{2}-\d{2}$/);
          if (singleMatch) {
            setTempDateMode('single');
            setTempSingleDate(summaryDate);
          } else {
            setTempDateMode('preset');
            setTempPreset('Hôm qua');
          }
        }
      }
    }
  }, [isDateModalOpen, summaryDate]);

  const handleApplyDate = () => {
    let finalDate = 'Hôm qua';
    if (tempDateMode === 'preset') {
      finalDate = tempPreset;
    } else if (tempDateMode === 'single') {
      if (!tempSingleDate) {
        toast.error(t('Vui lòng chọn ngày'));
        return;
      }
      finalDate = tempSingleDate;
    } else if (tempDateMode === 'range') {
      if (!tempStartDate || !tempEndDate) {
        toast.error(t('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc'));
        return;
      }
      if (new Date(tempStartDate) > new Date(tempEndDate)) {
        toast.error(t('Ngày bắt đầu không được lớn hơn ngày kết thúc'));
        return;
      }
      finalDate = `${tempStartDate} đến ${tempEndDate}`;
    }
    setSummaryDate(finalDate);
    setIsPlaying(true);
    setIsDateModalOpen(false);
  };

  const [bootPhase, setBootPhase] = useState<'loading' | 'active' | 'shutting_down'>('loading');
  const [bootPercent, setBootPercent] = useState(0);
  const [bootMessages, setBootMessages] = useState<string[]>([]);

  const [totalCounter, setTotalCounter] = useState(0);
  const [sharedCounter, setSharedCounter] = useState(0);
  const [errorCounter, setErrorCounter] = useState(0);

  const [isTotalGlow, setIsTotalGlow] = useState(false);
  const [totalRipples, setTotalRipples] = useState<{ id: string }[]>([]);

  const triggerTotalRipple = () => {
    setIsTotalGlow(true);
    setTotalCounter(prev => prev + 1);
    const rid = Math.random().toString(36).substring(2, 9);
    setTotalRipples(prev => [...prev, { id: rid }]);
    setTimeout(() => {
      setIsTotalGlow(false);
    }, 1500);
    setTimeout(() => {
      setTotalRipples(prev => prev.filter(r => r.id !== rid));
    }, 1600);
  };

  const [isSharedGlow, setIsSharedGlow] = useState(false);
  const [sharedRipples, setSharedRipples] = useState<{ id: string }[]>([]);

  const triggerSharedRipple = () => {
    setIsSharedGlow(true);
    setSharedCounter(prev => prev + 1);
    const rid = Math.random().toString(36).substring(2, 9);
    setSharedRipples(prev => [...prev, { id: rid }]);
    setTimeout(() => {
      setIsSharedGlow(false);
    }, 1500);
    setTimeout(() => {
      setSharedRipples(prev => prev.filter(r => r.id !== rid));
    }, 1600);
  };

  const [isRetainedGlow, setIsRetainedGlow] = useState(false);
  const [retainedRipples, setRetainedRipples] = useState<{ id: string }[]>([]);

  const triggerRetainedRipple = (particleId: string, status: 'rejected' | 'duplicate') => {
    setIsRetainedGlow(true);
    setErrorCounter(prev => prev + 1);
    if (isPlaying) {
      setSimErrorCount(prev => prev + 1);
    }
    const rid = Math.random().toString(36).substring(2, 9);
    setRetainedRipples(prev => [...prev, { id: rid }]);

    setIsTelemetryGlitch(true);
    setTimeout(() => {
      setIsTelemetryGlitch(false);
    }, 300);

    setTimeout(() => {
      setIsRetainedGlow(false);
    }, 1500);
    setTimeout(() => {
      setRetainedRipples(prev => prev.filter(r => r.id !== rid));
    }, 1600);

    // Update bottom console log status
    setLocalRecentFeed(prev => prev.map(item => {
      if (item.id === particleId) {
        return {
          ...item,
          status: status
        };
      }
      return item;
    }));
  };

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [consultantChannels, setConsultantChannels] = useState<Record<number, { name: string; color: string }>>({});
  const [simulatedLeadsPerSale, setSimulatedLeadsPerSale] = useState<Record<string, number>>({});
  const [simulatedLeadsPerSource, setSimulatedLeadsPerSource] = useState<Record<string, number>>({});

  // Simulation timer states (5 minutes = 300 seconds)
  const [simElapsedTime, setSimElapsedTime] = useState(0);
  const [simCurrentIndex, setSimCurrentIndex] = useState(0);

  const [simTotalCount, setSimTotalCount] = useState(0);
  const [simSharedCount, setSimSharedCount] = useState(0);
  const [simErrorCount, setSimErrorCount] = useState(0);

  const sysDecLockText = useMemo(() => {
    const statsSource = todayStats || stats;
    const passed = isPlaying 
      ? (simTotalCount - simErrorCount) 
      : (statsSource?.ai_passed_count || 950);
    const total = isPlaying 
      ? simTotalCount 
      : (statsSource?.total_today || 1542);
    return `AI_SCREEN: ${passed}/${total} PASSED`;
  }, [isPlaying, simTotalCount, simErrorCount, todayStats, stats]);

  const fairShareEquityText = useMemo(() => {
    if (isPlaying) {
      const counts = Object.values(simulatedLeadsPerSale);
      if (counts.length < 2) return '100.0%';
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      if (mean === 0) return '100.0%';
      const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
      const sd = Math.sqrt(variance);
      const coeffOfVariation = sd / mean;
      const equity = Math.max(70, 100 - (coeffOfVariation * 20));
      return equity.toFixed(1) + '%';
    } else {
      return (todayStats || stats)?.fair_share_equity || '96.5%';
    }
  }, [isPlaying, simulatedLeadsPerSale, todayStats, stats]);

  const sheetsStatusText = useMemo(() => {
    if (isPlaying) {
      return '2/2 OK';
    } else {
      const sheets = connections.filter(c => c.connection_type === 'sheets');
      if (sheets.length === 0) return 'NONE';
      const errors = sheets.filter(c => c.sync_status === 'error').length;
      return errors > 0 ? `${errors} ERR` : `${sheets.length}/${sheets.length} OK`;
    }
  }, [isPlaying, connections]);

  const gatewayPingText = useMemo(() => {
    const pendingCount = isPlaying
      ? yesterdayLogs.slice(0, simCurrentIndex).filter((log: any) => log.status === 'pending_work_hours').length
      : (todayStats || stats)?.pending_work_hours_count || 38;
    return `PENDING_QUEUE: ${pendingCount} LEADS`;
  }, [isPlaying, yesterdayLogs, simCurrentIndex, todayStats, stats]);

  // MOCK DATA HELPERS
  const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];
  const middleNames = ['Thành', 'Thị', 'Văn', 'Minh', 'Hồng', 'Quang', 'Hữu', 'Anh', 'Ngọc', 'Khánh'];
  const lastNames = ['Nam', 'Mai', 'Long', 'Trang', 'Hải', 'Hùng', 'Cường', 'Vy', 'Tuấn', 'Linh'];

  const getSimulationPool = () => {
    if (yesterdayLogs.length > 0) return yesterdayLogs;

    // Fallback mock pool if yesterday had no data
    const fallback = [];
    const statuses: ('assigned' | 'rejected' | 'duplicate' | 'compensation' | 'reminder')[] = ['assigned', 'assigned', 'assigned', 'rejected', 'duplicate', 'compensation', 'reminder'];
    const fallbackSources = ['Facebook Ad Lead - TOPUP', 'Facebook Ad Male_30_45', 'Zalo Webhook & Direct API'];
    const fallbackSales = ['Turnio DEV', 'Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C'];

    for (let i = 0; i < 15; i++) {
      const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${middleNames[Math.floor(Math.random() * middleNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
      const source = fallbackSources[Math.floor(Math.random() * fallbackSources.length)];
      const sale = fallbackSales[Math.floor(Math.random() * fallbackSales.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const randHour = Math.floor(Math.random() * 24);
      const randMin = Math.floor(Math.random() * 60);
      const randSec = Math.floor(Math.random() * 60);
      const date = new Date();
      date.setDate(date.getDate() - 1);
      date.setHours(randHour, randMin, randSec, 0);

      fallback.push({
        lead_name: name,
        source: source,
        assigned_to_name: sale,
        status: status,
        created_at: date.toISOString()
      });
    }
    return fallback;
  };

  const activeSources = useMemo(() => {
    if (isPlaying) {
      const pool = yesterdayLogs.length > 0 ? yesterdayLogs : getSimulationPool();
      const uniqueSources = new Set<string>();
      pool.forEach((log: any) => {
        const srcName = log.source || log.type || 'Nhập tay';
        if (srcName) uniqueSources.add(srcName);
      });

      const colors = ['#3b82f6', '#10b981', '#BD1D2D', '#f59e0b', '#ec4899'];
      return Array.from(uniqueSources).map((srcName, idx) => {
        const count = simulatedLeadsPerSource[srcName] || 0;
        const isApiOrWebhook = srcName.toLowerCase().includes('api') || srcName.toLowerCase().includes('webhook');
        const isManual = srcName === 'Nhập tay';
        return {
          id: `sim_src_${idx}`,
          name: srcName,
          type: isApiOrWebhook ? 'api' : isManual ? 'manual' : 'sheet',
          icon: isApiOrWebhook ? GitBranch : Database,
          color: colors[idx % colors.length],
          count,
          ping: (isApiOrWebhook || isManual) ? 'Active' : 'Sync',
          rate: count > 0 ? (count / Math.max(1, simElapsedTime)).toFixed(2) + '/s' : '0.00/s'
        };
      });
    } else {
      const currentStats = todayStats || stats;
      if (!currentStats || !Array.isArray(currentStats.sourceStats)) return [];
      const filteredStats = currentStats.sourceStats.filter((s: any) => s.value > 0);
      return filteredStats.map((s: any, idx: number) => {
        const isApiOrWebhook = s.name.toLowerCase().includes('api') || s.name.toLowerCase().includes('webhook');
        const isManual = s.name === 'Nhập tay';
        return {
          id: `real_src_${idx}`,
          name: s.name,
          type: isApiOrWebhook ? 'api' : isManual ? 'manual' : 'sheet',
          icon: isApiOrWebhook ? GitBranch : Database,
          color: s.color || '#3b82f6',
          count: s.value,
          ping: (isApiOrWebhook || isManual) ? 'Active' : 'Sync',
          rate: s.value > 0 ? (s.value / 86400).toFixed(3) + '/s' : '0.00/s'
        };
      });
    }
  }, [isPlaying, yesterdayLogs, stats, todayStats, simulatedLeadsPerSource, simElapsedTime]);

  const salesList = useMemo(() => {
    const currentStats = todayStats || stats;
    const rawConsultants = currentStats?.topConsultants || [];
    const colors = ['#a31422', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    let list: any[] = [];

    if (allConsultants && allConsultants.length > 0) {
      list = allConsultants.map((c, idx) => {
        const statItem = rawConsultants.find((rc: any) => rc.name === c.name || String(rc.id) === String(c.id));
        const dataCount = statItem ? statItem.data : 0;

        const isWorking = isCurrentlyWorking(c);
        const statusMsg = isWorking ? 'Active' : 'Inactive';

        return {
          id: c.id,
          name: c.name,
          avatar: c.avatar || '',
          status: c.status || 'active',
          vacation_mode: c.vacation_mode || 0,
          work_start_time: c.work_start_time || '08:00',
          work_end_time: c.work_end_time || '17:30',
          work_schedule: c.work_schedule || null,
          data: dataCount,
          percent: 0,
          color: colors[idx % colors.length],
          efficiency: statItem?.efficiency || `${80 + ((idx * 7) % 18)}%`,
          statusMsg
        };
      });

      // Filter: keep active reps, or those with data today, or those involved in recent logs
      const currentLogs = todayLogs.length > 0 ? todayLogs : recentLogs;
      const activeLogNames = new Set(currentLogs?.map((log: any) => log.assigned_to_name) || []);

      list = list.filter(sale =>
        sale.status === 'active' ||
        sale.status === 'pending_work_hours' ||
        sale.data > 0 ||
        activeLogNames.has(sale.name)
      );

      // Sort: Online/active first, then by data count desc
      list.sort((a, b) => {
        const aActive = isCurrentlyWorking(a);
        const bActive = isCurrentlyWorking(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return b.data - a.data;
      });

      list = list.slice(0, 5);
    } else if (rawConsultants && rawConsultants.length > 0) {
      list = rawConsultants.slice(0, 5).map((rc: any, idx: number) => {
        const isWorking = isCurrentlyWorking(rc);
        const statusMsg = isWorking ? 'Active' : 'Inactive';
        return {
          id: rc.id,
          name: rc.name,
          avatar: rc.avatar || '',
          status: rc.status || 'active',
          vacation_mode: rc.vacation_mode || 0,
          work_start_time: rc.work_start_time || '08:00',
          work_end_time: rc.work_end_time || '17:30',
          work_schedule: rc.work_schedule || null,
          data: rc.data || 0,
          percent: 0,
          color: colors[idx % colors.length],
          efficiency: rc.efficiency || `${85 + (idx * 3)}%`,
          statusMsg
        };
      });
    } else {
      list = [
        { name: 'Nguyễn Thị Linh Đan', data: 3, avatar: '', status: 'active', percent: 80, color: '#a31422', efficiency: '98%', work_start_time: '08:00', work_end_time: '17:30' },
        { name: 'Lưu Phan Hoàng Phúc', data: 2, avatar: '', status: 'active', percent: 50, color: '#3b82f6', efficiency: '92%', work_start_time: '08:00', work_end_time: '17:30' },
        { name: 'Lê Đình Ý Nhi', data: 1, avatar: '', status: 'active', percent: 40, color: '#10b981', efficiency: '87%', work_start_time: '08:00', work_end_time: '17:30' },
        { name: 'Nguyễn Phương Uyên', data: 1, avatar: '', status: 'active', percent: 25, color: '#f59e0b', efficiency: '88%', work_start_time: '08:00', work_end_time: '17:30' }
      ].map(item => {
        const isWorking = isCurrentlyWorking(item);
        return {
          ...item,
          statusMsg: isWorking ? 'Active' : 'Inactive'
        };
      });
    }

    return list.map((sale: any) => {
      const dataCount = isPlaying ? 0 : sale.data;
      return {
        ...sale,
        data: dataCount
      };
    });
  }, [todayStats, stats, allConsultants, isPlaying, todayLogs, recentLogs]);

  const totalLeadsOfAll = salesList.reduce((sum: number, s: any) => sum + (s.data || 0) + (simulatedLeadsPerSale[s.name] || 0), 0);

  const getSaleStatus = (sale: any) => {
    const isWorking = isCurrentlyWorking(sale);
    if (isWorking) {
      return { text: 'Active', color: '#10b981', dotColor: '#10b981' };
    } else {
      return { text: 'Inactive', color: '#f59e0b', dotColor: '#f59e0b' };
    }
  };

  const triggerSourceRipple = (index: number) => {
    setLastActiveSourceIdx(index);
    setSourceGlowKeys(prev => ({ ...prev, [index]: (prev[index] || 0) + 1 }));
    setActiveSourcesGlow(prev => ({ ...prev, [index]: true }));
    setTimeout(() => {
      setActiveSourcesGlow(prev => ({ ...prev, [index]: false }));
    }, 850);
  };

  const spawnParticle = (leadName: string, sourceIdx: number, saleIdx: number, status: 'assigned' | 'rejected' | 'duplicate' | 'compensation' | 'pending_work_hours' | 'reminder', particleId: string) => {
    const coords = coordsRef.current;
    const sCoord = coords.sources[sourceIdx];
    const cCoord = coords.core;
    const saCoord = coords.sales[saleIdx] || cCoord;

    if (!sCoord) return;

    triggerSourceRipple(sourceIdx);

    setTimeout(() => {
      const currentCoords = coordsRef.current;
      const curSCoord = currentCoords.sources[sourceIdx] || sCoord;
      const curSaCoord = currentCoords.sales[saleIdx] || saCoord || cCoord;

      const startX = curSCoord.x;
      const startY = curSCoord.y;
      const targetX = curSaCoord.x;
      const targetY = curSaCoord.y;

      const holdTime = isPlaying
        ? (1.8 + Math.random() * 0.6) // Vets at AI core for ~1.8-2.4s in simulation
        : (7.0 + Math.random() * 2.0); // Vets at AI core for ~7-9s in real-time

      const newParticle: Particle = {
        id: particleId,
        leadName,
        sourceType: activeSources[sourceIdx]?.name || 'Nhập tay',
        status,
        saleName: salesList[saleIdx]?.name || 'Hệ thống',
        saleIndex: saleIdx,
        x: startX,
        y: startY,
        lastX: startX,
        lastY: startY,
        startX,
        startY,
        targetX,
        targetY,
        progress: 0,
        duration: isPlaying
          ? (2.5 + Math.random() * 1.0) // ~2.5-3.5s drift to core in simulation
          : (35.0 + Math.random() * 4.0), // ~35-39s drift to core in real-time (Max 90s total)
        duration2: isPlaying
          ? (2.5 + Math.random() * 1.0) // ~2.5-3.5s drift to sale rep in simulation
          : (35.0 + Math.random() * 4.0), // ~35-39s drift to sale rep in real-time (Max 90s total)
        stage: 0,
        holdTime,
        maxHoldTime: holdTime,
        color: activeSources[sourceIdx]?.color || '#BD1D2D',
        size: 4.5 + Math.random() * 1.5
      };

      particlesRef.current.push(newParticle);
    }, 800);
  };

  const getSecondsFromMidnight = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      return hours * 3600 + minutes * 60 + seconds;
    } catch (e) {
      return 0;
    }
  };

  const sortedPool = useMemo(() => {
    const rawPool = yesterdayLogs.length > 0 ? yesterdayLogs : getSimulationPool();
    return [...rawPool].sort((a, b) => {
      const secA = getSecondsFromMidnight(a.created_at);
      const secB = getSecondsFromMidnight(b.created_at);
      return secA - secB;
    });
  }, [yesterdayLogs]);

  const triggerSimulatedLead = (log: any) => {
    let name = log.lead_name || 'Khách hàng';

    const logSource = log.source || log.type || 'Nhập tay';
    let sourceIdx = activeSources.findIndex((s: any) => s.name === logSource);
    if (sourceIdx === -1) {
      sourceIdx = 0;
    }

    const assignedTVV = log.assigned_to_name;
    let saleIdx = salesList.findIndex((sale: any) => sale.name === assignedTVV);
    if (saleIdx === -1) {
      saleIdx = Math.floor(Math.random() * salesList.length);
    }

    let status: 'assigned' | 'rejected' | 'duplicate' | 'compensation' | 'pending_work_hours' | 'reminder' = 'assigned';
    const rawStatus = log.status;
    if (rawStatus === 'assigned' || rawStatus === 'rejected' || rawStatus === 'duplicate' || rawStatus === 'compensation' || rawStatus === 'pending_work_hours' || rawStatus === 'reminder') {
      status = rawStatus;
    } else if (rawStatus === 'rule_6_month') {
      status = 'assigned';
    }

    const particleId = Math.random().toString(36).substring(2, 9);
    spawnParticle(name, sourceIdx, saleIdx, status, particleId);

    // Update simulation total counter
    setSimTotalCount(prev => prev + 1);

    // Track simulated leads per source
    const sourceName = activeSources[sourceIdx]?.name || logSource;
    setSimulatedLeadsPerSource(prev => ({
      ...prev,
      [sourceName]: (prev[sourceName] || 0) + 1
    }));

    // Animate Lõi AI purple glow and float +1
    triggerTotalRipple();

    // Add to recent feed as 'processing'
    const newFeedItem = {
      id: particleId,
      lead_name: name,
      assigned_to_name: status === 'rejected' ? 'Rich Land AI' : salesList[saleIdx]?.name || 'Hệ thống',
      status: 'processing',
      created_at: log.created_at || new Date().toISOString()
    };
    setLocalRecentFeed(prev => [newFeedItem, ...prev.slice(0, 3)]);
  };

  const handleClose = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn("Fullscreen exit failed on close", err));
    }
    setBootPhase('shutting_down');
    setTimeout(() => {
      particlesRef.current = [];
      onClose();
    }, 1300);
  };

  // Load logs and stats for the selected summary date specifically for simulation
  useEffect(() => {
    if (isOpen) {
      let hideLoaderTimeout: any = null;

      // Show loading boot messages when reloading data for a new summary date
      if (bootPhase === 'active') {
        setBootPhase('loading');
        setBootPercent(0);
        setBootMessages([`[LOADING SUMMARY DATA FOR ${summaryDate.toUpperCase()}...]`]);
      }

      Promise.all([
        fetchAPI(`get_logs&date=${encodeURIComponent(summaryDate)}&pageSize=250`),
        fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(summaryDate)}`)
      ])
        .then(([logsRes, statsRes]) => {
          if (logsRes.success && Array.isArray(logsRes.data)) {
            const filtered = logsRes.data.filter((log: any) => log.status !== 'silent');
            setYesterdayLogs(filtered);
          }
          if (statsRes.success && statsRes.data) {
            setTodayStats(statsRes.data);
          }

          if (bootPhase !== 'active') {
            // During initial boot, the main loader handles completion
          } else {
            // If user changed summaryDate, complete loading immediately
            setBootPercent(100);
            hideLoaderTimeout = setTimeout(() => {
              setBootPhase('active');
            }, 250);
          }
        })
        .catch(err => {
          console.error(`Lỗi tải dữ liệu ${summaryDate}:`, err);
          if (bootPhase === 'loading') {
            setBootPhase('active');
          }
        });

      return () => {
        if (hideLoaderTimeout) clearTimeout(hideLoaderTimeout);
      };
    }
  }, [isOpen, summaryDate]);

  // Holographic Boot Loader loop
  useEffect(() => {
    if (isOpen) {
      setBootPhase('loading');
      setBootPercent(0);
      setBootMessages(['[INITIALIZING NEURAL DISPATCH ENGINE...]']);

      let dataLoaded = false;

      // Fetch today's logs and all consultants
      Promise.all([
        fetchAPI('get_logs&date=Hôm nay&exclude_status=silent&page=1&pageSize=100'),
        fetchAPI('get_consultants')
      ])
        .then(([logsRes, consultantsRes]) => {
          if (logsRes.success && Array.isArray(logsRes.data)) {
            const filtered = logsRes.data.filter((log: any) => log.status !== 'silent');
            setTodayLogs(filtered);
          }
          if (consultantsRes.success && Array.isArray(consultantsRes.data)) {
            setAllConsultants(consultantsRes.data);
          }
          dataLoaded = true;
        })
        .catch(err => {
          console.error('Lỗi tải dữ liệu:', err);
          dataLoaded = true; // Proceed anyway on error
        });

      const allMsgs = [
        '[ESTABLISHING NEURAL CONDUITS... OK]',
        '[SYNCING GOOGLE SHEETS CHANNELS... OK]',
        '[DECRYPTING DIRECT WEBHOOK API... OK]',
        '[BOOTING PRE-SCREENER AI REACTOR... ONLINE]',
        '[ESTABLISHING AI INFINITY... DEPLOYED]'
      ];

      const timer = setInterval(() => {
        setBootPercent(prev => {
          if (prev >= 90 && !dataLoaded) {
            // Wait at 90% for data to load
            return prev;
          }
          const next = prev + Math.floor(Math.random() * 8) + 6;
          if (next >= 100) {
            clearInterval(timer);
            setTimeout(() => {
              setBootPhase('active');
            }, 350);
            return 100;
          }

          const msgIdx = Math.min(allMsgs.length - 1, Math.floor((next / 100) * allMsgs.length));
          setBootMessages(msgs => {
            const nextMsgs = [...msgs];
            if (!nextMsgs.includes(allMsgs[msgIdx])) {
              nextMsgs.push(allMsgs[msgIdx]);
            }
            return nextMsgs;
          });

          return next;
        });
      }, 140);

      return () => {
        clearInterval(timer);
      };
    }
  }, [isOpen]);

  // Sync state counters with stats prop or today's stats (representing current date filter/today stats)
  useEffect(() => {
    const currentStats = todayStats || stats;
    if (currentStats) {
      setTotalCounter(currentStats.total_today || 0);
      setSharedCounter(currentStats.distributed_today || 0);
      setErrorCounter(currentStats.errors || 0);
    }
  }, [stats, todayStats, isPlaying]);

  // Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + now.toLocaleDateString('vi-VN'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const lastProcessedLogIdRef = useRef<string | null>(null);

  // Sync logs feed (sliced to 4 items for V2 compact design)
  useEffect(() => {
    if (isPlaying) return; // Do not sync logs feed from actual logs if simulation is active!

    const currentLogs = todayLogs.length > 0 ? todayLogs : recentLogs;

    if (currentLogs && currentLogs.length > 0) {
      const activeLogs = currentLogs.filter((log: any) => log.status !== 'silent');

      const formattedLogs = activeLogs.slice(0, 4).map((log, idx) => ({
        id: log.id || `log-${idx}`,
        lead_name: log.lead_name,
        assigned_to_name: log.assigned_to_name || 'Hệ thống',
        status: log.status,
        created_at: log.created_at || new Date().toISOString()
      }));
      setLocalRecentFeed(formattedLogs);

      // Real-time Spawning Trigger Logic
      const latestLog = activeLogs[0];
      if (latestLog && lastProcessedLogIdRef.current && latestLog.id !== lastProcessedLogIdRef.current) {
        let name = latestLog.lead_name || 'Khách hàng';
        const logSource = latestLog.source || latestLog.type || 'Nhập tay';

        let sourceIdx = activeSources.findIndex((s: any) => s.name === logSource);
        if (sourceIdx === -1) sourceIdx = 0;

        const assignedTVV = latestLog.assigned_to_name;
        let saleIdx = salesList.findIndex((sale: any) => sale.name === assignedTVV);
        if (saleIdx === -1) saleIdx = 0;

        let status: 'assigned' | 'rejected' | 'duplicate' | 'compensation' | 'pending_work_hours' | 'reminder' = 'assigned';
        const rawStatus = latestLog.status;
        if (rawStatus === 'assigned' || rawStatus === 'rejected' || rawStatus === 'duplicate' || rawStatus === 'compensation' || rawStatus === 'pending_work_hours' || rawStatus === 'reminder') {
          status = rawStatus;
        }

        const particleId = latestLog.id;
        spawnParticle(name, sourceIdx, saleIdx, status, particleId);

        // Update real-time total counter
        setTotalCounter(prev => prev + 1);

        // Animate core immediately
        triggerTotalRipple();

        // Show as processing in feed initially
        setLocalRecentFeed(prev => {
          const updated = [...prev];
          const matchIdx = updated.findIndex(item => item.id === latestLog.id);
          if (matchIdx !== -1) {
            updated[matchIdx] = {
              ...updated[matchIdx],
              status: 'processing'
            };
          }
          return updated;
        });
      }

      if (latestLog) {
        lastProcessedLogIdRef.current = latestLog.id;
      }
    } else {
      setLocalRecentFeed([]);
    }
  }, [recentLogs, todayLogs, isPlaying, activeSources, salesList]);

  // Reset/Initialize the lastProcessedLogIdRef when toggling to Real-time
  useEffect(() => {
    if (isPlaying) return;
    const currentLogs = todayLogs.length > 0 ? todayLogs : recentLogs;
    if (currentLogs && currentLogs.length > 0) {
      const activeLogs = currentLogs.filter((log: any) => log.status !== 'silent');
      if (activeLogs.length > 0) {
        lastProcessedLogIdRef.current = activeLogs[0].id;

        // Find the latest successful log to highlight the last active sale rep
        const successfulLog = activeLogs.find((log: any) =>
          log.status === 'assigned' ||
          log.status === 'compensation' ||
          log.status === 'pending_work_hours' ||
          log.status === 'reminder'
        );
        if (successfulLog) {
          const saleIdx = salesList.findIndex((sale: any) => sale.name === successfulLog.assigned_to_name);
          if (saleIdx !== -1) {
            setLastActiveSaleIdx(saleIdx);

            const logSource = successfulLog.source || successfulLog.type || 'Nhập tay';
            const matchedSource = activeSources.find((s: any) => s.name === logSource);
            const sourceColor = matchedSource?.color || '#10b981';
            setConsultantChannels(prev => ({
              ...prev,
              [saleIdx]: { name: logSource, color: sourceColor }
            }));
          }
        }
      }
    }
  }, [isPlaying, todayLogs, recentLogs, salesList, activeSources]);

  // Handle ESC close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto fullscreen on mount, exit on unmount
  useEffect(() => {
    if (isOpen) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => {
          console.warn("Fullscreen request failed", err);
        });
      }
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.warn("Fullscreen exit failed", err);
        });
      }
    };
  }, [isOpen]);

  // Simulating random lead entries interval - loops and resets every 5 minutes (300 seconds) or 10 minutes (600 seconds) depending on duration
  useEffect(() => {
    if (!isPlaying) {
      setSimElapsedTime(0);
      setSimCurrentIndex(0);
      setSimTotalCount(0);
      setSimSharedCount(0);
      setSimErrorCount(0);
      setSimulatedLeadsPerSale({});
      setSimulatedLeadsPerSource({});
      return;
    }

    // Reset simulation variables and clear logs terminal on start
    setSimElapsedTime(0);
    setSimCurrentIndex(0);
    setSimTotalCount(0);
    setSimSharedCount(0);
    setSimErrorCount(0);
    setSimulatedLeadsPerSale({});
    setSimulatedLeadsPerSource({});
    setLocalRecentFeed([]);

    const interval = setInterval(() => {
      const duration = getSimulationDuration();
      setSimElapsedTime(prev => {
        const next = prev + 1;
        if (summaryDate === 'Hôm nay') {
          const now = new Date();
          const actualSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
          const projectedSecs = Math.floor((next / duration) * 86400);
          if (projectedSecs >= actualSecs) {
            // Switch to Realtime mode when catching up to now
            setTimeout(() => {
              setIsPlaying(false);
            }, 0);
            return prev;
          }
        }
        if (next >= duration) {
          // Switch to Realtime mode on completion
          setTimeout(() => {
            setIsPlaying(false);
          }, 0);
          return prev;
        }
        // Simulate a connection sync event every 20 seconds
        if (next % 20 === 0) {
          const activeConns = connections.filter(c => c.connection_type === 'sheets').length > 0 
            ? connections.filter(c => c.connection_type === 'sheets') 
            : [
                { sheet_name: 'Lead 4 CT Đặt lịch', sync_status: 'success', connection_type: 'sheets' },
                { sheet_name: 'Lead Đặt giờ - EMBA', sync_status: 'success', connection_type: 'sheets' }
              ];
          const randomConn = activeConns[Math.floor(Math.random() * activeConns.length)];
          const fakeSyncTime = new Date().toISOString();
          const isErr = randomConn.sync_status === 'error';
          handleConnectionSyncEvent(
            randomConn.sheet_name, 
            fakeSyncTime, 
            isErr ? 'error' : 'success', 
            isErr ? (randomConn.last_error || 'Failed to fetch CSV. Spreadsheet might be private.') : undefined
          );
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, summaryDate]); // Add summaryDate so reset happens correctly if date changes

  // Scheduler to trigger leads based on pool size and duration with timeline projection
  useEffect(() => {
    if (!isPlaying) return;

    const M = sortedPool.length;
    if (M === 0) return;

    let indexToTrigger = simCurrentIndex;
    let triggeredAny = false;
    const duration = getSimulationDuration();

    while (indexToTrigger < M) {
      const currentLog = sortedPool[indexToTrigger];
      const secondsFromMidnight = getSecondsFromMidnight(currentLog.created_at);
      const scheduledSeconds = (secondsFromMidnight / 86400) * duration;

      if (simElapsedTime >= scheduledSeconds) {
        triggerSimulatedLead(currentLog);
        indexToTrigger++;
        triggeredAny = true;
      } else {
        break;
      }
    }

    if (triggeredAny) {
      setSimCurrentIndex(indexToTrigger);
    }
  }, [isPlaying, simElapsedTime, simCurrentIndex, sortedPool, summaryDate]);

  const triggerSaleRipple = (index: number, sourceName: string, sourceColor: string, particleId: string, status: 'assigned' | 'compensation' | 'pending_work_hours' | 'reminder') => {
    const matchedSource = activeSources.find((s: any) => s.name === sourceName);
    const resolvedColor = matchedSource?.color || sourceColor;

    setLastActiveSaleIdx(index); // Keep glowing border active forever until a new sale receives data
    setActiveSalesGlow(prev => ({ ...prev, [index]: true }));
    setConsultantChannels(prev => ({ ...prev, [index]: { name: sourceName, color: resolvedColor } }));
    triggerSharedRipple(); // Glow green and float +1 for "ĐÃ PHÂN PHỐI"
    if (isPlaying) {
      setSimSharedCount(prev => prev + 1);
    }

    const targetSale = salesList[index];
    if (targetSale) {
      setSimulatedLeadsPerSale(prev => ({
        ...prev,
        [targetSale.name]: (prev[targetSale.name] || 0) + 1
      }));
    }

    // Update bottom console log status
    setLocalRecentFeed(prev => prev.map(item => {
      if (item.id === particleId) {
        return {
          ...item,
          status: status
        };
      }
      return item;
    }));

    setTimeout(() => {
      setActiveSalesGlow(prev => ({ ...prev, [index]: false }));
    }, 1600);
  };

  const displayTotalCounter = isPlaying ? simTotalCount : totalCounter;
  const displaySharedCounter = isPlaying ? simSharedCount : sharedCounter;
  const displayErrorCounter = isPlaying ? simErrorCount : errorCounter;

  const getDaysFromRange = (dateStr: string): number => {
    if (dateStr === 'Hôm nay' || dateStr === 'Hôm qua') {
      return 1;
    }
    if (dateStr === '7 ngày qua') {
      return 7;
    }
    if (dateStr === '30 ngày qua') {
      return 30;
    }
    if (dateStr === 'Tháng này') {
      const today = new Date();
      return today.getDate();
    }
    if (dateStr === 'Tháng trước') {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    // Custom range
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
    if (match) {
      const start = new Date(match[1]);
      const end = new Date(match[2]);
      const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
      const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
      return Math.max(1, Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1);
    }
    // Single date
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return 1;
    }
    return 7; // Fallback to 7 days
  };

  const getSimulationDuration = () => {
    const days = getDaysFromRange(summaryDate);
    return Math.max(180, Math.round((days / 7) * 600)); // Minimum 180 seconds (3 mins), linearly scales from there
  };



  const getDisplayTime = () => {
    if (isPlaying) {
      const duration = getSimulationDuration();
      if (isSingleDay(summaryDate)) {
        const daySecs = Math.min(86399, Math.floor((simElapsedTime / duration) * 86400));
        const hours = Math.floor(daySecs / 3600);
        const minutes = Math.floor((daySecs % 3600) / 60);
        const seconds = daySecs % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return `${timeStr} - ${getFormattedDateRange(summaryDate, t)}`;
      } else {
        return getFormattedDateRange(summaryDate, t);
      }
    }
    return currentTime;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="war-room-container"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at center, #060814 0%, #010204 100%)',
        color: '#f9fafb',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        overflow: 'hidden',
        userSelect: 'none',
        animation: bootPhase === 'shutting_down' ? 'holoDissolve 1.3s cubic-bezier(0.25, 1, 0.2, 1) forwards' : 'none',
        transformOrigin: 'center'
      }}
    >
      {/* Dynamic Cosmic Space Canvas */}
      {bootPhase !== 'loading' && (
        <SpaceCanvasBackground
          containerRef={containerRef}
          isPlaying={isPlaying}
          bootPhase={bootPhase}
          coreRef={coreRef}
          coreSphereRef={coreSphereRef}
          sourceRefs={sourceRefs}
          saleRefs={saleRefs}
          particlesRef={particlesRef}
          triggerSaleRipple={triggerSaleRipple}
          triggerRetainedRipple={triggerRetainedRipple}
          mockSources={activeSources}
          salesList={salesList}
          coordsRef={coordsRef}
          lastActiveSaleIdx={lastActiveSaleIdx}
          isFocusMode={isFocusMode}
          isRetainedGlow={isRetainedGlow}
          isCoreHoveredRef={isCoreHoveredRef}
          hoveredSaleIdx={hoveredSaleIdx}
          hoveredSourceIdx={hoveredSourceIdx}
          fairShareEquity={fairShareEquityText}
          sheetsStatus={sheetsStatusText}
          isTelemetryGlitch={isTelemetryGlitch}
        />
      )}

      {/* Main UI layout - only render if active/shutting_down */}
      {bootPhase !== 'loading' && (
        <>
          {/* Floating Exit Focus controls */}
          {isFocusMode && (
            <div
              style={{
                position: 'absolute',
                bottom: '1.25rem',
                right: '1.25rem',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(5, 7, 18, 0.55)',
                border: '1px solid rgba(189, 29, 45, 0.28)',
                borderRadius: '10px',
                padding: '5px 8px',
                backdropFilter: 'blur(15px)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
              }}
            >
              <button
                onClick={() => setIsFocusMode(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#f45b69',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                title={t("Thoát chế độ tập trung")}
              >
                <Eye size={12} />
                <span>{t('Thoát tập trung')}</span>
              </button>

              <button
                onClick={handleClose}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#ef4444';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.color = '#ef4444';
                }}
                title={t("Đóng AI Infinity")}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Header controls HUD */}
          {!isFocusMode && (
            <div
              className="war-room-header"
              style={{
                height: '70px',
                borderBottom: '1px solid rgba(189, 29, 45, 0.18)',
                background: 'rgba(5, 7, 18, 0.45)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 2rem',
                zIndex: 10,
                position: 'relative',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: '1.8px solid rgba(189, 29, 45, 0.70)',
                  overflow: 'hidden',
                  boxShadow: '0 0 12px rgba(189, 29, 45, 0.50)',
                  background: 'radial-gradient(circle, rgba(189, 29, 45, 0.40) 0%, rgba(5, 7, 18, 0.96) 100%)'
                }}>
                  <img
                    src="/LOGO.jpg"
                    alt="RICH LAND Logo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)',
                      WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)'
                    }}
                  />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.22rem', fontWeight: 800, letterSpacing: '0.08em', color: '#fff', textShadow: '0 0 12px rgba(163, 20, 34,0.6)' }}>RICH LAND AI INFINITY</h2>
                  <p style={{ fontSize: '0.7rem', color: '#BD1D2D', display: 'flex', alignItems: 'center', gap: '3px', textShadow: '0 0 8px rgba(189, 29, 45,0.4)' }}>
                    <span>{t('Dữ liệu AI Pre-screener & Vòng xoay phân bổ')}</span>
                    <span className="cursor-blink" style={{ display: 'inline-block', width: '6px', height: '10px', backgroundColor: '#BD1D2D', boxShadow: '0 0 8px rgba(189, 29, 45,0.7)' }} />
                  </p>
                </div>
              </div>

              {/* HUD Middle Diagnostics */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }} className="hide-on-mobile">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{t('Thời gian hệ thống')}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f3f4f6', marginTop: 2 }}>{getDisplayTime()}</div>
                </div>
                {isPlaying && (
                  <>
                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)' }} />
                    <div
                      onClick={() => setIsDateModalOpen(true)}
                      style={{
                        textAlign: 'center',
                        cursor: 'pointer',
                        padding: '4px 28px',
                        minWidth: '160px',
                        borderRadius: '8px',
                        border: '1px solid rgba(189, 29, 45, 0.25)',
                        background: 'rgba(189, 29, 45, 0.06)',
                        boxShadow: '0 0 10px rgba(189, 29, 45, 0.05)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(189, 29, 45, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(189, 29, 45, 0.55)';
                        e.currentTarget.style.boxShadow = '0 0 12px rgba(189, 29, 45, 0.25)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(189, 29, 45, 0.06)';
                        e.currentTarget.style.borderColor = 'rgba(189, 29, 45, 0.25)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(189, 29, 45, 0.05)';
                      }}
                      title={t("Tùy chọn ngày tóm tắt")}
                    >
                      <div style={{ fontSize: '0.625rem', color: '#e63946', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        <Calendar size={10} style={{ color: '#e63946' }} />
                        <span>{t('Data report')}</span>
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {summaryDate === 'Hôm nay' && (
                          <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            boxShadow: '0 0 10px #ef4444',
                            display: 'inline-block',
                            animation: 'pulseGlow 2s ease-in-out infinite'
                          }} />
                        )}
                        <span>{t(summaryDate)}</span>
                      </div>
                    </div>
                  </>
                )}
                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{t('AI Pre-screener')}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e63946', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="ping-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#e63946' }} />
                    ACTIVE
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    const nextPlaying = !isPlaying;
                    setIsPlaying(nextPlaying);
                    if (!nextPlaying) {
                      setSummaryDate('Hôm nay');
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: isPlaying ? '1px solid rgba(189, 29, 45, 0.45)' : '1px solid rgba(255,255,255,0.12)',
                    background: isPlaying ? 'rgba(189, 29, 45, 0.15)' : 'rgba(255,255,255,0.06)',
                    color: isPlaying ? '#f45b69' : '#fff',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = isPlaying ? 'rgba(189, 29, 45, 0.25)' : 'rgba(255, 255, 255, 0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isPlaying ? 'rgba(189, 29, 45, 0.15)' : 'rgba(255, 255, 255, 0.06)'; }}
                >
                  {isPlaying ? (
                    <>
                      <Pause size={12} style={{ color: '#e63946' }} />
                      {(() => {
                        const duration = getSimulationDuration();
                        if (isSingleDay(summaryDate)) {
                          const daySecs = Math.min(86399, Math.floor((simElapsedTime / duration) * 86400));
                          const hours = Math.floor(daySecs / 3600);
                          const minutes = Math.floor((daySecs % 3600) / 60);
                          const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                          return <span>{t('Tóm tắt')} ({timeStr})</span>;
                        } else {
                          const remainingSecs = Math.max(0, duration - simElapsedTime);
                          const min = Math.floor(remainingSecs / 60);
                          const sec = remainingSecs % 60;
                          const countdownStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                          return <span>{t('Tóm tắt')} ({countdownStr})</span>;
                        }
                      })()}
                    </>
                  ) : (
                    <>
                      <span className="live-dot-red" />
                      <span>Real-time</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsFocusMode(!isFocusMode)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(189, 29, 45, 0.45)',
                    background: isFocusMode ? 'rgba(189, 29, 45, 0.25)' : 'rgba(189, 29, 45, 0.12)',
                    color: '#f45b69',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.2s',
                    boxShadow: isFocusMode ? '0 0 10px rgba(189, 29, 45, 0.3)' : 'none'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = isFocusMode ? 'rgba(189, 29, 45, 0.35)' : 'rgba(189, 29, 45, 0.20)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isFocusMode ? 'rgba(189, 29, 45, 0.25)' : 'rgba(189, 29, 45, 0.12)'; }}
                  title={t("Bật/Tắt chế độ tập trung (Ẩn thanh HUD & nhật ký)")}
                >
                  <Tv size={12} style={{ color: '#e63946' }} />
                  <span>{t('Tập trung')}</span>
                </button>

                <button
                  onClick={handleClose}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(4px)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#ef4444';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  title={t("Thoát chế độ AI Infinity")}
                >
                  <X size={12} />
                  <span>{t('Đóng')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Main war room panel layout */}
          <div
            className="war-room-grid"
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: isMobile ? '230px 1fr 250px' : '330px 1fr 370px',
              padding: isMobile ? '0.5rem' : '1.5rem',
              gap: isMobile ? '0.75rem' : '1.75rem',
              zIndex: 5,
              position: 'relative'
            }}
          >
            {/* Left Console: Data Ingestion Systems */}
            <div
              className="war-room-left-col"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '0.75rem' : '1.25rem',
                paddingTop: isMobile ? '2.6rem' : (isFocusMode ? '5.5rem' : '1.5rem'),
                transition: 'padding-top 0.35s ease-out'
              }}
            >
              <h3 className="war-room-left-title" style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Server size={15} style={{ color: '#3b82f6' }} /> CONSOLE THU NHẬN SỐ
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
                {activeSources.map((src: any, idx: number) => {
                  const Icon = src.icon;
                  const isGlow = activeSourcesGlow[idx];
                  const isPermanentGlow = idx === lastActiveSourceIdx;
                  return (
                    <div
                      key={src.id}
                      ref={el => { sourceRefs.current[idx] = el; }}
                      className="war-room-source-card"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredSummary({
                          type: 'source',
                          data: src,
                          x: rect.right + 12,
                          y: rect.top
                        });
                        setHoveredSourceIdx(idx);
                      }}
                      onMouseLeave={() => {
                        setHoveredSummary(null);
                        setHoveredSourceIdx(null);
                      }}
                      style={{
                        background: isGlow
                          ? `${src.color}26`
                          : isPermanentGlow
                            ? `${src.color}0d`
                            : 'rgba(8, 12, 28, 0.45)',
                        backdropFilter: 'blur(25px)',
                        border: isGlow
                          ? `1.8px solid ${src.color}`
                          : isPermanentGlow
                            ? `1.8px solid ${src.color}66`
                            : `1.8px solid ${src.color}20`,
                        borderRadius: isMobile ? '10px' : '14px',
                        padding: isMobile ? '0.5rem 0.75rem' : '0.8rem 1.1rem',
                        boxShadow: isGlow
                          ? `0 0 25px ${src.color}c0, inset 0 0 15px ${src.color}4d`
                          : isPermanentGlow
                            ? `0 0 15px ${src.color}40`
                            : `0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 10px ${src.color}03`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: isMobile ? 8 : 14,
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        ['--hover-glow' as any]: `${src.color}45`,
                        ['--hover-border' as any]: src.color,
                        ['--hover-bg' as any]: `${src.color}15`
                      }}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: src.color }} />

                      {isGlow && (
                        <React.Fragment key={sourceGlowKeys[idx] || 0}>
                          <div style={{
                            position: 'absolute',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: src.color,
                            boxShadow: `0 0 10px ${src.color}, 0 0 20px ${src.color}`,
                            zIndex: 10,
                            pointerEvents: 'none',
                            animation: 'borderDotTop 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards'
                          }} />
                          <div style={{
                            position: 'absolute',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: src.color,
                            boxShadow: `0 0 10px ${src.color}, 0 0 20px ${src.color}`,
                            zIndex: 10,
                            pointerEvents: 'none',
                            animation: 'borderDotBottom 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards'
                          }} />
                        </React.Fragment>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? '26px' : '32px', height: isMobile ? '26px' : '32px', borderRadius: '6px', background: `${src.color}15`, border: `1px solid ${src.color}30`, flexShrink: 0 }}>
                          <Icon size={isMobile ? 12 : 16} style={{ color: src.color }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
                          <span style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.name}</span>
                          <span style={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{src.count} <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>Lead</span></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: src.color,
                          boxShadow: `0 0 8px ${src.color}`,
                          display: 'inline-block',
                          animation: 'pulseGlow 2s ease-in-out infinite'
                        }} />
                        <span style={{ fontSize: '0.65rem', color: src.color, fontWeight: 700 }}>{src.ping}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Center: Tactical Holomap with core */}
            <div
              className="war-room-center-col"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                paddingTop: isFocusMode ? (isMobile ? '8.0rem' : '5.5rem') : (isMobile ? '7rem' : '5.2rem'),
                transition: 'padding-top 0.35s ease-out'
              }}
            >
              <div
                className={isTelemetryGlitch ? "telemetry-glitch-active" : ""}
                style={{
                  position: 'absolute',
                  top: '15%',
                  left: '10%',
                  fontSize: '0.55rem',
                  color: isTelemetryGlitch ? '#f87171' : 'rgba(163, 20, 34, 0.3)',
                  pointerEvents: 'none',
                  transition: 'color 0.15s ease'
                }}
              >
                {sysDecLockText}
              </div>
              <div
                className={isTelemetryGlitch ? "telemetry-glitch-active" : ""}
                style={{
                  position: 'absolute',
                  bottom: '20%',
                  right: '8%',
                  fontSize: '0.55rem',
                  color: isTelemetryGlitch ? '#f87171' : 'rgba(189, 29, 45, 0.3)',
                  pointerEvents: 'none',
                  transition: 'color 0.15s ease'
                }}
              >
                {gatewayPingText}
              </div>

              <div
                ref={coreRef}
                className="war-room-core-outer"
                style={{
                  width: isMobile ? '130px' : '210px',
                  height: isMobile ? '130px' : '210px',
                  marginTop: isFocusMode ? (isMobile ? '5.5rem' : '5.5rem') : (isMobile ? '1.5rem' : '3.5rem'),
                  borderRadius: '50%',
                  background: isRetainedGlow
                    ? 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0.01) 70%)'
                    : 'radial-gradient(circle, rgba(189, 29, 45, 0.18) 0%, rgba(189, 29, 45, 0.01) 70%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  zIndex: 3,
                  transition: 'background 0.35s ease, margin-top 0.35s ease-out'
                }}
              >
                {/* Outer Concentric Rings centered with core */}
                <div style={{ position: 'absolute', inset: isMobile ? '-20px' : '-35px', border: isRetainedGlow ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(189, 29, 45, 0.05)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0, transition: 'border 0.35s ease' }} />
                <div style={{ position: 'absolute', inset: isMobile ? '-45px' : '-85px', border: isRetainedGlow ? '1px dashed rgba(239, 68, 68, 0.12)' : '1px dashed rgba(189, 29, 45, 0.03)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0, transition: 'border 0.35s ease' }} />
                {/* Concentric rotating outer rings */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: isRetainedGlow ? '2px dashed rgba(239, 68, 68, 0.55)' : '2px dashed rgba(189, 29, 45, 0.38)',
                    animation: 'spinCore 30s linear infinite',
                    transition: 'border 0.35s ease'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: isMobile ? '-8px' : '-15px',
                    borderRadius: '50%',
                    border: isRetainedGlow ? '1.2px solid rgba(239, 68, 68, 0.35)' : '1.2px solid rgba(189, 29, 45, 0.2)',
                    animation: 'spinCoreInverse 20s linear infinite',
                    transition: 'border 0.35s ease'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: isMobile ? '-18px' : '-32px',
                    borderRadius: '50%',
                    border: isRetainedGlow ? '1px dashed rgba(239, 68, 68, 0.25)' : '1px dashed rgba(189, 29, 45, 0.12)',
                    animation: 'spinCore 50s linear infinite',
                    transition: 'border 0.35s ease'
                  }}
                />

                {/* Glowing Hologram Center sphere */}
                <div
                  ref={coreSphereRef}
                  onMouseEnter={() => { isCoreHoveredRef.current = true; }}
                  onMouseLeave={() => { isCoreHoveredRef.current = false; }}
                  style={{
                    width: isMobile ? '76px' : '120px',
                    height: isMobile ? '76px' : '120px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.85) 0%, rgba(163, 20, 34, 0.98) 100%)',
                    boxShadow: isRetainedGlow
                      ? '0 0 45px rgba(239, 68, 68, 0.85), inset 0 0 20px rgba(255, 255, 255, 0.55)'
                      : '0 0 35px rgba(163, 20, 34, 0.55), inset 0 0 20px rgba(255,255,255,0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.05s ease-out, box-shadow 0.35s ease',
                    position: 'relative',
                    zIndex: 4,
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                >
                  {/* Red warning overlay for hardware-accelerated opacity transition */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.98) 100%)',
                      opacity: isRetainedGlow ? 1 : 0,
                      transition: 'opacity 0.35s ease',
                      zIndex: 0,
                      borderRadius: '50%'
                    }}
                  />
                  <Cpu size={isMobile ? 22 : 36} style={{ color: '#fff', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.85))', zIndex: 1 }} />
                  <div style={{ fontSize: isMobile ? '0.5rem' : '0.6rem', fontWeight: 900, letterSpacing: '0.12em', marginTop: '6px', opacity: 0.95, color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.5)', zIndex: 1 }}>RICH LAND AI</div>
                </div>
              </div>

              {/* Central Live HUD stats under core */}
              <div
                className="war-room-hud-stats"
                style={{
                  marginTop: isMobile ? '3rem' : '7.5rem',
                  background: 'linear-gradient(135deg, rgba(8, 12, 28, 0.7) 0%, rgba(3, 5, 14, 0.9) 100%)',
                  backgroundImage: 'linear-gradient(rgba(189, 29, 45, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(189, 29, 45, 0.035) 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: 'center',
                  backdropFilter: 'blur(25px)',
                  border: '1px solid rgba(189, 29, 45, 0.16)',
                  borderRadius: isMobile ? '12px' : '16px',
                  padding: isMobile ? '0.75rem 1rem' : '1.25rem 1.75rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: isMobile ? '8px' : '12px',
                  textAlign: 'center',
                  width: isMobile ? '300px' : '460px',
                  boxShadow: '0 15px 50px rgba(0, 0, 0, 0.75), 0 0 25px rgba(189, 29, 45, 0.08), inset 0 0 24px rgba(189, 29, 45, 0.04)',
                  position: 'relative',
                  overflow: 'visible'
                }}
              >
                {/* Inner boundary wrapper for scanline to prevent it leaking outside the rounded corners */}
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
                  {/* Active Telemetry Scanline */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: '1.5px',
                      background: 'linear-gradient(90deg, transparent, rgba(189, 29, 45, 0.35), transparent)',
                      boxShadow: '0 0 6px rgba(189, 29, 45, 0.5)',
                      animation: 'scanlineSweep 7s linear infinite',
                      pointerEvents: 'none',
                      zIndex: 10
                    }}
                  />
                </div>

                {/* Advanced Tech Corners */}
                {/* Top Left */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 12, height: 12, borderTop: '2px solid #BD1D2D', borderLeft: '2px solid #BD1D2D', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 4, left: 4, width: 3, height: 3, borderRadius: '50%', background: '#e63946', opacity: 0.8, pointerEvents: 'none' }} />

                {/* Top Right */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderTop: '2px solid #BD1D2D', borderRight: '2px solid #BD1D2D', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 4, right: 4, width: 3, height: 3, borderRadius: '50%', background: '#e63946', opacity: 0.8, pointerEvents: 'none' }} />

                {/* Bottom Left */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: 12, height: 12, borderBottom: '2px solid #BD1D2D', borderLeft: '2px solid #BD1D2D', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 4, width: 3, height: 3, borderRadius: '50%', background: '#e63946', opacity: 0.8, pointerEvents: 'none' }} />

                {/* Bottom Right */}
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderBottom: '2px solid #BD1D2D', borderRight: '2px solid #BD1D2D', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: 4, right: 4, width: 3, height: 3, borderRadius: '50%', background: '#e63946', opacity: 0.8, pointerEvents: 'none' }} />

                {/* Gradient vertical divider lines */}
                <div style={{ position: 'absolute', left: '33.33%', top: '20%', bottom: '20%', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent)' }} />
                <div style={{ position: 'absolute', right: '33.33%', top: '20%', bottom: '20%', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent)' }} />

                {/* Breathing SVG Throughput Wave background with linear gradients */}
                <svg viewBox="0 0 400 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '55px', pointerEvents: 'none', zIndex: -1, opacity: 0.18, borderRadius: '16px' }}>
                  <defs>
                    <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#BD1D2D" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="#e63946" stopOpacity="1" />
                      <stop offset="100%" stopColor="#BD1D2D" stopOpacity="0.2" />
                    </linearGradient>
                    <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  <path d="M 0 50 Q 80 15, 160 45 T 320 50 T 400 35" fill="none" stroke="url(#waveGrad1)" strokeWidth="1.8" style={{ animation: 'waveDrift 10s linear infinite' }} />
                  <path d="M 0 60 Q 90 75, 180 55 T 360 65 T 400 50" fill="none" stroke="url(#waveGrad2)" strokeWidth="1.2" style={{ animation: 'waveDrift2 14s linear infinite' }} />
                </svg>

                <div
                  style={{
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    background: isTotalGlow ? 'linear-gradient(180deg, rgba(189, 29, 45, 0.12) 0%, rgba(189, 29, 45, 0.02) 100%)' : 'transparent',
                    borderRadius: '8px',
                    padding: '8px 0',
                    boxShadow: isTotalGlow ? '0 0 15px rgba(189, 29, 45, 0.25)' : 'none'
                  }}
                >
                  {/* Floating +1 Total bubble */}
                  {totalRipples.map(r => (
                    <div
                      key={r.id}
                      style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: isMobile ? '-14px' : '-20px',
                        background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: 850,
                        boxShadow: '0 0 12px rgba(189, 29, 45, 0.65)',
                        animation: 'floatUpAndFade 1.6s ease-out forwards',
                        zIndex: 20
                      }}
                    >
                      +1
                    </div>
                  ))}
                  <div style={{ fontSize: isMobile ? '0.6rem' : '0.68rem', color: '#e63946', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>TOTAL INGESTED</div>
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontWeight: 800, color: '#e63946', marginTop: 4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span
                      key={displayTotalCounter}
                      style={{
                        display: 'inline-block',
                        animation: 'counterPopTotal 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        textShadow: isTotalGlow ? '0 0 14px rgba(189, 29, 45, 0.95)' : '0 0 6px rgba(189, 29, 45, 0.3)'
                      }}
                    >
                      {displayTotalCounter}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    background: isSharedGlow ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.02) 100%)' : 'transparent',
                    borderRadius: '8px',
                    padding: '8px 0',
                    boxShadow: isSharedGlow ? '0 0 15px rgba(16, 185, 129, 0.25)' : 'none'
                  }}
                >
                  {/* Floating +1 Shared bubble */}
                  {sharedRipples.map(r => (
                    <div
                      key={r.id}
                      style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: isMobile ? '-14px' : '-20px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: 850,
                        boxShadow: '0 0 12px rgba(16,185,129,0.65)',
                        animation: 'floatUpAndFade 1.6s ease-out forwards',
                        zIndex: 20
                      }}
                    >
                      +1
                    </div>
                  ))}
                  <div style={{ fontSize: isMobile ? '0.6rem' : '0.68rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>DISTRIBUTED</div>
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontWeight: 800, color: '#10b981', marginTop: 4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span
                      key={displaySharedCounter}
                      style={{
                        display: 'inline-block',
                        animation: 'counterPopShared 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        textShadow: isSharedGlow ? '0 0 14px rgba(16, 185, 129, 0.95)' : '0 0 6px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {displaySharedCounter}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    background: isRetainedGlow ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.02) 100%)' : 'transparent',
                    borderRadius: '8px',
                    padding: '8px 0',
                    boxShadow: isRetainedGlow ? '0 0 15px rgba(239, 68, 68, 0.25)' : 'none'
                  }}
                >
                  {/* Floating +1 Retained bubble */}
                  {retainedRipples.map(r => (
                    <div
                      key={r.id}
                      style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: isMobile ? '-14px' : '-20px',
                        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: 850,
                        boxShadow: '0 0 12px rgba(239,68,68,0.65)',
                        animation: 'floatUpAndFade 1.6s ease-out forwards',
                        zIndex: 20
                      }}
                    >
                      +1
                    </div>
                  ))}
                  <div style={{ fontSize: isMobile ? '0.6rem' : '0.68rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>RETAINED</div>
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: 4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span
                      key={displayErrorCounter}
                      style={{
                        display: 'inline-block',
                        animation: 'counterPopError 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        textShadow: isRetainedGlow ? '0 0 14px rgba(239, 68, 68, 0.95)' : '0 0 6px rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      {displayErrorCounter}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Console: Active Sales Channels */}
            <div
              className="war-room-right-col"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '0.75rem' : '1.25rem',
                paddingTop: isMobile ? '2.6rem' : (isFocusMode ? '5.5rem' : '1.5rem'),
                transition: 'padding-top 0.35s ease-out'
              }}
            >
              <h3 className="war-room-right-title" style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Users size={isMobile ? 12 : 15} style={{ color: '#BD1D2D' }} /> KÊNH PHÂN PHỐI SALES
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
                {salesList.map((sale: any, idx: number) => {
                  const isGlow = activeSalesGlow[idx];
                  const isPermanentGlow = idx === lastActiveSaleIdx;
                  const channel = consultantChannels[idx] || { name: 'Active', color: '#10b981' };
                  const statusInfo = getSaleStatus(sale);
                  return (
                    <div
                      key={sale.name}
                      ref={el => { saleRefs.current[idx] = el; }}
                      className="war-room-sale-card"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredSummary({
                          type: 'sale',
                          data: { ...sale, channelName: channel.name, channelColor: channel.color },
                          x: rect.left - 290,
                          y: rect.top
                        });
                        setHoveredSaleIdx(idx);
                      }}
                      onMouseLeave={() => {
                        setHoveredSummary(null);
                        setHoveredSaleIdx(null);
                      }}
                      style={{
                        background: isGlow
                          ? `${channel.color}26`
                          : isPermanentGlow
                            ? `${channel.color}0d`
                            : 'rgba(8, 12, 28, 0.45)',
                        backdropFilter: 'blur(25px)',
                        border: isGlow
                          ? `1.8px solid ${channel.color}`
                          : isPermanentGlow
                            ? `1.8px solid ${channel.color}66`
                            : '1.8px solid rgba(255,255,255,0.06)',
                        borderRadius: isMobile ? '10px' : '16px',
                        padding: isMobile ? '0.5rem 0.75rem' : '0.85rem 1.15rem',
                        boxShadow: isGlow
                          ? `0 0 25px ${channel.color}c0, inset 0 0 15px ${channel.color}4d`
                          : isPermanentGlow
                            ? `0 0 15px ${channel.color}40`
                            : '0 10px 40px 0 rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: isMobile ? 8 : 12,
                        position: 'relative',
                        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        overflow: 'hidden',
                        ['--hover-glow' as any]: `${channel.color}45`,
                        ['--hover-border' as any]: channel.color,
                        ['--hover-bg' as any]: `${channel.color}15`
                      }}
                    >
                      {/* Floating +1 Lead bubble */}
                      {isGlow && (
                        <div
                          style={{
                            position: 'absolute',
                            right: '18px',
                            top: '-14px',
                            background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.65rem',
                            fontWeight: 850,
                            boxShadow: '0 0 12px rgba(189, 29, 45, 0.65)',
                            animation: 'floatUpAndFade 1.6s ease-out forwards',
                            zIndex: 20
                          }}
                        >
                          +1 LEAD
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, zIndex: 1 }}>
                        <div style={{ position: 'relative' }}>
                          <Avatar
                            src={sale.avatar}
                            name={sale.name}
                            size={isMobile ? 26 : 34}
                            style={{
                              border: '1.5px solid rgba(255,255,255,0.2)',
                              transition: 'all 0.35s ease'
                            }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: statusInfo.dotColor,
                              border: '1.5px solid #060814',
                              boxShadow: `0 0 6px ${statusInfo.dotColor}`
                            }}
                          />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: isMobile ? '0.75rem' : '0.82rem',
                                fontWeight: 800,
                                color: '#fff',
                                textShadow: isGlow ? `0 0 8px #fff, 0 0 16px ${channel.color}` : 'none',
                                transition: 'text-shadow 0.3s ease',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                                minWidth: 0
                              }}
                            >
                              {sale.name}
                            </div>
                            {isPermanentGlow && (
                              <span style={{
                                width: isMobile ? '6px' : '8px',
                                height: isMobile ? '6px' : '8px',
                                borderRadius: '50%',
                                background: channel.color,
                                boxShadow: `0 0 8px ${channel.color}`,
                                display: 'inline-block',
                                animation: 'vuEqualize 1.4s ease-in-out infinite alternate',
                                flexShrink: 0
                              }} />
                            )}
                          </div>
                          <div style={{ fontSize: isMobile ? '0.6rem' : '0.65rem', marginTop: 2, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%' }}>
                            <span style={{ color: statusInfo.color, fontWeight: 750, flexShrink: 0 }}>
                              {statusInfo.text}
                            </span>
                            {isPermanentGlow && (
                              <span style={{ color: channel.color, marginLeft: 6, fontWeight: 700, fontSize: isMobile ? '0.52rem' : '0.58rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                • {channel.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', zIndex: 1 }}>
                        <div style={{ fontSize: isMobile ? '0.8rem' : '0.92rem', fontWeight: 800, color: '#fff' }}>{(sale.data || 0) + (simulatedLeadsPerSale[sale.name] || 0)} <span style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Lead</span></div>
                        {/* Level VU Meter */}
                        <div style={{ display: 'flex', gap: 2.2, marginTop: 6 }}>
                          {Array.from({ length: 8 }).map((_, segmentIdx) => {
                            const currentLeads = (sale.data || 0) + (simulatedLeadsPerSale[sale.name] || 0);
                            const dynamicPercent = totalLeadsOfAll > 0 ? (currentLeads / totalLeadsOfAll) * 100 : 0;
                            const filledSegments = Math.ceil((dynamicPercent / 100) * 8);
                            const isFilled = segmentIdx < filledSegments;
                            let color = '#3b82f6';

                            // Pulsing equalizer bounce if active/permanent glow
                            const delay = (segmentIdx * 0.08).toFixed(2) + 's';
                            const animatedStyle = isPermanentGlow
                              ? { animation: `vuEqualize 1.4s ease-in-out infinite alternate`, animationDelay: delay }
                              : {};

                            return (
                              <div
                                key={segmentIdx}
                                style={{
                                  width: '5px',
                                  height: '5px',
                                  borderRadius: '1px',
                                  background: isFilled ? (isGlow ? '#ffffff' : color) : 'rgba(255,255,255,0.08)',
                                  boxShadow: isFilled && !isGlow ? `0 0 3px ${color}88` : 'none',
                                  transition: 'background 0.2s',
                                  ...animatedStyle
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cyberpunk System Feed Console (Bottom Terminal) */}
          {!isFocusMode && !isMobile && (
            <div
              className="war-room-bottom-feed"
              style={{
                height: isMobile ? '110px' : '158px',
                borderTop: '1px solid rgba(189, 29, 45, 0.18)',
                background: 'rgba(3, 5, 14, 0.55)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
                padding: isMobile ? '0.4rem 1rem' : '0.6rem 2rem 0.8rem 2rem',
                zIndex: 10,
                position: 'relative',
                boxShadow: '0 -6px 30px rgba(0, 0, 0, 0.45)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 3 : 6 }}>
                <div style={{ fontSize: isMobile ? '0.55rem' : '0.68rem', color: '#e63946', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                  <Terminal size={isMobile ? 10 : 12} /> Live Feed: RICH LAND AI VIRTUAL DISPATCH CONSOLE
                </div>
                <div style={{ fontSize: isMobile ? '0.5rem' : '0.625rem', color: 'rgba(255,255,255,0.3)', display: 'flex', gap: '15px' }}>
                  <span>SECURE CHANNEL: SSLv3</span>
                  <span>QUEUE SIZE: 0</span>
                </div>
              </div>

              <div
                className="war-room-bottom-feed-console"
                style={{
                  flex: 1,
                  overflowY: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '3px' : '6px',
                  padding: isMobile ? '4px 8px' : '6px 12px',
                  background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), rgba(2, 4, 10, 0.82)',
                  backgroundSize: '100% 4px',
                  borderRadius: '8px',
                  border: '1px solid rgba(189, 29, 45, 0.18)',
                  boxShadow: 'inset 0 0 10px rgba(189, 29, 45, 0.08)'
                }}
              >
                {localRecentFeed.slice(0, isMobile ? 3 : 4).map((feed) => {
                  const timeStr = new Date(feed.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  if (feed.system) {
                    return (
                      <div key={feed.id} className="war-room-bottom-feed-line" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: isMobile ? '0.62rem' : '0.72rem', color: '#a78bfa' }}>
                        <span style={{ color: 'rgba(167, 139, 250, 0.4)' }}>[{timeStr}]</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={10} /> [SYSTEM_DAEMON]</span>
                        <span>{feed.msg}</span>
                        <span className="cursor-blink" style={{ width: '4px', height: '10px', background: '#a78bfa', marginLeft: 2 }} />
                      </div>
                    );
                  }

                  const isAssigned = feed.status === 'assigned' || feed.status === 'compensation' || feed.status === 'pending_work_hours' || feed.status === 'reminder';
                  return (
                    <div
                      key={feed.id}
                      className="war-room-bottom-feed-line"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: isMobile ? '0.62rem' : '0.72rem',
                        padding: isMobile ? '1px 3px' : '2px 4px',
                        borderRadius: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: 'rgba(255,255,255,0.25)' }}>[{timeStr}]</span>
                        <span style={{ color: '#3b82f6' }}>&gt; INGESTION:</span>
                        <span>
                          Khách hàng <strong style={{ color: '#fff' }}>{feed.lead_name}</strong>
                        </span>
                        <span style={{
                          fontSize: isMobile ? '0.52rem' : '0.6rem',
                          padding: isMobile ? '1px 3px' : '1.5px 6px',
                          borderRadius: '4px',
                          background: feed.status === 'processing'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : feed.status === 'reminder'
                              ? 'rgba(219, 39, 119, 0.15)'
                              : isAssigned
                                ? 'rgba(189, 29, 45, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                          color: feed.status === 'processing'
                            ? '#fbbf24'
                            : feed.status === 'reminder'
                              ? '#f472b6'
                              : isAssigned
                                ? '#e63946'
                                : '#ef4444',
                          fontWeight: 700,
                          border: `1px solid ${feed.status === 'processing'
                            ? 'rgba(245, 158, 11, 0.25)'
                            : feed.status === 'reminder'
                              ? 'rgba(219, 39, 119, 0.25)'
                              : isAssigned
                                ? 'rgba(189, 29, 45, 0.25)'
                                : 'rgba(239, 68, 68, 0.25)'
                            }`,
                          lineHeight: '1.2'
                        }}>
                          {feed.status === 'processing'
                            ? 'ĐANG ĐÁNH GIÁ...'
                            : feed.status === 'reminder'
                              ? 'NHẮC LẠI'
                              : feed.status === 'assigned'
                                ? 'ĐẠT CHUẨN'
                                : feed.status === 'compensation'
                                  ? 'DATA BÙ'
                                  : feed.status === 'pending_work_hours'
                                    ? 'CHỜ GIỜ LÀM'
                                    : feed.status === 'duplicate'
                                      ? 'TRÙNG LẶP'
                                      : 'DƯỚI CHUẨN'}
                        </span>
                      </div>
                      <div style={{ color: feed.status === 'processing' ? '#fbbf24' : feed.status === 'reminder' ? '#f472b6' : isAssigned ? '#e63946' : '#ef4444', fontWeight: 700 }}>
                        {feed.status === 'processing' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            [VETTING] {"=>"} AI đang đánh giá dữ liệu...
                          </span>
                        ) : isAssigned ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {feed.status === 'reminder' ? '[REMINDER]' : '[OK]'} {"=>"} Phân phối: {feed.assigned_to_name} {feed.status === 'pending_work_hours' && `(${t('Chờ giờ làm')})`}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ShieldAlert size={10} /> [REJECTED] {"=>"} Hệ thống chặn lọc
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Holographic Boot Loader screen overlay */}
      {bootPhase === 'loading' && (
        <div
          className="war-room-loader"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, #090918 0%, #010103 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            fontFamily: 'monospace',
            color: '#e63946',
            overflow: 'hidden'
          }}
        >
          {/* Futuristic grid lines */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%), linear-gradient(90deg, rgba(189, 29, 45, 0.02) 1px, transparent 1px), linear-gradient(rgba(189, 29, 45, 0.02) 1px, transparent 1px)',
            backgroundSize: '100% 4px, 40px 40px, 40px 40px',
            pointerEvents: 'none',
            zIndex: 1
          }} />

          {/* Scanning light line */}
          <div style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(189, 29, 45, 0.3), #ffffff, rgba(189, 29, 45, 0.3), transparent)',
            boxShadow: '0 0 15px 4px rgba(189, 29, 45, 0.5)',
            top: 0,
            animation: 'globalScanLine 6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            zIndex: 10,
            pointerEvents: 'none'
          }} />

          {/* Animated Tech Reactor */}
          <div className="loader-reactor" style={{ position: 'relative', width: 260, height: 260, marginBottom: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            
            {/* Ambient Background Aura */}
            <div style={{
              position: 'absolute',
              width: 320,
              height: 320,
              background: 'radial-gradient(circle, rgba(189, 29, 45, 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'pulseAura 3s ease-in-out infinite',
              pointerEvents: 'none',
              zIndex: 0
            }} />

            {/* Orbiting HUD rings (decorations) */}
            <div style={{
              position: 'absolute',
              width: 250,
              height: 250,
              borderRadius: '50%',
              border: '1px dashed rgba(189, 29, 45, 0.2)',
              animation: 'spinCore 25s linear infinite'
            }} />
            <div style={{
              position: 'absolute',
              width: 230,
              height: 230,
              borderRadius: '50%',
              border: '1px solid rgba(96, 165, 250, 0.15)',
              animation: 'spinCoreInverse 40s linear infinite'
            }} />

            {/* Hexagonal decorative corner lines or notches */}
            <div className="reactor-dots" style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              animation: 'spinCore 12s linear infinite',
              pointerEvents: 'none'
            }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 6,
                  height: 6,
                  background: '#e63946',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px #e63946',
                  top: i % 2 === 0 ? 0 : 'auto',
                  bottom: i % 2 !== 0 ? 0 : 'auto',
                  left: i < 2 ? 0 : 'auto',
                  right: i >= 2 ? 0 : 'auto',
                  transform: 'translate(-50%, -50%)',
                  margin: '50%'
                }} />
              ))}
            </div>

            {/* Main Progress SVG Circle */}
            <svg style={{ position: 'absolute', width: 220, height: 220, transform: 'rotate(-90deg)', zIndex: 2 }}>
              {/* Outer Track Ring */}
              <circle
                cx="110"
                cy="110"
                r="95"
                fill="transparent"
                stroke="rgba(189, 29, 45, 0.1)"
                strokeWidth="4"
              />
              {/* Main Progress Circle */}
              <circle
                cx="110"
                cy="110"
                r="95"
                fill="transparent"
                stroke="url(#reactorGrad)"
                strokeWidth="6"
                strokeDasharray={2 * Math.PI * 95}
                strokeDashoffset={2 * Math.PI * 95 * (1 - bootPercent / 100)}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: 'drop-shadow(0 0 6px rgba(192, 132, 252, 0.8))'
                }}
              />
              {/* Tech details: ticks on the ring */}
              <circle
                cx="110"
                cy="110"
                r="82"
                fill="transparent"
                stroke="rgba(96, 165, 250, 0.2)"
                strokeWidth="2"
                strokeDasharray="4, 8"
                style={{ animation: 'spinCoreInverse 15s linear infinite' }}
              />
              
              {/* Gradients definition */}
              <defs>
                <linearGradient id="reactorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="50%" stopColor="#BD1D2D" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>

            {/* Center Core HUD Panel */}
            <div style={{
              position: 'absolute',
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(10, 11, 30, 0.95) 0%, rgba(2, 4, 12, 0.98) 100%)',
              border: '1.5px solid rgba(189, 29, 45, 0.4)',
              boxShadow: 'inset 0 0 20px rgba(189, 29, 45, 0.3), 0 0 25px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3
            }}>
              {/* Animated scanning bar overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                pointerEvents: 'none'
              }}>
                <div style={{
                  width: '100%',
                  height: '4px',
                  background: 'linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.8), transparent)',
                  boxShadow: '0 0 10px rgba(96, 165, 250, 0.8)',
                  position: 'absolute',
                  top: '0%',
                  animation: 'sweepScanner 2.5s ease-in-out infinite'
                }} />
              </div>

              <Cpu size={36} style={{ color: '#fff', filter: 'drop-shadow(0 0 8px rgba(96, 165, 250, 0.8))', animation: 'pulseGlow 1.8s ease-in-out infinite' }} />
              
              <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#ffffff', marginTop: 8, fontFamily: 'monospace', textShadow: '0 0 12px rgba(189, 29, 45, 0.9)' }}>
                {bootPercent}%
              </div>
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.15em', color: '#e63946', textTransform: 'uppercase', marginTop: 2, fontWeight: 700 }}>
                System Boot
              </div>
            </div>

            {/* Left audio VU meter blocks flanking the core */}
            <div style={{
              position: 'absolute',
              left: -50,
              height: 80,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 4,
              opacity: 0.75
            }}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} style={{
                  width: 12,
                  height: 6,
                  borderRadius: 1,
                  background: bootPercent > idx * 16 ? '#60a5fa' : 'rgba(255,255,255,0.05)',
                  boxShadow: bootPercent > idx * 16 ? '0 0 4px #60a5fa' : 'none',
                  animation: `vuEqualize ${0.6 + idx * 0.15}s ease-in-out infinite alternate`
                }} />
              ))}
            </div>

            {/* Right audio VU meter blocks flanking the core */}
            <div style={{
              position: 'absolute',
              right: -50,
              height: 80,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 4,
              opacity: 0.75
            }}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} style={{
                  width: 12,
                  height: 6,
                  borderRadius: 1,
                  background: bootPercent > idx * 16 ? '#ec4899' : 'rgba(255,255,255,0.05)',
                  boxShadow: bootPercent > idx * 16 ? '0 0 4px #ec4899' : 'none',
                  animation: `vuEqualize ${0.7 + (5 - idx) * 0.12}s ease-in-out infinite alternate`
                }} />
              ))}
            </div>
          </div>

          {/* Title & Loading bar */}
          <div style={{ textAlign: 'center', marginBottom: 15, zIndex: 2 }}>
            <h1 className="loader-title" style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              letterSpacing: '0.25em',
              color: '#ffffff',
              textShadow: '0 0 15px rgba(189, 29, 45, 0.8), 0 0 2px rgba(189, 29, 45, 0.4)',
              margin: 0,
              fontFamily: 'monospace',
              animation: 'glitchText 3s infinite'
            }}>
              NEURAL AI INFINITY INITIALIZING
            </h1>
            <div style={{ fontSize: '0.55rem', letterSpacing: '0.4em', color: 'rgba(96, 165, 250, 0.85)', textTransform: 'uppercase', marginTop: 6, fontWeight: 700, fontFamily: 'monospace' }}>
              COGNITIVE CORE INTEL v4.8.2 // SECURE CONNECTION ESTABLISHED
            </div>
          </div>

          <div className="loader-bar-wrap" style={{ width: 340, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 35, border: '1px solid rgba(189, 29, 45, 0.18)', position: 'relative', zIndex: 2 }}>
            <div style={{ width: `${bootPercent}%`, height: '100%', background: 'linear-gradient(90deg, #60a5fa, #BD1D2D, #ec4899)', boxShadow: '0 0 12px #e63946', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </div>

          {/* Loading logs console */}
          <div style={{
            width: 500,
            background: 'rgba(6, 8, 20, 0.85)',
            border: '1.5px solid rgba(189, 29, 45, 0.35)',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.7), inset 0 0 25px rgba(189, 29, 45, 0.08)',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
            zIndex: 2
          }}>
            {/* Console Window Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 18px',
              background: 'rgba(189, 29, 45, 0.06)',
              borderBottom: '1px solid rgba(189, 29, 45, 0.18)',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', opacity: 0.7 }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', opacity: 0.7 }} />
              </div>
              <div style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.15em',
                color: '#e63946',
                textTransform: 'uppercase',
                fontFamily: 'monospace'
              }}>
                TERMINAL: SYSTEM_BOOT_SEQUENCE
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '0.55rem', color: 'rgba(255, 255, 255, 0.25)', fontFamily: 'monospace' }}>
                T-MINUS {Math.max(0, Math.ceil((100 - bootPercent) / 25))}s
              </div>
            </div>

            {/* Logs area */}
            <div className="loader-console" style={{
              height: 180,
              padding: '18px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              textAlign: 'left',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {bootMessages.map((msg, i) => {
                const isLast = i === bootMessages.length - 1;
                const color = isLast ? '#10b981' : '#e63946';
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: '0.72rem',
                      color: color,
                      opacity: isLast ? 1 : 0.65,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'monospace',
                      textShadow: isLast ? `0 0 8px ${color}` : 'none',
                      transform: isLast ? 'translateX(2px)' : 'none',
                      transition: 'transform 0.2s ease-out'
                    }}
                  >
                    <span style={{ color: isLast ? '#10b981' : '#BD1D2D', fontWeight: 'bold' }}>&gt;</span>
                    <span>{msg}</span>
                    {isLast && <span className="cursor-blink" style={{ width: 6, height: 12, background: '#10b981', display: 'inline-block' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* local bottom-left toaster */}
      <Toaster position="bottom-left" containerStyle={{ bottom: 180, left: 24, zIndex: 999999999 }} toastOptions={{ className: 'custom-toast' }} />

      {/* CSS Styles */}
      <style>{`
        .war-room-source-card {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          cursor: pointer;
        }
        .war-room-source-card:hover {
          transform: translateY(-2px) scale(1.025);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65), 0 0 20px var(--hover-glow) !important;
          border-color: var(--hover-border) !important;
          background: var(--hover-bg) !important;
        }
        .war-room-sale-card {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          cursor: pointer;
        }
        .war-room-sale-card:hover {
          transform: translateY(-2px) scale(1.025);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65), 0 0 20px var(--hover-glow) !important;
          border-color: var(--hover-border) !important;
          background: var(--hover-bg) !important;
        }

        @keyframes borderDotTop {
          0% {
            left: 0%;
            top: -4px;
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translate(0, 0) scale(1.1);
          }
          75% {
            left: 100%;
            top: -4px;
            transform: translate(-100%, 0) scale(1);
          }
          100% {
            left: 100%;
            top: 50%;
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 1;
          }
        }
        @keyframes borderDotBottom {
          0% {
            left: 0%;
            bottom: -4px;
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translate(0, 0) scale(1.1);
          }
          75% {
            left: 100%;
            bottom: -4px;
            transform: translate(-100%, 0) scale(1);
          }
          100% {
            left: 100%;
            bottom: 50%;
            transform: translate(-50%, 50%) scale(1.4);
            opacity: 1;
          }
        }

        @keyframes hudGlitch {
          0%, 100% {
            transform: translate(0, 0) skew(0deg);
            opacity: 1;
            filter: hue-rotate(0deg);
          }
          10% {
            transform: translate(-2px, 1px) skew(-3deg);
            opacity: 0.85;
            filter: hue-rotate(90deg);
          }
          20% {
            transform: translate(2px, -1px) skew(4deg);
            opacity: 0.9;
          }
          30% {
            transform: translate(-1px, -2px) skew(-2deg);
            opacity: 0.8;
            filter: hue-rotate(180deg);
          }
          40% {
            transform: translate(2px, 2px) skew(3deg);
            opacity: 0.95;
          }
          50% {
            transform: translate(-2px, -1px) skew(-4deg);
            opacity: 0.85;
            filter: hue-rotate(270deg);
          }
          60% {
            transform: translate(1px, 2px) skew(2deg);
            opacity: 0.9;
          }
          70% {
            transform: translate(-2px, 1px) skew(-3deg);
            opacity: 0.75;
          }
          80% {
            transform: translate(2px, -2px) skew(4deg);
            opacity: 0.95;
          }
          90% {
            transform: translate(-1px, 1px) skew(-1deg);
            opacity: 0.9;
          }
        }
        .telemetry-glitch-active {
          animation: hudGlitch 0.25s linear infinite;
          color: #f87171 !important;
          text-shadow: 0 0 8px #ef4444, 0 0 15px #ef4444 !important;
        }

        @keyframes spinCore {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCoreInverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes sweepScanner {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes pulseAura {
          0%, 100% { transform: scale(0.95); opacity: 0.15; }
          50% { transform: scale(1.05); opacity: 0.3; }
        }
        @keyframes globalScanLine {
          0% { top: -5%; }
          100% { top: 105%; }
        }
        @keyframes glitchText {
          0%, 95%, 100% { text-shadow: 0 0 15px rgba(189, 29, 45, 0.8); transform: skew(0deg); }
          96% { text-shadow: -2px 0 red, 2px 0 blue, 0 0 15px rgba(189, 29, 45, 0.8); transform: skew(-1deg); }
          97% { text-shadow: 2px 0 red, -2px 0 blue, 0 0 15px rgba(189, 29, 45, 0.8); transform: skew(2deg); }
          98% { text-shadow: -3px 0 green, 3px 0 purple, 0 0 15px rgba(189, 29, 45, 0.8); transform: skew(-2deg); }
          99% { text-shadow: 0 0 15px rgba(189, 29, 45, 0.8); transform: skew(0deg); }
        }
        .cursor-blink {
          animation: blink 1.2s steps(2, start) infinite;
        }
        @keyframes blink {
          to { visibility: hidden; }
        }
        .live-dot-red {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
          display: inline-block;
          animation: pulseRed 2s infinite;
        }
        @keyframes pulseRed {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes floatUpAndFade {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          15% { transform: translateY(-8px) scale(1.1); opacity: 1; }
          100% { transform: translateY(-38px) scale(0.9); opacity: 0; }
        }
        .spin {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        @keyframes scanlineSweep {
          0% { top: 0%; opacity: 0; }
          5% { opacity: 0.15; }
          95% { opacity: 0.15; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes counterPopTotal {
          0% { transform: scale(0.8); filter: brightness(2.5); text-shadow: 0 0 16px rgba(189, 29, 45, 0.95); }
          50% { transform: scale(1.22); filter: brightness(2.5); text-shadow: 0 0 28px rgba(189, 29, 45, 1); }
          100% { transform: scale(1); filter: brightness(1); text-shadow: 0 0 6px rgba(189, 29, 45, 0.3); }
        }
        @keyframes counterPopShared {
          0% { transform: scale(0.8); filter: brightness(2.5); text-shadow: 0 0 16px rgba(16, 185, 129, 0.95); }
          50% { transform: scale(1.22); filter: brightness(2.5); text-shadow: 0 0 28px rgba(16, 185, 129, 1); }
          100% { transform: scale(1); filter: brightness(1); text-shadow: 0 0 6px rgba(16, 185, 129, 0.3); }
        }
        @keyframes counterPopError {
          0% { transform: scale(0.8); filter: brightness(2.5); text-shadow: 0 0 16px rgba(239, 68, 68, 0.95); }
          50% { transform: scale(1.22); filter: brightness(2.5); text-shadow: 0 0 28px rgba(239, 68, 68, 1); }
          100% { transform: scale(1); filter: brightness(1); text-shadow: 0 0 6px rgba(239, 68, 68, 0.3); }
        }
        @keyframes techHeartbeat {
          0%, 100% { opacity: 0.3; transform: scaleY(0.9); }
          50% { opacity: 0.9; transform: scaleY(1.2); }
        }
        @keyframes slideUpFade {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          0% { transform: translateX(-120%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutLeft {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-120%); opacity: 0; }
        }
        @keyframes waveDrift {
          0% { transform: translateX(0); }
          100% { transform: translateX(-40px); }
        }
        @keyframes waveDrift2 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50px); }
        }
        .matrix-column {
          position: absolute;
          top: -100px;
          width: 1.5px;
          height: 90px;
          background: linear-gradient(180deg, transparent, rgba(189, 29, 45, 0.7), #ffffff);
          animation: matrixFall 3s linear infinite;
        }
        @keyframes matrixFall {
          0% { transform: translateY(0); }
          100% { transform: translateY(280px); }
        }
        @keyframes vuEqualize {
          0% { opacity: 0.15; filter: brightness(0.6); }
          50% { opacity: 0.85; filter: brightness(1.1); }
          100% { opacity: 0.35; filter: brightness(0.8); }
        }
        @keyframes eqBounce {
          0% { height: 3px; }
          100% { height: 9px; }
        }
        @keyframes holoDissolve {
          0%, 55% {
            transform: scale(1) skewX(0deg);
            filter: brightness(1) blur(0px) hue-rotate(0deg);
            opacity: 1;
          }
          70% {
            transform: scale(1.02) skewX(1deg);
            filter: brightness(1.4) blur(3px) hue-rotate(10deg);
            opacity: 0.9;
          }
          85% {
            transform: scale(0.97) skewX(-2deg);
            filter: brightness(2.2) blur(8px) hue-rotate(-10deg);
            opacity: 0.55;
          }
          100% {
            transform: scale(0.92);
            filter: brightness(3.5) blur(18px);
            opacity: 0;
          }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 2px rgba(189, 29, 45, 0.3)); }
          50% { opacity: 1; filter: drop-shadow(0 0 10px rgba(189, 29, 45, 0.8)); }
        }

        /* 1. Mobile Portrait Rotation */
        @media (max-width: 768px) and (orientation: portrait) {
          .war-room-container {
            width: 100vh !important;
            height: 100vw !important;
            transform: rotate(90deg) !important;
            transform-origin: top left !important;
            position: fixed !important;
            top: 0 !important;
            left: 100vw !important;
            overflow: hidden !important;
          }
        }

        /* 2. Responsive UI Adjustments for Mobile Landscape View (native or rotated) */
        @media (max-width: 896px) {
          /* Header Controls HUD */
          .war-room-header {
            height: 40px !important;
            padding: 0 0.75rem !important;
          }
          .war-room-header h2 {
            font-size: 0.75rem !important;
          }
          .war-room-header p {
            display: none !important;
          }
          .war-room-header button {
            padding: 3px 6px !important;
            height: 24px !important;
            font-size: 0.6rem !important;
          }
          .war-room-header button svg {
            width: 10px !important;
            height: 10px !important;
          }

          /* Exit Focus Controls */
          .war-room-container button[title="Thoát chế độ tập trung"] {
            padding: 4px 8px !important;
            font-size: 0.65rem !important;
          }
          .war-room-container button[title="Đóng AI Infinity"] {
            width: 24px !important;
            height: 24px !important;
          }

          /* Main layout grid */
          .war-room-grid {
            grid-template-columns: 170px 1fr 185px !important;
            padding: 0.35rem !important;
            gap: 0.5rem !important;
          }

          /* Left Console: Data Ingestion Systems */
          .war-room-left-col {
            gap: 0.35rem !important;
            padding-bottom: 1.5rem !important;
          }
          .war-room-left-title {
            font-size: 0.6rem !important;
            gap: 3px !important;
            margin-bottom: 2px !important;
          }
          .war-room-left-title svg {
            width: 10px !important;
            height: 10px !important;
          }
          .war-room-left-col > div {
            gap: 5px !important;
          }
          .war-room-source-card {
            padding: 0.3rem 0.5rem !important;
            border-radius: 8px !important;
            gap: 5px !important;
          }
          .war-room-source-card > div:nth-child(2) > div:first-child {
            width: 20px !important;
            height: 20px !important;
            border-radius: 4px !important;
          }
          .war-room-source-card > div:nth-child(2) > div:first-child svg {
            width: 10px !important;
            height: 10px !important;
          }
          .war-room-source-card span {
            font-size: 0.6rem !important;
          }
          .war-room-source-card > div:nth-child(2) > div:last-child > span:first-child {
            font-size: 0.6rem !important;
          }
          .war-room-source-card > div:nth-child(2) > div:last-child > span:last-child {
            font-size: 0.52rem !important;
          }
          .war-room-source-card > div:last-child > span:last-child {
            font-size: 0.52rem !important;
          }
          .war-room-source-card > div:last-child > span:first-child {
            width: 4px !important;
            height: 4px !important;
          }

          .war-room-center-col {
            justify-content: flex-start !important;
            padding-bottom: 1.5rem !important;
          }
          .war-room-center-col > div:nth-child(1),
          .war-room-center-col > div:nth-child(2) {
            display: none !important; /* Hide giant accent outline rings */
          }
          .war-room-core-outer {
            transform: scale(0.8) !important;
            margin-top: 0px !important;
            margin-bottom: 0px !important;
          }
          .war-room-hud-stats {
            margin-top: 1.2rem !important;
            width: 260px !important;
            padding: 0.35rem 0.5rem !important;
            gap: 6px !important;
            border-radius: 10px !important;
          }
          .war-room-hud-stats > div {
            padding: 2px 0 !important;
          }
          .war-room-hud-stats > div > div:nth-last-child(2) {
            font-size: 0.5rem !important;
            letter-spacing: 0.02em !important;
          }
          .war-room-hud-stats > div > div:last-child {
            font-size: 1.25rem !important;
            margin-top: 2px !important;
          }

          /* Right Console: Active Sales Channels */
          .war-room-right-col {
            gap: 0.35rem !important;
            padding-bottom: 1.5rem !important;
          }
          .war-room-right-title {
            font-size: 0.6rem !important;
            gap: 3px !important;
            margin-bottom: 2px !important;
          }
          .war-room-right-title svg {
            width: 10px !important;
            height: 10px !important;
          }
          .war-room-right-col > div {
            gap: 5px !important;
          }
          .war-room-sale-card {
            padding: 0.3rem 0.5rem !important;
            border-radius: 8px !important;
            gap: 6px !important;
          }
          .war-room-sale-card [class*="avatar"] {
            width: 20px !important;
            height: 20px !important;
            font-size: 8px !important;
          }
          .war-room-sale-card div > div:first-child > span {
            width: 5px !important;
            height: 5px !important;
            bottom: -1px !important;
            right: -1px !important;
          }
          .war-room-sale-card div div div div {
            font-size: 0.52rem !important;
          }
          .war-room-sale-card div > div:last-child > span {
            font-size: 0.5rem !important;
          }
          .war-room-sale-card > div:last-child > div:first-child {
            font-size: 0.65rem !important;
          }
          .war-room-sale-card > div:last-child > div:first-child span {
            font-size: 0.48rem !important;
          }
          .war-room-sale-card > div:last-child > div:last-child {
            margin-top: 2px !important;
            gap: 1.2px !important;
          }
          .war-room-sale-card > div:last-child > div:last-child > div {
            width: 3.5px !important;
            height: 3.5px !important;
          }

          /* Cyberpunk System Feed Console (Bottom Terminal) */
          .war-room-bottom-feed {
            display: none !important;
          }
          .war-room-bottom-feed-console {
            padding: 4px 8px !important;
            gap: 2px !important;
            border-radius: 6px !important;
          }
          .war-room-bottom-feed-line {
            font-size: 0.62rem !important;
            gap: 6px !important;
          }
          .war-room-bottom-feed-line span {
            font-size: 0.62rem !important;
          }

          /* Loader optimizations */
          .loader-reactor {
            width: 130px !important;
            height: 130px !important;
            margin-bottom: 12px !important;
          }
          .loader-reactor svg {
            width: 22px !important;
            height: 22px !important;
          }
          .loader-reactor div {
            font-size: 1.2rem !important;
            margin-top: 4px !important;
          }
          .loader-title {
            font-size: 1.05rem !important;
            margin-bottom: 2px !important;
            letter-spacing: 0.12em !important;
          }
          .loader-bar-wrap {
            width: 220px !important;
            margin-bottom: 15px !important;
          }
          .loader-console {
            width: 380px !important;
            height: 100px !important;
            padding: 8px 12px !important;
            gap: 4px !important;
          }
          .loader-console div {
            font-size: 0.62rem !important;
          }
        }
      `}</style>

      {/* Date settings modal overlay */}
      {isDateModalOpen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(2, 4, 10, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
        }}>
          <div style={{
            background: 'rgba(8, 12, 28, 0.95)',
            border: '1px solid rgba(189, 29, 45, 0.45)',
            borderRadius: '20px',
            padding: '2rem',
            width: '600px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(189, 29, 45, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            fontFamily: 'monospace',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(189, 29, 45, 0.25)', paddingBottom: '10px' }}>
              <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800 }}>{t('CÀI ĐẶT THỜI GIAN MÔ PHỎNG')}</h3>
              <button
                onClick={() => setIsDateModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#e63946', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Selector */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <button
                onClick={() => setTempDateMode('preset')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: tempDateMode === 'preset' ? '1px solid rgba(189, 29, 45, 0.5)' : '1px solid transparent',
                  background: tempDateMode === 'preset' ? 'rgba(189, 29, 45, 0.15)' : 'transparent',
                  color: tempDateMode === 'preset' ? '#f45b69' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('Mặc định')}
              </button>
              <button
                onClick={() => setTempDateMode('single')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: tempDateMode === 'single' ? '1px solid rgba(189, 29, 45, 0.5)' : '1px solid transparent',
                  background: tempDateMode === 'single' ? 'rgba(189, 29, 45, 0.15)' : 'transparent',
                  color: tempDateMode === 'single' ? '#f45b69' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('Một ngày')}
              </button>
              <button
                onClick={() => setTempDateMode('range')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: tempDateMode === 'range' ? '1px solid rgba(189, 29, 45, 0.5)' : '1px solid transparent',
                  background: tempDateMode === 'range' ? 'rgba(189, 29, 45, 0.15)' : 'transparent',
                  color: tempDateMode === 'range' ? '#f45b69' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('Khoảng ngày')}
              </button>
            </div>

            {/* Tab Contents */}
            <div style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {tempDateMode === 'preset' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {['Hôm nay', 'Hôm qua', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setTempPreset(preset)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '6px',
                        border: tempPreset === preset ? '1.2px solid #BD1D2D' : '1px solid rgba(255,255,255,0.06)',
                        background: tempPreset === preset ? 'rgba(189, 29, 45, 0.1)' : 'rgba(255,255,255,0.02)',
                        color: tempPreset === preset ? '#ffffff' : 'rgba(255,255,255,0.7)',
                        fontSize: '0.95rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {preset === 'Hôm nay' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            boxShadow: '0 0 10px #ef4444',
                            display: 'inline-block',
                            animation: 'pulseGlow 2s ease-in-out infinite'
                          }} />
                          {t(preset)}
                        </span>
                      ) : (
                        t(preset)
                      )}
                    </button>
                  ))}
                </div>
              )}

              {tempDateMode === 'single' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{t('Chọn ngày nhập cụ thể')}</label>
                  <input
                    type="date"
                    value={tempSingleDate}
                    onChange={(e) => setTempSingleDate(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(189, 29, 45, 0.45)',
                      background: 'rgba(5, 7, 18, 0.85)',
                      color: '#fff',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxShadow: '0 0 10px rgba(189, 29, 45, 0.1)',
                    }}
                  />
                </div>
              )}

              {tempDateMode === 'range' && (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{t('Từ ngày')}</label>
                    <input
                      type="date"
                      value={tempStartDate}
                      onChange={(e) => setTempStartDate(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(189, 29, 45, 0.45)',
                        background: 'rgba(5, 7, 18, 0.85)',
                        color: '#fff',
                        fontSize: '0.95rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{t('Đến ngày')}</label>
                    <input
                      type="date"
                      value={tempEndDate}
                      onChange={(e) => setTempEndDate(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(189, 29, 45, 0.45)',
                        background: 'rgba(5, 7, 18, 0.85)',
                        color: '#fff',
                        fontSize: '0.95rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setIsDateModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('Hủy')}
              </button>
              <button
                onClick={handleApplyDate}
                style={{
                  flex: 2,
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(189, 29, 45, 0.35)',
                }}
              >
                {t('Áp dụng')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Telemetry Hover summary popover */}
      {hoveredSummary && (() => {
        const color = hoveredSummary.type === 'source' ? hoveredSummary.data.color : hoveredSummary.data.channelColor;
        
        let details = null;
        if (hoveredSummary.type === 'source') {
          const sourceName = hoveredSummary.data.name;
          // Filter logs matching this source to calculate real counts
          const sourceLogs = currentActiveLogs.filter((log: any) => {
            const logSource = log.source || log.type || 'Nhập tay';
            return logSource === sourceName;
          });
          const totalLogs = sourceLogs.length;
          
          const distributed = sourceLogs.filter((log: any) => 
            log.status === 'assigned' || 
            log.status === 'compensation' || 
            log.status === 'pending_work_hours' || 
            log.status === 'reminder'
          ).length;
          
          const duplicates = sourceLogs.filter((log: any) => 
            log.status === 'duplicate' || 
            log.status === 'duplicate_reassigned'
          ).length;
          
          const errors = sourceLogs.filter((log: any) => 
            log.status === 'rejected' || 
            log.status === 'error'
          ).length;

          // If currentActiveLogs has 0 items (e.g. no logs parsed yet), fallback gracefully to props count
          const realTotal = totalLogs > 0 ? totalLogs : hoveredSummary.data.count;
          const realDistributed = totalLogs > 0 ? distributed : hoveredSummary.data.count;
          
          details = (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Trạng thái:</span>
                <span style={{ color: color, fontWeight: 700 }}>
                  {hoveredSummary.data.ping === 'Sync' ? 'Sheets Syncing' : 'API Active'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Số lead tổng:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{realTotal} Leads</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Đã chia:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{realDistributed} Leads</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Trùng:</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{duplicates} Leads</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Lỗi:</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{errors} Leads</span>
              </div>
            </>
          );
        } else {
          // For Sales Rep
          const saleName = hoveredSummary.data.name;
          const saleLogs = currentActiveLogs.filter((log: any) => log.assigned_to_name === saleName);
          const totalSaleLogs = saleLogs.length;

          const leadNhan = saleLogs.filter((log: any) => 
            log.status === 'assigned' || 
            log.status === 'compensation'
          ).length;

          const nhacLai = saleLogs.filter((log: any) => 
            log.status === 'reminder' || 
            log.status === 'duplicate'
          ).length;

          const errors = saleLogs.filter((log: any) => 
            log.status === 'error' || 
            log.status === 'rejected'
          ).length;

          const leadsCount = hoveredSummary.data.data + (simulatedLeadsPerSale[saleName] || 0);
          
          const currentStats = todayStats || stats;
          const errorStatItem = currentStats?.errorStats?.find((e: any) => e.name === saleName);
          const fallbackErrors = errorStatItem ? errorStatItem.errors : 0;

          const displayLeadNhan = totalSaleLogs > 0 ? leadNhan : leadsCount;
          const displayNhacLai = totalSaleLogs > 0 ? nhacLai : 0;
          const displayErrors = totalSaleLogs > 0 ? errors : fallbackErrors;

          const isWorking = isCurrentlyWorking(hoveredSummary.data);
          const statusText = isWorking ? 'Active' : 'Inactive';
          const statusColor = isWorking ? '#10b981' : '#f59e0b';

          details = (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Hoạt động:</span>
                <span style={{ color: statusColor, fontWeight: 700 }}>
                  {statusText}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Số lead đã nhận:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{displayLeadNhan} Leads</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Nhắc lại:</span>
                <span style={{ color: '#3b82f6', fontWeight: 700 }}>{displayNhacLai} Leads</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Ticket/Lỗi:</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{displayErrors} Leads</span>
              </div>
            </>
          );
        }

        return (
          <div
            style={{
              position: 'absolute',
              left: hoveredSummary.x,
              top: hoveredSummary.y,
              width: '270px',
              background: 'rgba(5, 7, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              border: `1.5px solid ${color}`,
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: `0 15px 35px rgba(0, 0, 0, 0.7), 0 0 20px ${color}25`,
              zIndex: 999999,
              pointerEvents: 'none',
              fontFamily: 'monospace',
              animation: 'slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            {/* Tech crosshair corners */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 6, height: 6, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: 6, height: 6, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 6, height: 6, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` }} />

            {/* Header */}
            <div style={{ borderBottom: `1px solid rgba(255, 255, 255, 0.1)`, paddingBottom: '8px', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.6rem', color: color, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {hoveredSummary.type === 'source' ? 'INGESTION SOURCE TELEMETRY' : 'CONSULTANT AGENT PREVIEW'}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', marginTop: '3px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {hoveredSummary.data.name}
              </div>
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem' }}>
              {details}
            </div>
          </div>
        );
      })()}
    </div>,
    document.body
  );
};
