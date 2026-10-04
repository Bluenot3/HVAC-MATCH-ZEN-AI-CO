import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Technician, ServiceTicket, UrgencyLevel } from '../../types/dispatch';
import { HVAC_DEPOTS } from '../../data/hvacData';
import { soundFx } from '../../services/soundFx';
import { ZenLogo } from '../brand/ZenLogo';
import { 
  Truck, 
  Flame, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  Building2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  Eye, 
  Activity, 
  Zap, 
  Crosshair, 
  Navigation, 
  Volume2, 
  VolumeX, 
  Maximize2,
  Minimize2,
  Sparkles,
  MapPin,
  Compass,
  ArrowRight,
  Shield,
  ThermometerSun,
  Radio
} from 'lucide-react';

export type MapThemeMode = 'cyber' | 'blueprint' | 'clean';

interface TacticalTerritoryCanvasProps {
  technicians: Technician[];
  tickets: ServiceTicket[];
  filteredTickets: ServiceTicket[];
  selectedTechId: string | null;
  onSelectTech: (id: string | null) => void;
  selectedTicketId: string | null;
  onSelectTicket: (id: string | null) => void;
  showDepots: boolean;
  showVehicles: boolean;
  showRoutes: boolean;
  activeInfoWindow: {
    type: 'TICKET' | 'TECH' | 'DEPOT';
    id: string;
    position: { lat: number; lng: number };
  } | null;
  setActiveInfoWindow: (info: any) => void;
  onAssignTicketToTech?: (ticketId: string, techId: string) => void;
}

// Bounding box for DFW Metroplex (Lat: 32.55 to 33.18, Lng: -97.46 to -96.62)
const DFW_BOUNDS = {
  minLat: 32.55,
  maxLat: 33.18,
  minLng: -97.46,
  maxLng: -96.62,
};

