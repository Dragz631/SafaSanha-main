import React, { useState, useRef } from 'react';
import { MapPin, Navigation, Compass, Layers, ShieldCheck, Zap, Plus, Trash2, Crosshair, Check, Pencil, RotateCcw, Lock } from 'lucide-react';
import { GeofenceConfig } from '../types';

interface AssociationMapDrawerProps {
  geofence?: GeofenceConfig;
  colorHex?: string;
  onChangeGeofence: (newGeofence: GeofenceConfig) => void;
}

// Preset map locations for local community centers & associations
const MAP_PRESET_LOCATIONS = [
  { name: 'Sede Cremate (Centro)', lat: -22.9035, lng: -43.2096, label: 'Zona Central Cremate' },
  { name: 'Morro da Chatuba (Ladeira)', lat: -22.9150, lng: -43.2210, label: 'Comunidade Chatuba' },
  { name: 'Morro da Cruz (Base)', lat: -22.9280, lng: -43.2350, label: 'Escadaria da Cruz' },
  { name: 'Parque Alegria', lat: -22.8910, lng: -43.2010, label: 'Área Comunitária' },
  { name: 'Rua Paraíso', lat: -22.9080, lng: -43.2180, label: 'Bairro Paraíso' },
];

export const AssociationMapDrawer: React.FC<AssociationMapDrawerProps> = ({
  geofence,
  colorHex = '#8b5cf6',
  onChangeGeofence,
}) => {
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const [geofenceType, setGeofenceType] = useState<'circulo' | 'poligono'>(
    geofence?.tipo || 'circulo'
  );
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [centerLat, setCenterLat] = useState<number>(geofence?.centro_lat || -22.9035);
  const [centerLng, setCenterLng] = useState<number>(geofence?.centro_lng || -43.2096);
  const [radiusMeters, setRadiusMeters] = useState<number>(geofence?.raio_metros || 300);
  const [vertices, setVertices] = useState<Array<{ lat: number; lng: number }>>(
    geofence?.pontos && geofence.pontos.length > 0
      ? geofence.pontos
      : [
          { lat: -22.902, lng: -43.208 },
          { lat: -22.905, lng: -43.206 },
          { lat: -22.906, lng: -43.212 },
          { lat: -22.901, lng: -43.211 },
        ]
  );
  const [areaDescription, setAreaDescription] = useState<string>(
    geofence?.descricao_area || 'Cerca Virtual Ativa — Monitoramento Geográfico Ativo'
  );

  const handleApplyChanges = () => {
    const updated: GeofenceConfig = {
      tipo: geofenceType,
      centro_lat: centerLat,
      centro_lng: centerLng,
      raio_metros: radiusMeters,
      pontos: geofenceType === 'poligono' ? vertices : undefined,
      descricao_area: areaDescription,
    };
    onChangeGeofence(updated);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapCanvasRef.current) return;
    const rect = mapCanvasRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width; // 0 to 1
    const yRatio = (e.clientY - rect.top) / rect.height; // 0 to 1

    // Map ratios to lat/lng offsets around center
    const latOffset = (0.5 - yRatio) * 0.01;
    const lngOffset = (xRatio - 0.5) * 0.01;

    const clickedLat = Number((centerLat + latOffset).toFixed(5));
    const clickedLng = Number((centerLng + lngOffset).toFixed(5));

    if (geofenceType === 'circulo') {
      setCenterLat(clickedLat);
      setCenterLng(clickedLng);
    } else {
      if (isDrawing) {
        setVertices((prev) => [...prev, { lat: clickedLat, lng: clickedLng }]);
      } else {
        setCenterLat(clickedLat);
        setCenterLng(clickedLng);
      }
    }
  };

  const handleClearPolygon = () => {
    setVertices([]);
    setIsDrawing(true);
  };

  const handleAddVertex = () => {
    const last = vertices[vertices.length - 1] || { lat: centerLat, lng: centerLng };
    setVertices([...vertices, { lat: Number((last.lat + 0.0015).toFixed(5)), lng: Number((last.lng + 0.0015).toFixed(5)) }]);
  };

  const handleRemoveVertex = (idx: number) => {
    if (vertices.length <= 3) {
      alert('O perímetro do polígono deve conter pelo menos 3 vértices.');
      return;
    }
    setVertices(vertices.filter((_, i) => i !== idx));
  };

  const handleSelectPreset = (preset: typeof MAP_PRESET_LOCATIONS[0]) => {
    setCenterLat(preset.lat);
    setCenterLng(preset.lng);
    setAreaDescription(`Cerca Virtual: ${preset.name} (${preset.label})`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span>🗺️ Desenho de Cerca Virtual no Mapa (Geofencing)</span>
            </h4>
            <p className="text-xs text-slate-400">
              Clique no mapa para posicionar ou delimitar o perímetro exato da Associação Comunitária.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setGeofenceType('circulo');
              setIsDrawing(false);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              geofenceType === 'circulo'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚪ Raio Circular
          </button>
          <button
            type="button"
            onClick={() => {
              setGeofenceType('poligono');
              setIsDrawing(true);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              geofenceType === 'poligono'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📐 Polígono do Mapa
          </button>
        </div>
      </div>

      {/* Preset Quick Location Buttons & Drawing Tool */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-purple-400" />
            Pontos de Referência Rápidos:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {MAP_PRESET_LOCATIONS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="text-xs font-bold bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-200 border border-slate-700 hover:border-purple-600 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
              >
                📍 {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* DRAWING TOGGLE BUTTON */}
        <div className="flex items-center gap-2">
          {geofenceType === 'poligono' && (
            <>
              <button
                type="button"
                onClick={() => setIsDrawing(!isDrawing)}
                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all ${
                  isDrawing
                    ? 'bg-amber-500 text-slate-950 border border-amber-300 animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                <Pencil className="w-4 h-4" />
                <span>{isDrawing ? '✏️ Modo Desenho Ativo (Clique no Mapa)' : '✏️ Desenhar Área no Mapa'}</span>
              </button>

              <button
                type="button"
                onClick={handleClearPolygon}
                className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 border border-slate-700 cursor-pointer"
                title="Limpar Polígono"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resetar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* INTERACTIVE MAP CANVAS */}
      <div
        ref={mapCanvasRef}
        onClick={handleCanvasClick}
        className={`relative w-full h-64 sm:h-72 bg-slate-950 rounded-2xl border-2 overflow-hidden flex flex-col justify-between p-3 select-none shadow-inner cursor-crosshair transition-all ${
          isDrawing ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-800'
        }`}
      >
        {/* SVG Street Grid Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Main Simulated Community Roads */}
          <line x1="0" y1="60" x2="100%" y2="200" stroke="#818cf8" strokeWidth="4" strokeDasharray="8,4" />
          <line x1="140" y1="0" x2="300" y2="100%" stroke="#38bdf8" strokeWidth="3" />
          <line x1="0" y1="140" x2="100%" y2="100" stroke="#a78bfa" strokeWidth="3" />
        </svg>

        {/* Top Info Overlay */}
        <div className="relative z-10 flex items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono">
          <span className="text-purple-300 font-bold flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-purple-400" />
            <span>Coordenadas: Lat {centerLat.toFixed(4)}, Lng {centerLng.toFixed(4)}</span>
          </span>
          <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
            {geofenceType === 'circulo' ? `Raio ${radiusMeters}m` : `${vertices.length} Pontos Mapeados`}
          </span>
        </div>

        {/* Interactive Visual Map Zone Representation */}
        <div className="relative z-10 flex-1 flex items-center justify-center pointer-events-none my-2">
          {geofenceType === 'circulo' ? (
            <div
              className="rounded-full border-2 border-purple-400 bg-purple-500/20 backdrop-blur-xs flex items-center justify-center transition-all duration-300 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
              style={{
                width: `${Math.min(240, Math.max(90, radiusMeters / 2.2))}px`,
                height: `${Math.min(240, Math.max(90, radiusMeters / 2.2))}px`,
              }}
            >
              <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white animate-ping" />
              <div className="absolute w-3 h-3 rounded-full bg-purple-400 border-2 border-white" />
            </div>
          ) : (
            <div className="relative w-56 h-40 border-2 border-amber-400 bg-amber-500/20 rounded-2xl flex flex-col items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.4)] space-y-1">
              <span className="text-[11px] font-black text-amber-200 bg-slate-900/90 px-3 py-1 rounded-xl border border-amber-500/60 shadow-xs">
                📐 Polígono da Cerca Virtual
              </span>
              <span className="text-[10px] font-extrabold text-amber-300/80">
                {isDrawing ? 'Clique em qualquer ponto do mapa para adicionar vértices' : 'Clique no mapa para mover'}
              </span>
            </div>
          )}
        </div>

        {/* Bottom Instruction Legend */}
        <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>🎯 {isDrawing ? 'Modo de marcação ativo: Clique para adicionar pontos' : 'Clique no mapa para redefinir o centro'}</span>
          <span className="text-purple-300 font-bold">{areaDescription}</span>
        </div>
      </div>

      {/* Controls for Parameters */}
      {geofenceType === 'circulo' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Centro Latitude:</label>
            <input
              type="number"
              step="0.0001"
              value={centerLat}
              onChange={(e) => setCenterLat(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Centro Longitude:</label>
            <input
              type="number"
              step="0.0001"
              value={centerLng}
              onChange={(e) => setCenterLng(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">
              Raio de Ação (Metros): <span className="text-purple-300">{radiusMeters}m</span>
            </label>
            <input
              type="range"
              min="50"
              max="1500"
              step="25"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="font-extrabold text-slate-300">Vértices do Perímetro ({vertices.length} Pontos):</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddVertex}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Ponto
              </button>
              <button
                type="button"
                onClick={() => setIsDrawing(false)}
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-black px-3 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Concluir Desenho
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
            {vertices.map((v, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="font-black text-amber-400 text-[10px] shrink-0">#{idx + 1}</span>
                <input
                  type="number"
                  step="0.0001"
                  value={v.lat}
                  onChange={(e) => {
                    const newArr = [...vertices];
                    newArr[idx].lat = parseFloat(e.target.value) || 0;
                    setVertices(newArr);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] font-mono text-white"
                />
                <input
                  type="number"
                  step="0.0001"
                  value={v.lng}
                  onChange={(e) => {
                    const newArr = [...vertices];
                    newArr[idx].lng = parseFloat(e.target.value) || 0;
                    setVertices(newArr);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveVertex(idx)}
                  className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Area Description Input */}
      <div>
        <label className="block text-xs font-extrabold text-slate-300 mb-1">
          Identificação da Cerca Virtual:
        </label>
        <input
          type="text"
          value={areaDescription}
          onChange={(e) => setAreaDescription(e.target.value)}
          placeholder="Ex: Cerca Virtual — Comunidade Parque Alegria"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleApplyChanges}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <Check className="w-4 h-4" />
          <span>Salvar Cerca Virtual no Cadastro</span>
        </button>
      </div>
    </div>
  );
};