export const TacticalTerritoryCanvas: React.FC<TacticalTerritoryCanvasProps> = ({
  technicians,
  tickets,
  filteredTickets,
  selectedTechId,
  onSelectTech,
  selectedTicketId,
  onSelectTicket,
  showDepots,
  showVehicles,
  showRoutes,
  activeInfoWindow,
  setActiveInfoWindow,
  onAssignTicketToTech,
}) => {
  // Visual Mode and Tactical Toggles
  const [themeMode, setThemeMode] = useState<MapThemeMode>('cyber');
  const [is3dMode, setIs3dMode] = useState<boolean>(false);
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showHighwayFlow, setShowHighwayFlow] = useState<boolean>(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(soundFx.isEnabled());

  // Vector Pan and Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Active target for HUD lock-on card
  const selectedTech = technicians.find((t) => t.id === selectedTechId) || null;
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  // Convert lat/lng to percentage coordinates (0% to 100%)
  const projectCoords = (lat: number, lng: number) => {
    const x = ((lng - DFW_BOUNDS.minLng) / (DFW_BOUNDS.maxLng - DFW_BOUNDS.minLng)) * 100;
    const y = ((DFW_BOUNDS.maxLat - lat) / (DFW_BOUNDS.maxLat - DFW_BOUNDS.minLat)) * 100;
    return { x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) };
  };

  // Drag and touch gestures for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - panOffset.x, y: e.touches[0].clientY - panOffset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPanOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    soundFx.playSelectBlip();
  };

  const toggleAudio = () => {
    const next = !isAudioEnabled;
    setIsAudioEnabled(next);
    soundFx.setEnabled(next);
    if (next) soundFx.playConfirm();
  };

  // Periodic subtle radar ping if audio enabled and radar active
  useEffect(() => {
    if (!isAudioEnabled || !showRadar) return;
    const interval = setInterval(() => {
      soundFx.playRadarPing();
    }, 8000);
    return () => clearInterval(interval);
  }, [isAudioEnabled, showRadar]);

  // Compute Heading angle for vehicles based on next stop location
  const computeVehicleHeading = (tech: Technician): number => {
    if (tech.assignedTicketIds && tech.assignedTicketIds.length > 0) {
      const nextTicketId = tech.assignedTicketIds[0];
      const targetTicket = tickets.find((t) => t.id === nextTicketId);
      if (targetTicket) {
        const dLng = targetTicket.location.lng - tech.currentLocation.lng;
        const dLat = targetTicket.location.lat - tech.currentLocation.lat;
        // Invert dLat because SVG Y goes downward
        const rad = Math.atan2(-dLat, dLng);
        let deg = (rad * 180) / Math.PI;
        return (deg + 360) % 360;
      }
    }
    // Default heading based on van index
    return (parseInt(tech.id.replace('tech-', ''), 10) * 45) % 360;
  };

  // Speed and simulated status tag per vehicle
  const getVehicleSpeedTag = (tech: Technician) => {
    if (tech.status === 'ON_SITE') return 'ON-SITE DIAGNOSTIC';
    if (tech.status === 'RETURNING_DEPOT') return '44 MPH • RETURNING';
    if (tech.status === 'EN_ROUTE') {
      const speed = 48 + (parseInt(tech.id.replace('tech-', ''), 10) % 15);
      return `${speed} MPH • TRANSIT`;
    }
    return 'STANDBY';
  };

  // Background and styling tokens based on themeMode
  const theme = useMemo(() => {
    if (themeMode === 'cyber') {
      return {
        bg: 'bg-[#070B14]',
        gridColor: 'rgba(56, 189, 248, 0.08)',
        highwayPrimary: '#38BDF8',
        highwaySecondary: '#1E293B',
        highwayPulse: '#06B6D4',
        lakeFill: 'url(#cyberLakeGrad)',
        lakeStroke: '#0284C7',
        textMuted: 'text-slate-400',
        textAccent: 'text-cyan-400',
        hudBg: 'bg-slate-900/90 border-slate-700/80 text-white',
        radarBeam: 'from-cyan-500/25 via-cyan-500/5 to-transparent',
      };
    }
    if (themeMode === 'blueprint') {
      return {
        bg: 'bg-[#0B1E3B]',
        gridColor: 'rgba(96, 165, 250, 0.12)',
        highwayPrimary: '#60A5FA',
        highwaySecondary: '#1E3A8A',
        highwayPulse: '#93C5FD',
        lakeFill: 'url(#blueprintLakeGrad)',
        lakeStroke: '#3B82F6',
        textMuted: 'text-blue-300',
        textAccent: 'text-blue-200',
        hudBg: 'bg-[#0E2A52]/90 border-blue-600/50 text-white',
        radarBeam: 'from-blue-400/20 via-blue-400/5 to-transparent',
      };
    }
    // Clean daylight mode
    return {
      bg: 'bg-slate-100',
      gridColor: 'rgba(148, 163, 184, 0.15)',
      highwayPrimary: '#94A3B8',
      highwaySecondary: '#CBD5E1',
      highwayPulse: '#2563EB',
      lakeFill: 'url(#cleanLakeGrad)',
      lakeStroke: '#93C5FD',
      textMuted: 'text-slate-500',
      textAccent: 'text-blue-600',
      hudBg: 'bg-white/95 border-slate-200 text-slate-900',
      radarBeam: 'from-blue-600/15 via-blue-600/5 to-transparent',
    };
  }, [themeMode]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`w-full h-full relative overflow-hidden transition-colors duration-300 ${theme.bg} cursor-${
        isDragging ? 'grabbing' : 'grab'
      } ${is3dMode ? 'tactical-3d-stage' : ''}`}
    >
      {/* Dynamic Background SVG Canvas & Cartography */}
      <div
        className={`absolute inset-0 transition-transform duration-75 origin-center ${
          is3dMode ? 'tactical-3d-plane' : ''
        }`}
        style={{
          transform: is3dMode
            ? `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel}) rotateX(24deg) rotateZ(-3deg)`
            : `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          width: '100%',
          height: '100%',
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Cyber Lake Gradient */}
            <linearGradient id="cyberLakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#082F49" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0369A1" stopOpacity="0.6" />
            </linearGradient>

            {/* Blueprint Lake Gradient */}
            <linearGradient id="blueprintLakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.5" />
            </linearGradient>

            {/* Clean Lake Gradient */}
            <linearGradient id="cleanLakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.7" />
            </linearGradient>

            {/* Neon Glow Filters */}
            <filter id="neonCorridorGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.4" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Grid Pattern */}
            <pattern id="tacticalGridPattern" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke={theme.gridColor} strokeWidth="0.1" />
            </pattern>
          </defs>

          {/* Coordinate Mesh Grid */}
          <rect width="100" height="100" fill="url(#tacticalGridPattern)" />

          {/* Concentric Telemetry Range Rings */}
          <circle cx="50" cy="50" r="18" fill="none" stroke={theme.gridColor} strokeWidth="0.25" strokeDasharray="1,2" />
          <circle cx="50" cy="50" r="34" fill="none" stroke={theme.gridColor} strokeWidth="0.25" strokeDasharray="1,3" />
          <circle cx="50" cy="50" r="48" fill="none" stroke={theme.gridColor} strokeWidth="0.25" strokeDasharray="1,4" />

          {/* DFW Reservoirs & Lakes (Accurately Placed Geometries) */}
          {/* Lake Lewisville (North DFW) */}
          <path
            d="M 36 12 Q 44 8 48 15 Q 46 22 41 24 Q 35 22 36 12 Z"
            fill={theme.lakeFill}
            stroke={theme.lakeStroke}
            strokeWidth="0.3"
          />
          {/* Grapevine Lake (Northwest) */}
          <path
            d="M 26 22 Q 33 18 35 25 Q 31 30 25 28 Q 23 25 26 22 Z"
            fill={theme.lakeFill}
            stroke={theme.lakeStroke}
            strokeWidth="0.3"
          />
          {/* Lake Ray Hubbard (East Dallas) */}
          <path
            d="M 84 32 Q 92 36 89 50 Q 82 48 83 40 Q 81 35 84 32 Z"
            fill={theme.lakeFill}
            stroke={theme.lakeStroke}
            strokeWidth="0.3"
          />
          {/* Joe Pool Lake (South Grand Prairie) */}
          <path
            d="M 45 68 Q 50 64 51 76 Q 47 80 44 75 Z"
            fill={theme.lakeFill}
            stroke={theme.lakeStroke}
            strokeWidth="0.3"
          />
          {/* Mountain Creek Lake */}
          <ellipse cx="50" cy="60" rx="3.5" ry="2.5" fill={theme.lakeFill} stroke={theme.lakeStroke} strokeWidth="0.25" />
          {/* Benbrook Lake (Fort Worth South) */}
          <ellipse cx="14" cy="68" rx="4" ry="3" fill={theme.lakeFill} stroke={theme.lakeStroke} strokeWidth="0.25" />
          {/* White Rock Lake (Dallas East) */}
          <ellipse cx="73" cy="45" rx="2.5" ry="4" fill={theme.lakeFill} stroke={theme.lakeStroke} strokeWidth="0.25" />

          {/* Trinity River Corridor (Connecting Fort Worth to Dallas) */}
          <path
            d="M 18 55 Q 35 52 48 50 Q 60 52 70 65 Q 85 78 95 85"
            stroke={themeMode === 'cyber' ? '#0369A1' : '#93C5FD'}
            strokeWidth="0.4"
            fill="none"
            opacity="0.6"
            strokeDasharray="1.5,1"
          />

          {/* Heatmap Layer (Dynamic Summer HVAC Heat & High Distress Density) */}
          {showHeatmap && (
            <g opacity="0.45" className="animate-fadeIn">
              {/* Downtown Dallas High Heat Island */}
              <circle cx="68" cy="50" r="14" fill="url(#heatGradientDallas)" />
              {/* Fort Worth Industrial Corridor Heat Island */}
              <circle cx="22" cy="54" r="12" fill="url(#heatGradientFtWorth)" />
              {/* Plano / Frisco Rooftop Chiller Load Zone */}
              <circle cx="66" cy="18" r="10" fill="url(#heatGradientPlano)" />
              {/* Arlington Mid-Cities Heat Zone */}
              <circle cx="44" cy="56" r="11" fill="url(#heatGradientArlington)" />

              <defs>
                <radialGradient id="heatGradientDallas">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heatGradientFtWorth">
                  <stop offset="0%" stopColor="#F97316" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#FBBF24" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heatGradientPlano">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heatGradientArlington">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                </radialGradient>
              </defs>
            </g>
          )}

          {/* DFW Regional Interstate & Expressway Arterial Network */}
          {/* I-35W (Fort Worth North-South Corridor) */}
          <path
            d="M 25 3 L 24 38 L 22 75 L 23 97"
            stroke={theme.highwaySecondary}
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M 25 3 L 24 38 L 22 75 L 23 97"
            stroke={theme.highwayPrimary}
            strokeWidth="0.8"
            fill="none"
            filter={themeMode === 'cyber' ? 'url(#neonCorridorGlow)' : undefined}
          />
          {showHighwayFlow && (
            <path
              d="M 25 3 L 24 38 L 22 75 L 23 97"
              stroke={theme.highwayPulse}
              strokeWidth="1"
              strokeDasharray="4, 18"
              fill="none"
              className="animate-zen-traffic"
            />
          )}

          {/* I-35E (Dallas North-South Corridor) */}
          <path
            d="M 58 3 L 64 35 L 68 52 L 67 97"
            stroke={theme.highwaySecondary}
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M 58 3 L 64 35 L 68 52 L 67 97"
            stroke={theme.highwayPrimary}
            strokeWidth="0.8"
            fill="none"
            filter={themeMode === 'cyber' ? 'url(#neonCorridorGlow)' : undefined}
          />
          {showHighwayFlow && (
            <path
              d="M 58 3 L 64 35 L 68 52 L 67 97"
              stroke={theme.highwayPulse}
              strokeWidth="1"
              strokeDasharray="4, 18"
              fill="none"
              className="animate-zen-traffic"
            />
          )}

          {/* I-30 (East-West Connection: Fort Worth -> Arlington -> Dallas) */}
          <path
            d="M 3 58 Q 45 54 97 51"
            stroke={theme.highwaySecondary}
            strokeWidth="1.8"
            fill="none"
          />
          <path
            d="M 3 58 Q 45 54 97 51"
            stroke={theme.highwayPrimary}
            strokeWidth="0.9"
            fill="none"
            filter={themeMode === 'cyber' ? 'url(#neonCorridorGlow)' : undefined}
          />
          {showHighwayFlow && (
            <path
              d="M 3 58 Q 45 54 97 51"
              stroke={theme.highwayPulse}
              strokeWidth="1.2"
              strokeDasharray="5, 20"
              fill="none"
              className="animate-zen-traffic"
            />
          )}

          {/* I-635 / LBJ Freeway Loop */}
          <path
            d="M 44 28 Q 72 23 84 38 Q 82 56 68 64 Q 46 62 44 28"
            stroke={theme.highwaySecondary}
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M 44 28 Q 72 23 84 38 Q 82 56 68 64 Q 46 62 44 28"
            stroke={theme.highwayPrimary}
            strokeWidth="0.6"
            fill="none"
          />

          {/* President George Bush Turnpike (PGBT Loop) */}
          <path
            d="M 35 18 Q 66 12 85 26 Q 91 46 86 68"
            stroke={theme.highwaySecondary}
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M 35 18 Q 66 12 85 26 Q 91 46 86 68"
            stroke={theme.highwayPrimary}
            strokeWidth="0.6"
            fill="none"
            strokeDasharray="2,1"
          />

          {/* SH-183 / SH-114 Airport Freeway */}
          <path
            d="M 22 52 L 48 38 L 68 49"
            stroke={theme.highwaySecondary}
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M 22 52 L 48 38 L 68 49"
            stroke={theme.highwayPrimary}
            strokeWidth="0.6"
            fill="none"
          />

          {/* Dallas North Tollway (DNT) */}
          <path
            d="M 67 4 L 67 48"
            stroke={theme.highwaySecondary}
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M 67 4 L 67 48"
            stroke={theme.highwayPrimary}
            strokeWidth="0.6"
            fill="none"
            strokeDasharray="3,1"
          />

          {/* DFW International Airport Runways Vector Crosshair */}
          <g opacity={themeMode === 'cyber' ? 0.7 : 0.4}>
            <rect x="44" y="32" width="6" height="12" fill="none" stroke={theme.highwayPrimary} strokeWidth="0.3" strokeDasharray="1,1" />
            <line x1="45.5" y1="33" x2="45.5" y2="43" stroke={theme.highwayPulse} strokeWidth="0.5" />
            <line x1="48.5" y1="33" x2="48.5" y2="43" stroke={theme.highwayPulse} strokeWidth="0.5" />
          </g>

          {/* Live Dynamic Multi-Stop Route Ribbons */}
          {showRoutes &&
            technicians.map((tech) => {
              const isSelected = selectedTechId === tech.id;
              const techTickets = tickets
                .filter((t) => tech.assignedTicketIds && tech.assignedTicketIds.includes(t.id))
                .sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0));

              if (techTickets.length === 0) return null;
              if (selectedTechId && !isSelected) return null;

              const techPos = projectCoords(tech.currentLocation.lat, tech.currentLocation.lng);
              const depotPos = projectCoords(tech.depotLocation.lat, tech.depotLocation.lng);

              let pathD = `M ${techPos.x} ${techPos.y}`;
              techTickets.forEach((t) => {
                const tPos = projectCoords(t.location.lat, t.location.lng);
                pathD += ` L ${tPos.x} ${tPos.y}`;
              });
              pathD += ` L ${depotPos.x} ${depotPos.y}`;

              return (
                <g key={`route-${tech.id}`}>
                  {/* Route ribbon glow background */}
                  <path
                    d={pathD}
                    stroke={tech.color || '#38BDF8'}
                    strokeWidth={isSelected ? '3.5' : '1.4'}
                    strokeOpacity={isSelected ? 0.35 : 0.15}
                    fill="none"
                  />
                  {/* Core sharp route ribbon with animated dashes */}
                  <path
                    d={pathD}
                    stroke={tech.color || '#38BDF8'}
                    strokeWidth={isSelected ? '2' : '1'}
                    strokeOpacity={isSelected ? 0.95 : 0.55}
                    strokeDasharray={isSelected ? '4,2' : '2,2'}
                    fill="none"
                    className={isSelected ? 'animate-zen-flow' : undefined}
                  />
                </g>
              );
            })}
        </svg>

        {/* 360-Degree Sweeping Tactical Radar Beam */}
        {showRadar && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
            <div
              className={`w-[140%] h-[140%] rounded-full bg-gradient-to-tr ${theme.radarBeam} animate-zen-radar-spin`}
              style={{
                clipPath: 'polygon(50% 50%, 100% 50%, 100% 0%, 50% 0%)',
              }}
            />
          </div>
        )}

        {/* Tactical Geographic Landmarks & Zones */}
        <div className="absolute top-[6%] left-[62%] pointer-events-none select-none">
          <div className="text-[10px] font-black tracking-widest text-slate-400/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70" />
            <span>PLANO / FRISCO TECH</span>
          </div>
        </div>

        <div className="absolute top-[48%] left-[68%] pointer-events-none select-none">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <div className="text-[11px] font-black tracking-widest text-slate-300">
              DALLAS METRO CORE
            </div>
          </div>
        </div>

        <div className="absolute top-[54%] left-[17%] pointer-events-none select-none">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <div className="text-[11px] font-black tracking-widest text-slate-300">
              FORT WORTH INDUSTRIAL
            </div>
          </div>
        </div>

        <div className="absolute top-[57%] left-[43%] pointer-events-none select-none">
          <div className="text-[9px] font-extrabold tracking-wider text-slate-400">
            ARLINGTON / MID-CITIES
          </div>
        </div>

        <div className="absolute top-[34%] left-[44%] pointer-events-none select-none">
          <div className="text-[9px] font-extrabold tracking-wider text-cyan-400/90 flex items-center gap-1">
            <span>✈ DFW AIRPORT LOGISTICS</span>
          </div>
        </div>

        {/* Regional Base Depots */}
        {showDepots &&
          HVAC_DEPOTS.map((depot) => {
            const pos = projectCoords(depot.lat, depot.lng);
            return (
              <div
                key={depot.id}
                onClick={() => {
                  soundFx.playSelectBlip();
                  setActiveInfoWindow({
                    type: 'DEPOT',
                    id: depot.id,
                    position: { lat: depot.lat, lng: depot.lng },
                  });
                }}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer group ${
                  is3dMode ? 'tactical-3d-counter' : ''
                }`}
              >
                <div className="px-2 py-0.5 bg-slate-950/90 text-white rounded-md text-[9px] font-bold shadow-lg whitespace-nowrap mb-1 border border-slate-700 backdrop-blur-xs flex items-center gap-1 group-hover:border-cyan-400 transition-colors">
                  <Building2 className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{depot.name.split(' ')[0]} Hub</span>
                </div>
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-700 border border-white/50 shadow-[0_0_12px_rgba(99,102,241,0.5)] flex items-center justify-center text-white transition-transform group-hover:scale-110">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}

        {/* 15 HVAC Service Vans with Dynamic Directional Heading & Speeds */}
        {showVehicles &&
          technicians.map((tech) => {
            const pos = projectCoords(tech.currentLocation.lat, tech.currentLocation.lng);
            const isSelected = selectedTechId === tech.id;
            const isOnSite = tech.status === 'ON_SITE';
            const isEnRoute = tech.status === 'EN_ROUTE';
            const heading = computeVehicleHeading(tech);
            const speedTag = getVehicleSpeedTag(tech);

            return (
              <div
                key={tech.id}
                onClick={() => {
                  soundFx.playSelectBlip();
                  onSelectTech(tech.id);
                  setActiveInfoWindow({
                    type: 'TECH',
                    id: tech.id,
                    position: { lat: tech.currentLocation.lat, lng: tech.currentLocation.lng },
                  });
                }}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-30 ${
                  isSelected ? 'scale-125 z-40' : 'hover:scale-115'
                } ${is3dMode ? 'tactical-3d-counter' : ''}`}
              >
                {/* Tactical Telemetry Pill Tag */}
                <div
                  className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shadow-lg border flex items-center gap-1 whitespace-nowrap mb-1 backdrop-blur-md transition-colors ${
                    isSelected
                      ? 'bg-slate-900 text-white border-cyan-400 ring-2 ring-cyan-400/50'
                      : 'bg-slate-950/90 text-slate-100 border-white/20'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                    style={{ backgroundColor: tech.color }}
                  />
                  <span>{tech.vanNumber}</span>
                  <span className="text-[8px] text-slate-400 font-mono font-normal">
                    {tech.name.split(' ')[0]}
                  </span>
                  {isOnSite ? (
                    <span className="text-amber-400 font-bold text-[8px] flex items-center gap-0.5">
                      <Wrench className="w-2 h-2 animate-spin" /> Site
                    </span>
                  ) : isEnRoute ? (
                    <span className="text-cyan-300 text-[8px] font-mono">{speedTag}</span>
                  ) : null}
                </div>

                {/* Van Marker Body with Direction Heading Arrow */}
                <div className="relative flex items-center justify-center">
                  {/* Lock-On Tactical Brackets when selected */}
                  {isSelected && (
                    <div className="absolute -inset-3 pointer-events-none">
                      <div className="w-full h-full border border-cyan-400/80 rounded-xl animate-pulse" />
                      <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                      <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-cyan-400" />
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-cyan-400" />
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />
                    </div>
                  )}

                  {/* Pulsing Aura */}
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white relative transition-transform"
                    style={{
                      backgroundColor: tech.color,
                      boxShadow: `0 0 16px ${tech.color}`,
                    }}
                  >
                    {isOnSite ? (
                      <Wrench className="w-4 h-4 text-white animate-bounce" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}

                    {/* Direction Heading Pointer Arrow */}
                    {!isOnSite && (
                      <div
                        className="absolute -top-1.5 w-3 h-3 text-white pointer-events-none transition-transform duration-300"
                        style={{
                          transform: `rotate(${heading}deg) translateY(-8px)`,
                        }}
                      >
                        <Navigation className="w-3 h-3 fill-white text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        {/* Customer Service Tickets with Urgency Halos & Stop Numbers */}
        {filteredTickets.map((ticket) => {
          const pos = projectCoords(ticket.location.lat, ticket.location.lng);
          const isSelected = selectedTicketId === ticket.id;
          const assignedTech = technicians.find((t) => t.id === ticket.assignedTechId);
          const isAssigned = !!assignedTech;
          const isCompleted = ticket.status === 'COMPLETED';
          const isInProgress = ticket.status === 'IN_PROGRESS';
          const isEmergency = ticket.urgency === 'EMERGENCY';
          const isSameDay = ticket.urgency === 'SAME_DAY';
          const vanColor = assignedTech?.color || '#64748B';

          return (
            <div
              key={ticket.id}
              onClick={() => {
                soundFx.playSelectBlip();
                onSelectTicket(ticket.id);
                setActiveInfoWindow({
                  type: 'TICKET',
                  id: ticket.id,
                  position: { lat: ticket.location.lat, lng: ticket.location.lng },
                });
              }}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all z-20 flex flex-col items-center group ${
                isSelected ? 'scale-125 z-40' : 'hover:scale-115'
              } ${isCompleted ? 'opacity-80' : ''} ${is3dMode ? 'tactical-3d-counter' : ''}`}
            >
              {/* Van / Sequence Pill */}
              <div
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold shadow-md border flex items-center gap-1 whitespace-nowrap mb-0.5 text-white ${
                  isEmergency ? 'ring-1 ring-red-400' : ''
                }`}
                style={{
                  backgroundColor: isAssigned ? vanColor : '#1E293B',
                  borderColor: isAssigned ? '#FFFFFF' : '#475569',
                }}
              >
                {isAssigned ? (
                  <>
                    <Truck className="w-2.5 h-2.5 text-white/90" />
                    <span>{assignedTech.vanNumber}</span>
                    <span className="bg-black/30 px-1 rounded text-[8px] font-mono">
                      #{ticket.stopSequence || 1}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-300 font-mono text-[8px]">{ticket.ticketNumber}</span>
                  </>
                )}

                {isEmergency && <Flame className="w-2.5 h-2.5 text-white animate-pulse" />}
                {isSameDay && <Clock className="w-2.5 h-2.5 text-amber-200" />}
                {isInProgress && <Wrench className="w-2.5 h-2.5 text-amber-200 animate-spin" />}
                {isCompleted && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-200" />}
              </div>

              {/* Marker Pin Body */}
              <div className="relative flex flex-col items-center">
                {/* Emergency Radar Shockwave Effect */}
                {isEmergency && !isCompleted && (
                  <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-zen-shockwave pointer-events-none" />
                )}

                <div
                  className={`w-7 h-7 rounded-xl border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-[11px] ${
                    !isAssigned ? 'border-dashed' : ''
                  }`}
                  style={{
                    backgroundColor: isEmergency ? '#DC2626' : isAssigned ? vanColor : '#334155',
                    boxShadow: isSelected
                      ? `0 0 16px ${isEmergency ? '#EF4444' : vanColor}`
                      : undefined,
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : isInProgress ? (
                    <Wrench className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : isEmergency ? (
                    <Flame className="w-4 h-4 text-white animate-pulse" />
                  ) : isAssigned ? (
                    <span className="font-mono font-black">#{ticket.stopSequence || 1}</span>
                  ) : (
                    <span className="text-[10px]">TK</span>
                  )}
                </div>

                {/* Marker Pointer Notch */}
                <div
                  className="w-1.5 h-1.5 rotate-45 border-r-2 border-b-2 border-white shadow-xs -mt-1"
                  style={{
                    backgroundColor: isEmergency ? '#DC2626' : isAssigned ? vanColor : '#334155',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Tactical Operations Heads-Up Display (HUD Header) */}
      <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none flex items-center justify-between gap-2 flex-wrap">
        {/* Left Telemetry Cluster */}
        <div className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-xl border text-xs font-semibold ${theme.hudBg}`}>
          <div className="flex items-center gap-2">
            <ZenLogo size={20} variant="badge" />
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-[11px] tracking-wide text-slate-100 flex items-center gap-1">
                ZEN<span className="text-cyan-400">AI</span> SPATIAL HUB
              </span>
              <span className="text-[9px] text-cyan-300/80 font-mono">
                DFW SECTOR • 15 FLEET VANS
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-700/60 hidden sm:block" />

          {/* Real-Time HVAC Ambient Telemetry */}
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-amber-400">
            <ThermometerSun className="w-3.5 h-3.5" />
            <span>91°F AMBIENT • PEAK AC DEMAND</span>
          </div>
        </div>

        {/* Right Tactical Control Center */}
        <div className={`pointer-events-auto flex items-center gap-1.5 p-1 rounded-xl backdrop-blur-md shadow-xl border text-xs ${theme.hudBg}`}>
          {/* Theme Selector */}
          <div className="flex items-center rounded-lg bg-black/30 p-0.5">
            <button
              onClick={() => {
                soundFx.playSelectBlip();
                setThemeMode('cyber');
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                themeMode === 'cyber' ? 'bg-cyan-500 text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Cyber Command Dark Mode"
            >
              Cyber
            </button>
            <button
              onClick={() => {
                soundFx.playSelectBlip();
                setThemeMode('blueprint');
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                themeMode === 'blueprint' ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Tactical Blueprint Navy"
            >
              Blueprint
            </button>
            <button
              onClick={() => {
                soundFx.playSelectBlip();
                setThemeMode('clean');
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                themeMode === 'clean' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Clean Daylight Architecture"
            >
              Clean
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700/60" />

          {/* 3D Perspective Hologram Toggle */}
          <button
            onClick={() => {
              soundFx.playSelectBlip();
              setIs3dMode(!is3dMode);
            }}
            className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              is3dMode ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-300 hover:text-white'
            }`}
            title="Toggle 3D Command Table Perspective"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">3D View</span>
          </button>

          {/* Radar Sweep Toggle */}
          <button
            onClick={() => {
              soundFx.playSelectBlip();
              setShowRadar(!showRadar);
            }}
            className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              showRadar ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-300 hover:text-white'
            }`}
            title="Toggle 360° Radar Sweep"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Radar</span>
          </button>

          {/* HVAC Distress Heatmap Layer Toggle */}
          <button
            onClick={() => {
              soundFx.playSelectBlip();
              setShowHeatmap(!showHeatmap);
            }}
            className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              showHeatmap ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'text-slate-300 hover:text-white'
            }`}
            title="Toggle HVAC Distress Heatmap"
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Heatmap</span>
          </button>

          {/* Audio Sonar FX Toggle */}
          <button
            onClick={toggleAudio}
            className={`min-h-[32px] p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              isAudioEnabled ? 'text-cyan-300 bg-cyan-500/20' : 'text-slate-400 hover:text-white'
            }`}
            title={isAudioEnabled ? 'Mute Tactical Audio' : 'Enable Tactical Audio Telemetry'}
            aria-label="Toggle tactical audio effects"
          >
            {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Target Diagnostics HUD Card (When Vehicle or Ticket Selected) */}
      {(selectedTech || selectedTicket) && (
        <div className="absolute bottom-20 md:bottom-5 right-3 md:right-4 z-40 max-w-[320px] w-full animate-fadeIn pointer-events-auto">
          <div className="zen-glass-panel rounded-2xl p-4 text-white shadow-2xl border border-cyan-500/30">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-cyan-400">
                <Crosshair className="w-3.5 h-3.5 animate-spin" />
                <span>TARGET LOCK-ON</span>
              </div>
              <button
                onClick={() => {
                  onSelectTech(null);
                  onSelectTicket(null);
                  setActiveInfoWindow(null);
                }}
                className="text-slate-400 hover:text-white text-xs p-1"
                aria-label="Clear Target Lock"
              >
                ✕
              </button>
            </div>

            {selectedTech && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTech.color }} />
                    <span className="font-extrabold text-sm">{selectedTech.vanNumber}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 font-mono font-bold">
                    {selectedTech.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-white">{selectedTech.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    GPS: {selectedTech.currentLocation.lat.toFixed(4)}° N, {Math.abs(selectedTech.currentLocation.lng).toFixed(4)}° W
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                  <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                    <span className="text-[9px] text-slate-400 block">Scheduled Stops</span>
                    <span className="font-bold text-cyan-300 font-mono">
                      {selectedTech.assignedTicketIds?.length || 0}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                    <span className="text-[9px] text-slate-400 block">Est Drive</span>
                    <span className="font-bold text-blue-400 font-mono">
                      {selectedTech.routeMetrics?.totalDriveMinutes || 45}m
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedTicket && !selectedTech && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedTicket.urgency === 'EMERGENCY' ? 'bg-red-500 text-white' : 'bg-amber-500 text-slate-950'
                  }`}>
                    {selectedTicket.urgency}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-300">{selectedTicket.ticketNumber}</span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-white">{selectedTicket.customerName}</h4>
                  <p className="text-xs text-slate-400 line-clamp-1">{selectedTicket.location.address}</p>
                </div>

                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700 text-xs">
                  <span className="text-[10px] text-cyan-400 font-bold block">UNIT DIAGNOSTIC</span>
                  <p className="text-white font-medium">{selectedTicket.equipmentType}</p>
                  {selectedTicket.faultCode && (
                    <span className="text-red-400 font-mono text-[10px] font-bold">
                      Fault: {selectedTicket.faultCode}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Tactical Zoom Controls */}
      <div className="absolute bottom-18 landscape:bottom-3 md:bottom-4 right-3 md:right-4 z-30 flex flex-col gap-1 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700 p-1 shadow-2xl text-white">
        <button
          onClick={() => {
            soundFx.playSelectBlip();
            setZoomLevel((z) => Math.min(2.5, z + 0.25));
          }}
          className="min-h-[40px] min-w-[40px] p-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white font-bold transition-colors flex items-center justify-center cursor-pointer"
          title="Zoom In"
          aria-label="Zoom in on territory map"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            soundFx.playSelectBlip();
            setZoomLevel((z) => Math.max(0.75, z - 0.25));
          }}
          className="min-h-[40px] min-w-[40px] p-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white font-bold transition-colors flex items-center justify-center cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom out on territory map"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="min-h-[40px] min-w-[40px] p-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white font-bold transition-colors border-t border-slate-800 flex items-center justify-center cursor-pointer"
          title="Reset Spatial Orientation"
          aria-label="Reset territory map"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
