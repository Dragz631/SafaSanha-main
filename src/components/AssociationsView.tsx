import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  ShieldCheck,
  Compass,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  Navigation,
  Pencil,
  RotateCcw,
  Sliders,
  Maximize2,
  Crosshair,
  Target
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { AssociationArea, AssociationMemoryRecord, GeofenceConfig } from '../types';

interface AssociationsViewProps {
  associations: AssociationArea[];
  memoryRecords: AssociationMemoryRecord[];
  onAddAssociation: (newAssoc: AssociationArea) => void;
  onUpdateAssociation: (updatedAssoc: AssociationArea) => void;
  onDeleteAssociation: (id: string) => void;
  onAddMemoryRecord: (record: AssociationMemoryRecord) => void;
  onDeleteMemoryRecord: (id: string) => void;
}

// Preset Rio / Brazilian Community Locations
const PRESET_LOCATIONS = [
  { name: 'Caju / Parque Alegria (RJ)', lat: -22.8850, lng: -43.2100 },
  { name: 'Morro da Paz / Cremate (RJ)', lat: -22.9035, lng: -43.2096 },
  { name: 'Vila Esperança / Pavão (RJ)', lat: -22.9838, lng: -43.1985 },
  { name: 'Complexo da Penha (RJ)', lat: -22.8423, lng: -43.2781 },
  { name: 'Rocinha / Via Ápia (RJ)', lat: -22.9886, lng: -43.2478 },
  { name: 'Paraisópolis (SP)', lat: -23.6162, lng: -46.7265 },
];

export const AssociationsView: React.FC<AssociationsViewProps> = ({
  associations,
  memoryRecords,
  onAddAssociation,
  onUpdateAssociation,
  onDeleteAssociation,
  onDeleteMemoryRecord,
}) => {
  // Editing / Creating State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assocName, setAssocName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [assocColor, setAssocColor] = useState('purple');
  const [assocDesc, setAssocDesc] = useState('');

  // Manual Exception Inputs
  const [manualStreetInput, setManualStreetInput] = useState('');
  const [manualResidentInput, setManualResidentInput] = useState('');
  const [manualExcludedInput, setManualExcludedInput] = useState('');

  // Linked Lists
  const [linkedStreets, setLinkedStreets] = useState<string[]>([]);
  const [linkedResidents, setLinkedResidents] = useState<string[]>([]);
  const [excludedAddresses, setExcludedAddresses] = useState<string[]>([]);

  // Map & Geofence State (Centered strictly in Caju, RJ with Street Zoom 17)
  const [modoMapeamento, setModoMapeamento] = useState<'RAIO' | 'POLIGONO'>('RAIO');
  const [geofenceType, setGeofenceType] = useState<'circulo' | 'poligono'>('circulo');
  const [centerLat, setCenterLat] = useState(-22.8850);
  const [centerLng, setCenterLng] = useState(-43.2100);
  const [radiusMeters, setRadiusMeters] = useState(350);
  const [polygonPoints, setPolygonPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isRefreshingMap, setIsRefreshingMap] = useState(false);

  // Overpass API state
  const [isQueryingOverpass, setIsQueryingOverpass] = useState(false);
  const [overpassStatusText, setOverpassStatusText] = useState<string | null>(null);
  const [detectedStreetsCount, setDetectedStreetsCount] = useState<number>(0);

  // Leaflet Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const circleLayerRef = useRef<L.Circle | null>(null);
  const markerLayerRef = useRef<L.Marker | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);
  const drawnItemsRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);

  // Tab View state inside Associations View
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'list'>('editor');

  // Trigger map.invalidateSize(true) when switching to editor tab or updating assoc
  useEffect(() => {
    if (activeSubTab === 'editor' && leafletMapRef.current) {
      const invalidate = () => {
        if (leafletMapRef.current) {
          leafletMapRef.current.invalidateSize(true);
        }
      };
      invalidate();
      const timer1 = setTimeout(invalidate, 100);
      const timer2 = setTimeout(invalidate, 350);
      const timer3 = setTimeout(invalidate, 800);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [activeSubTab, editingId]);

  // ResizeObserver on the map DOM container to prevent CSS layout collapses
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize(true);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeSubTab]);

  // Quick reload button handler
  const handleReloadMap = () => {
    setIsRefreshingMap(true);
    if (leafletMapRef.current) {
      leafletMapRef.current.invalidateSize(true);
      leafletMapRef.current.setView([centerLat || -22.8850, centerLng || -43.2100], 17);
      if (tileLayerRef.current) {
        tileLayerRef.current.redraw();
      }
    }
    setOverpassStatusText('🔄 Canvas recalibrado! Tiles e geofence sincronizados no Caju (RJ).');
    setTimeout(() => {
      setIsRefreshingMap(false);
    }, 600);
  };

  // Load existing association into editor
  const handleLoadAssociationForEdit = (assoc: AssociationArea) => {
    setEditingId(assoc.id);
    setAssocName(assoc.nome);
    setReceiverName(assoc.recebedor_padrao);
    setAssocColor(assoc.cor || 'purple');
    setAssocDesc(assoc.descricao || '');
    setLinkedStreets(assoc.ruas || []);
    setLinkedResidents(assoc.moradores || []);
    setExcludedAddresses(assoc.excecoes_enderecos || []);

    if (assoc.cerca_virtual) {
      const isPoly = assoc.cerca_virtual.tipo === 'poligono';
      setModoMapeamento(isPoly ? 'POLIGONO' : 'RAIO');
      setGeofenceType(assoc.cerca_virtual.tipo || 'circulo');
      if (assoc.cerca_virtual.centro_lat) setCenterLat(assoc.cerca_virtual.centro_lat);
      if (assoc.cerca_virtual.centro_lng) setCenterLng(assoc.cerca_virtual.centro_lng);
      if (assoc.cerca_virtual.raio_metros) setRadiusMeters(assoc.cerca_virtual.raio_metros);
      if (assoc.cerca_virtual.pontos) setPolygonPoints(assoc.cerca_virtual.pontos);
    }
    setActiveSubTab('editor');

    // Force map size refresh after loading into editor with street-level zoom (17)
    setTimeout(() => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize(true);
        if (assoc.cerca_virtual?.centro_lat && assoc.cerca_virtual?.centro_lng) {
          leafletMapRef.current.setView([assoc.cerca_virtual.centro_lat, assoc.cerca_virtual.centro_lng], 17);
        }
      }
    }, 200);
  };

  const handleResetEditor = () => {
    setEditingId(null);
    setAssocName('');
    setReceiverName('');
    setAssocColor('purple');
    setAssocDesc('');
    setLinkedStreets([]);
    setLinkedResidents([]);
    setExcludedAddresses([]);
    setModoMapeamento('RAIO');
    setGeofenceType('circulo');
    setCenterLat(-22.8850);
    setCenterLng(-43.2100);
    setRadiusMeters(350);
    setPolygonPoints([]);
    setManualStreetInput('');
    setManualResidentInput('');
    setManualExcludedInput('');
    setOverpassStatusText(null);
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
  };

  // Crosshair Polygon Drawing Handlers
  const handleAddPointFromCenter = () => {
    const map = leafletMapRef.current;
    const center = map ? map.getCenter() : { lat: centerLat, lng: centerLng };
    const newPt = {
      lat: Number(center.lat.toFixed(5)),
      lng: Number(center.lng.toFixed(5)),
    };
    setPolygonPoints((prev) => [...prev, newPt]);
    setGeofenceType('poligono');
  };

  const handleUndoLastPoint = () => {
    setPolygonPoints((prev) => prev.slice(0, -1));
  };

  const handleClearPolygonPoints = () => {
    setPolygonPoints([]);
  };

  const handleFinishPolygonGeofence = () => {
    if (polygonPoints.length < 3) {
      alert('⚠️ Adicione pelo menos 3 pontos com a Mira Central para formar a cerca virtual da comunidade.');
      return;
    }
    let sumLat = 0;
    let sumLng = 0;
    polygonPoints.forEach((p) => {
      sumLat += p.lat;
      sumLng += p.lng;
    });
    const cLat = Number((sumLat / polygonPoints.length).toFixed(5));
    const cLng = Number((sumLng / polygonPoints.length).toFixed(5));
    setCenterLat(cLat);
    setCenterLng(cLng);
    setGeofenceType('poligono');
    setOverpassStatusText(`📐 Cerca por Polígono Finalizada (${polygonPoints.length} vértices). Consultando ruas no Caju (RJ)...`);
    handleQueryOverpassStreets(polygonPoints);
  };

  // Initialize Leaflet Map (Centered in Caju RJ, Zoom 17, Free Mobile Pan & Zoom)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = centerLat && !isNaN(centerLat) ? centerLat : -22.8850;
    const initialLng = centerLng && !isNaN(centerLng) ? centerLng : -43.2100;

    if (!leafletMapRef.current) {
      // Create Leaflet Map Instance with Street-Level Zoom 17 centered at Caju (RJ)
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 17,
        zoomControl: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        boxZoom: true,
        tapHold: true,
      });

      // Stable Public OpenStreetMap Tile Layer (HTTPS & CORS Supported)
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        noWrap: true,
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Custom Center Pin Icon (For Raio Mode)
      const centerIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background-color: #8b5cf6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(0,0,0,0.5); cursor: pointer;"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([initialLat, initialLng], { draggable: true, icon: centerIcon }).addTo(map);

      marker.on('dragend', (e) => {
        const latlng = e.target.getLatLng();
        setCenterLat(Number(latlng.lat.toFixed(5)));
        setCenterLng(Number(latlng.lng.toFixed(5)));
      });

      // Synchronize map center on free pan/drag move
      map.on('move', () => {
        const c = map.getCenter();
        if (c && !isNaN(c.lat) && !isNaN(c.lng)) {
          setCenterLat(Number(c.lat.toFixed(5)));
          setCenterLng(Number(c.lng.toFixed(5)));
        }
      });

      map.on('click', (e) => {
        // Only move pin on map click when in RAIO mode
        if (modoMapeamento === 'RAIO') {
          const { lat, lng } = e.latlng;
          setCenterLat(Number(lat.toFixed(5)));
          setCenterLng(Number(lng.toFixed(5)));
          marker.setLatLng([lat, lng]);
        }
      });

      leafletMapRef.current = map;
      markerLayerRef.current = marker;

      // Force size recalibration with street zoom
      setTimeout(() => {
        map.invalidateSize(true);
      }, 300);
    } else {
      leafletMapRef.current.setView([initialLat, initialLng], leafletMapRef.current.getZoom() || 17);
      if (markerLayerRef.current) {
        markerLayerRef.current.setLatLng([initialLat, initialLng]);
      }
    }
  }, [centerLat, centerLng]);

  // Handle Mode Visibility (RAIO vs POLIGONO)
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (modoMapeamento === 'RAIO') {
      if (markerLayerRef.current && !map.hasLayer(markerLayerRef.current)) {
        markerLayerRef.current.addTo(map);
      }
    } else {
      if (markerLayerRef.current && map.hasLayer(markerLayerRef.current)) {
        map.removeLayer(markerLayerRef.current);
      }
    }

    map.invalidateSize(true);
  }, [modoMapeamento]);

  // Update Geofence Layers in real-time (Circle, Polyline or Polygon)
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear previous circle
    if (circleLayerRef.current) {
      map.removeLayer(circleLayerRef.current);
      circleLayerRef.current = null;
    }
    // Clear previous polygon
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    // Clear previous polyline
    if (polylineLayerRef.current) {
      map.removeLayer(polylineLayerRef.current);
      polylineLayerRef.current = null;
    }
    // Clear previous vertex markers
    vertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    vertexMarkersRef.current = [];

    if (modoMapeamento === 'RAIO') {
      const circle = L.circle([centerLat, centerLng], {
        color: '#8b5cf6',
        fillColor: '#a855f7',
        fillOpacity: 0.25,
        radius: radiusMeters,
        weight: 2,
      }).addTo(map);
      circleLayerRef.current = circle;
    } else if (modoMapeamento === 'POLIGONO') {
      const latLngs = polygonPoints.map((p) => [p.lat, p.lng] as [number, number]);

      // Render vertex markers with sequential labels
      polygonPoints.forEach((pt, idx) => {
        const isFirst = idx === 0;
        const vertexIcon = L.divIcon({
          className: 'custom-vertex-marker',
          html: `<div style="background-color: ${isFirst ? '#ef4444' : '#f59e0b'}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: 900;">${idx + 1}</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([pt.lat, pt.lng], { icon: vertexIcon }).addTo(map);
        vertexMarkersRef.current.push(marker);
      });

      if (polygonPoints.length === 2) {
        // Render real-time line connecting 2 points
        const polyline = L.polyline(latLngs, {
          color: '#f59e0b',
          weight: 3,
          dashArray: '6, 6',
        }).addTo(map);
        polylineLayerRef.current = polyline;
      } else if (polygonPoints.length >= 3) {
        // Render closed polygon with area fill
        const polygon = L.polygon(latLngs, {
          color: '#f59e0b',
          fillColor: '#fbbf24',
          fillOpacity: 0.35,
          weight: 3,
        }).addTo(map);
        polygonLayerRef.current = polygon;
      }
    }
  }, [modoMapeamento, centerLat, centerLng, radiusMeters, polygonPoints]);

  // Query Overpass API for Street Detection (Direct Client-Side Fetch via Bounding Box / GET)
  const handleQueryOverpassStreets = async (customPoints?: { lat: number; lng: number }[]) => {
    setIsQueryingOverpass(true);
    setOverpassStatusText(`🔍 Consultando Overpass API em tempo real...`);

    const pts = customPoints && customPoints.length >= 3 ? customPoints : polygonPoints;

    try {
      let overpassQuery = '';
      if (modoMapeamento === 'POLIGONO' && pts.length >= 3) {
        // Calculate Bounding Box (south, west, north, east) from polygon points
        const lats = pts.map((p) => p.lat);
        const lngs = pts.map((p) => p.lng);
        const south = Math.min(...lats);
        const north = Math.max(...lats);
        const west = Math.min(...lngs);
        const east = Math.max(...lngs);

        overpassQuery = `[out:json][timeout:15];way["highway"](${south},${west},${north},${east});out tags;`;
      } else {
        overpassQuery = `[out:json][timeout:15];way["highway"](around:${radiusMeters},${centerLat},${centerLng});out tags;`;
      }

      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
      ];

      let data: any = null;
      let lastErrMessage = '';

      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const url = `${endpoint}?data=${encodeURIComponent(overpassQuery)}`;

          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (err: any) {
          lastErrMessage = err?.message || 'Falha de conexão com servidor Overpass';
        }
      }

      if (!data) {
        throw new Error(lastErrMessage || 'Não foi possível conectar aos servidores da Overpass API');
      }

      const foundStreetsSet = new Set<string>();

      if (data && Array.isArray(data.elements)) {
        data.elements.forEach((elem: any) => {
          if (elem.tags) {
            const streetName = elem.tags.name || elem.tags['name:pt'] || elem.tags.alt_name || elem.tags.official_name;
            if (streetName && streetName.trim().length > 1) {
              foundStreetsSet.add(streetName.trim());
            }
          }
        });
      }

      const detectedList = Array.from(foundStreetsSet);

      setLinkedStreets((prev) => {
        const set = new Set([...prev, ...detectedList]);
        return Array.from(set);
      });

      setDetectedStreetsCount(detectedList.length);

      if (detectedList.length > 0) {
        setOverpassStatusText(`✅ Sucesso! Consultadas ${detectedList.length} ruas reais no mapa via Overpass API.`);
      } else {
        setOverpassStatusText(`⚠️ Nenhuma rua com nome cadastrado no OpenStreetMap foi encontrada na área.`);
      }
    } catch (err: any) {
      console.error('Erro ao consultar Overpass API:', err);
      setOverpassStatusText(`❌ Consulta Overpass: ${err?.message || 'Servidor indisponível'}. Adicione ruas manualmente se necessário.`);
    } finally {
      setIsQueryingOverpass(false);
    }
  };

  // Add manual street exception
  const handleAddManualStreet = () => {
    if (!manualStreetInput.trim()) return;
    const clean = manualStreetInput.trim();
    if (!linkedStreets.includes(clean)) {
      setLinkedStreets([...linkedStreets, clean]);
    }
    setManualStreetInput('');
  };

  const handleRemoveStreet = (street: string) => {
    setLinkedStreets(linkedStreets.filter((s) => s !== street));
  };

  // Add manual resident exception
  const handleAddManualResident = () => {
    if (!manualResidentInput.trim()) return;
    const clean = manualResidentInput.trim();
    if (!linkedResidents.includes(clean)) {
      setLinkedResidents([...linkedResidents, clean]);
    }
    setManualResidentInput('');
  };

  const handleRemoveResident = (res: string) => {
    setLinkedResidents(linkedResidents.filter((r) => r !== res));
  };

  // Add manual excluded address exception (Ignore Buildings / Main Streets)
  const handleAddExcludedAddress = () => {
    if (!manualExcludedInput.trim()) return;
    const clean = manualExcludedInput.trim();
    if (!excludedAddresses.includes(clean)) {
      setExcludedAddresses([...excludedAddresses, clean]);
    }
    setManualExcludedInput('');
  };

  const handleRemoveExcludedAddress = (addr: string) => {
    setExcludedAddresses(excludedAddresses.filter((a) => a !== addr));
  };

  // Preset Location Selector
  const handleSelectPreset = (preset: { name: string; lat: number; lng: number }) => {
    setCenterLat(preset.lat);
    setCenterLng(preset.lng);
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([preset.lat, preset.lng], 17);
      leafletMapRef.current.invalidateSize(true);
    }
  };

  // Save Association CTA Submit
  const handleSaveAssociation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assocName.trim()) {
      alert('Por favor, informe o Nome da Associação.');
      return;
    }
    if (!receiverName.trim()) {
      alert('Por favor, informe o Recebedor Padrão na Sede.');
      return;
    }

    const cercaVirtualConfig: GeofenceConfig = {
      tipo: geofenceType,
      centro_lat: centerLat,
      centro_lng: centerLng,
      raio_metros: radiusMeters,
      pontos: polygonPoints,
      descricao_area: geofenceType === 'circulo' ? `Raio de ${radiusMeters}m` : `Polígono com ${polygonPoints.length} pontos`,
    };

    if (editingId) {
      const updated: AssociationArea = {
        id: editingId,
        nome: assocName.trim(),
        recebedor_padrao: receiverName.trim(),
        ruas: linkedStreets,
        moradores: linkedResidents,
        excecoes_enderecos: excludedAddresses,
        cor: assocColor,
        descricao: assocDesc.trim() || `Área delimitada no mapa (${linkedStreets.length} ruas)`,
        cerca_virtual: cercaVirtualConfig,
      };
      onUpdateAssociation(updated);
      alert(`✅ Associação "${updated.nome}" atualizada com sucesso!`);
    } else {
      const newAssoc: AssociationArea = {
        id: `assoc_${Date.now()}`,
        nome: assocName.trim(),
        recebedor_padrao: receiverName.trim(),
        ruas: linkedStreets.length > 0 ? linkedStreets : ['Travessa Principal'],
        moradores: linkedResidents,
        excecoes_enderecos: excludedAddresses,
        cor: assocColor,
        descricao: assocDesc.trim() || `Cerca Virtual (${linkedStreets.length} ruas detectadas)`,
        cerca_virtual: cercaVirtualConfig,
      };
      onAddAssociation(newAssoc);
      alert(`🎉 Associação "${newAssoc.nome}" criada com sucesso e Saca ativada!`);
    }

    handleResetEditor();
    setActiveSubTab('list');
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 pt-3 sm:pt-4 pb-12 space-y-4 sm:space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-purple-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-[9px] sm:text-[10px] font-black uppercase text-purple-300 bg-purple-950 px-2.5 py-1 rounded-full border border-purple-700 inline-block">
            Módulo de Geofencing, Inteligência de Ruas & Overpass API
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white flex items-center gap-2 pt-0.5 leading-tight">
            <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400 shrink-0" />
            <span>Gestão de Cercas Virtuais & Associações Comunitárias</span>
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed">
            Desenhe a área da Associação no mapa Leaflet.js, defina o raio de cobertura ou polígono e a tecnologia Overpass API (OpenStreetMap) detectará e vinculará automaticamente todas as ruas da comunidade.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => {
              handleResetEditor();
              setActiveSubTab('editor');
            }}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg w-full sm:w-auto ${
              activeSubTab === 'editor'
                ? 'bg-purple-500 text-white border border-purple-300'
                : 'bg-slate-800 text-purple-200 hover:bg-slate-700'
            }`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>➕ Criar / Mapear Nova Associação</span>
          </button>

          <button
            onClick={() => setActiveSubTab('list')}
            className={`px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto ${
              activeSubTab === 'list'
                ? 'bg-purple-500 text-white'
                : 'bg-slate-800 text-purple-200 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>Associações Ativas ({associations.length})</span>
          </button>
        </div>
      </div>

      {/* SUB TAB 1: FULL PAGE MAP & ASSOCIATION EDITOR */}
      {activeSubTab === 'editor' && (
        <div className="space-y-4 sm:space-y-6 animate-fadeIn">
          {/* Editor Header Title */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 bg-purple-100 text-purple-800 rounded-2xl shrink-0">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  {editingId ? `✏️ Editando Associação: ${assocName || 'Comunitária'}` : '📍 Mapear Nova Área Comunitária & Cerca Virtual'}
                </h3>
                <p className="text-xs text-slate-500">
                  Defina a localização exata, ajuste o raio de cobertura ou desenhe um polígono e detecte as ruas via OpenStreetMap.
                </p>
              </div>
            </div>

            {editingId && (
              <button
                onClick={handleResetEditor}
                className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl cursor-pointer w-full sm:w-auto"
              >
                Cancelar Edição
              </button>
            )}
          </div>

          {/* SECTION 1: LEAFLET INTERACTIVE MAP */}
          <div className="bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border-2 border-slate-800 shadow-2xl space-y-3 sm:space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-white border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-extrabold text-xs sm:text-sm">
                  Mapa Interativo Leaflet.js (Overpass API / Desenho Livre)
                </span>
              </div>

              {/* Controls Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                {/* Geofence Mode Toggle */}
                <div className="bg-slate-800 p-1 rounded-xl grid grid-cols-2 sm:flex items-center text-[11px] sm:text-xs font-extrabold w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setModoMapeamento('RAIO');
                      setGeofenceType('circulo');
                      if (leafletMapRef.current) leafletMapRef.current.invalidateSize(true);
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                      modoMapeamento === 'RAIO'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🔴 Raio (Círculo)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoMapeamento('POLIGONO');
                      setGeofenceType('poligono');
                      if (leafletMapRef.current) leafletMapRef.current.invalidateSize(true);
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                      modoMapeamento === 'POLIGONO'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📐 Desenhar Polígono
                  </button>
                </div>

                {/* Overpass Query Trigger Button */}
                <button
                  type="button"
                  onClick={() => handleQueryOverpassStreets()}
                  disabled={isQueryingOverpass}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs px-3.5 py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 w-full sm:w-auto shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-purple-200 shrink-0" />
                  <span>{isQueryingOverpass ? 'Buscando Ruas...' : '⚡ Detecção de Ruas (Overpass)'}</span>
                </button>
              </div>
            </div>

            {/* Exclusive Mode Control Panels */}
            {modoMapeamento === 'RAIO' ? (
              /* Radius Slider Bar */
              <div className="bg-slate-950 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between text-xs font-extrabold gap-2">
                      <span className="text-purple-300 truncate">Raio da Cerca Virtual:</span>
                      <span className="text-purple-200 bg-purple-950 px-2 py-0.5 rounded border border-purple-800 font-mono text-[11px] shrink-0">
                        {radiusMeters} Metros
                      </span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="1500"
                      step="50"
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(Number(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>

                {/* Preset Quick Locations */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mr-1">Atalhos:</span>
                  {PRESET_LOCATIONS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="text-[10px] sm:text-[11px] font-bold bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-200 border border-slate-700 hover:border-purple-600 px-2 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      📍 {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Polygon Mode Active Notification Banner */
              <div className="bg-amber-950/90 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-amber-200 text-xs font-extrabold">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-5 h-5 text-amber-400 animate-spin shrink-0" style={{ animationDuration: '10s' }} />
                  <span className="leading-tight">
                    🎯 <strong>Modo Mira Central (Navegação Livre):</strong> Arraste e dê zoom no mapa. A mira no centro aponta para a coordenada exata.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-amber-900 px-2.5 py-1 rounded-xl text-[11px] font-mono border border-amber-700">
                    Pontos: {polygonPoints.length}
                  </span>
                </div>
              </div>
            )}

            {/* LEAFLET MAP CONTAINER WITH EXPLICIT STYLES AND REFRESH BUTTON */}
            <div
              className="relative w-full h-[400px] sm:h-[480px] md:h-[550px] rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl z-10 bg-[#e5e3df]"
              style={{ position: 'relative', width: '100%', backgroundColor: '#e5e3df' }}
            >
              <div
                ref={mapContainerRef}
                className="w-full h-full bg-[#e5e3df]"
                style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#e5e3df', zIndex: 1 }}
              />

              {/* FIXED CENTRAL CROSSHAIR OVERLAY */}
              {modoMapeamento === 'POLIGONO' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[450] pointer-events-none flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center">
                    {/* Outer glowing ring */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.7)] flex items-center justify-center animate-pulse">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-amber-400 rounded-full shadow-md" />
                    </div>
                    {/* Vertical hair line */}
                    <div className="absolute w-[2px] h-12 sm:h-16 bg-amber-400/80" />
                    {/* Horizontal hair line */}
                    <div className="absolute h-[2px] w-12 sm:w-16 bg-amber-400/80" />
                  </div>
                  {/* Floating live coordinate badge */}
                  <div className="mt-1 bg-slate-900/95 text-amber-300 font-mono text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/60 shadow-lg">
                    🎯 Mira: {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
                  </div>
                </div>
              )}

              {/* DISCRETE MAP RELOAD BUTTON (TOP-RIGHT OVERLAY) */}
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[500]">
                <button
                  type="button"
                  onClick={handleReloadMap}
                  className="bg-slate-900/95 hover:bg-slate-800 text-purple-200 hover:text-white font-extrabold text-[10px] sm:text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-purple-500/60 shadow-xl flex items-center gap-1.5 backdrop-blur-xs transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Forçar recalculo de tamanho (invalidateSize) e recarregar tiles do mapa"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-purple-400 shrink-0 ${isRefreshingMap ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">🔄 Recarregar</span>
                  <span className="xs:hidden">🔄</span>
                </button>
              </div>

              {/* Status Badge Overlay */}
              {overpassStatusText && (
                <div className="absolute top-2 left-2 right-12 sm:top-3 sm:left-3 sm:right-auto z-[500] bg-slate-900/95 text-white text-[10px] sm:text-xs font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl border border-purple-500 shadow-xl flex items-center gap-2 max-w-full sm:max-w-md animate-fadeIn">
                  {isQueryingOverpass ? (
                    <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{overpassStatusText}</span>
                </div>
              )}

              {/* FLOATING MOBILE CONTROL PANEL FOR POLYGON MAPPING */}
              {modoMapeamento === 'POLIGONO' ? (
                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 z-[500] bg-slate-900/95 border-2 border-amber-500/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-2xl backdrop-blur-md space-y-2">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs font-black text-amber-200 px-1 border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                      <span className="truncate">Controles Mobile (Mira)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-amber-950 text-amber-300 border border-amber-700 px-2 py-0.5 rounded-full font-mono text-[10px] sm:text-[11px]">
                        Pontos: <strong>{polygonPoints.length}</strong>
                      </span>
                      {polygonPoints.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearPolygonPoints}
                          className="text-[10px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Big Touch-Friendly Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5">
                    {/* Button 1: Add Point */}
                    <button
                      type="button"
                      onClick={handleAddPointFromCenter}
                      className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-[10px] xs:text-xs sm:text-sm py-2.5 sm:py-3 px-1 sm:px-2 rounded-xl shadow-lg flex items-center justify-center gap-1 cursor-pointer transition-all border border-amber-300"
                    >
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 stroke-[3] shrink-0" />
                      <span>➕ Marcar</span>
                    </button>

                    {/* Button 2: Undo Last Point */}
                    <button
                      type="button"
                      onClick={handleUndoLastPoint}
                      disabled={polygonPoints.length === 0}
                      className="bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-40 text-slate-200 font-extrabold text-[10px] xs:text-xs sm:text-sm py-2.5 sm:py-3 px-1 sm:px-2 rounded-xl shadow-md flex items-center justify-center gap-1 cursor-pointer transition-all border border-slate-700"
                    >
                      <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                      <span>↩️ Desfazer</span>
                    </button>

                    {/* Button 3: Finish Geofence */}
                    <button
                      type="button"
                      onClick={handleFinishPolygonGeofence}
                      className={`font-black text-[10px] xs:text-xs sm:text-sm py-2.5 sm:py-3 px-1 sm:px-2 rounded-xl shadow-lg flex items-center justify-center gap-1 cursor-pointer transition-all border ${
                        polygonPoints.length >= 3
                          ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border-emerald-400 shadow-emerald-950/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 opacity-60'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200 stroke-[3] shrink-0" />
                      <span>✅ Finalizar</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Map Footer Helper Instructions (RAIO MODE) */
                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 z-[500] bg-slate-900/90 text-slate-200 text-[10px] sm:text-xs px-3 py-2 sm:px-4 rounded-xl border border-slate-700 backdrop-blur-xs flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1">
                  <span>
                    💡 <strong>Instruções:</strong> Arraste o pino central lilás ou toque em qualquer ponto do mapa.
                  </span>
                  <span className="font-mono text-purple-300 text-[10px] sm:text-[11px] font-bold shrink-0">
                    Lat: {centerLat.toFixed(5)} | Lng: {centerLng.toFixed(5)}
                  </span>
                </div>
              )}
            </div>

            {/* SECTION 1.5: ENDEREÇOS / PRÉDIOS EXCLUÍDOS DESTA CERCA (EXCEÇÃO MANUAL) */}
            <div className="bg-rose-950/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border-2 border-rose-800/80 shadow-lg space-y-3 text-white">
              <div className="flex items-start gap-2 border-b border-rose-800/80 pb-2.5">
                <span className="text-lg sm:text-xl">🚫</span>
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-rose-100 flex flex-wrap items-center gap-2">
                    <span>Endereços Excluídos desta Cerca (Exceção)</span>
                    <span className="text-[10px] bg-rose-900 text-rose-200 border border-rose-600 px-2 py-0.5 rounded-full font-mono">
                      {excludedAddresses.length} Exceções
                    </span>
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-rose-200/90 mt-0.5 leading-snug">
                    Se um número de prédio ou rua na pista for inserido aqui, o sistema DEVE IGNORAR a Cerca Virtual para esse endereço específico e mantê-lo como entrega de Rua Comum.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={manualExcludedInput}
                  onChange={(e) => setManualExcludedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddExcludedAddress();
                    }
                  }}
                  placeholder="Ex: Av. Brasil 1200 - Edifício Caju, Rua do Caju 45..."
                  className="flex-1 bg-slate-900 border border-rose-700/80 rounded-xl sm:rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-white placeholder-rose-300/50 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={handleAddExcludedAddress}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-2.5 rounded-xl sm:rounded-2xl shadow-md cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1 w-full sm:w-auto"
                >
                  <span>+ Excluir Endereço</span>
                </button>
              </div>

              {excludedAddresses.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {excludedAddresses.map((addr) => (
                    <span
                      key={addr}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-rose-900/90 text-rose-100 border border-rose-600 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-xs"
                    >
                      <span>🚫 {addr}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExcludedAddress(addr)}
                        className="text-rose-300 hover:text-white cursor-pointer text-sm font-bold ml-1"
                        title="Remover exceção"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: AUTOMATICALLY DETECTED & LINKED STREETS */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-black text-sm sm:text-base text-slate-900 flex flex-wrap items-center gap-2">
                  <span>🛣️ Ruas & Comunidades Vinculadas à Associação</span>
                  <span className="text-xs font-extrabold bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full border border-purple-300">
                    {linkedStreets.length} Ruas
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pacotes com endereço em qualquer destas ruas serão automaticamente agrupados na Saca desta Associação.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleQueryOverpassStreets()}
                className="text-xs font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar do Mapa</span>
              </button>
            </div>

            {/* Street Tags Grid */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 min-h-[50px] p-2.5 sm:p-3 bg-slate-50 rounded-2xl border border-slate-200">
              {linkedStreets.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Nenhuma rua vinculada ainda. Clique no botão "⚡ Detecção de Ruas" acima ou adicione abaixo nas exceções.
                </p>
              ) : (
                linkedStreets.map((street) => (
                  <span
                    key={street}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-purple-50 text-purple-950 border border-purple-200 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-2xs"
                  >
                    <span>{street}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStreet(street)}
                      className="text-purple-400 hover:text-purple-800 cursor-pointer text-sm font-bold ml-1"
                      title="Remover rua"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* SECTION 3: EXCEÇÕES E AJUSTES FINAIS */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4 sm:space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
                <span>Exceções e Ajustes Finais (Opcional & Regras)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina o nome oficial da Associação, o recebedor padrão na sede e adicione exceções manuais de ruas ou moradores.
              </p>
            </div>

            <form onSubmit={handleSaveAssociation} className="space-y-4 sm:space-y-5">
              {/* Core Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Nome da Associação / Comunidade: *
                  </label>
                  <input
                    type="text"
                    value={assocName}
                    onChange={(e) => setAssocName(e.target.value)}
                    placeholder="Ex: Associação do Cremate & Morro da Paz"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl sm:rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    Recebedor Padrão (Quem recebe na Sede): *
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Ex: Sede da Associação (Sr. Antenor / Dona Maria)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl sm:rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              {/* Exception 1: Manual Streets */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-800">
                  Adicionar Rua Pertencente (Exceções Manuais fora do Mapa):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualStreetInput}
                    onChange={(e) => setManualStreetInput(e.target.value)}
                    placeholder="Ex: Travessa da União, Beco das Flores..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl sm:rounded-2xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualStreet}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-2xl cursor-pointer w-full sm:w-auto shrink-0"
                  >
                    + Adicionar Rua
                  </button>
                </div>
              </div>

              {/* Exception 2: Manual Residents */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-800">
                  Adicionar Nome do Morador (Para endereços genéricos ou apelidos):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualResidentInput}
                    onChange={(e) => setManualResidentInput(e.target.value)}
                    placeholder="Ex: Seu Zé da Horta, Dona Sebastiana..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl sm:rounded-2xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualResident}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-2xl cursor-pointer w-full sm:w-auto shrink-0"
                  >
                    + Adicionar Morador
                  </button>
                </div>

                {linkedResidents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {linkedResidents.map((res) => (
                      <span
                        key={res}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl"
                      >
                        👤 {res}
                        <button
                          type="button"
                          onClick={() => handleRemoveResident(res)}
                          className="text-amber-500 hover:text-amber-800 ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleResetEditor}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl sm:rounded-2xl cursor-pointer w-full sm:w-auto"
                >
                  Limpar Formulário
                </button>

                <button
                  type="submit"
                  className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-900 text-white font-black text-xs sm:text-sm px-6 sm:px-8 py-3.5 rounded-xl sm:rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 w-full sm:w-auto"
                >
                  <CheckCircle2 className="w-5 h-5 text-purple-200 shrink-0" />
                  <span>✅ Salvar Associação e Criar Saca</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB TAB 2: ACTIVE ASSOCIATIONS LIST */}
      {activeSubTab === 'list' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Associações Comunitárias Mapeadas ({associations.length})
              </h3>
              <p className="text-xs text-slate-500">
                Lista de sacas ativas com regras de Cerca Virtual e recebedores padrão.
              </p>
            </div>

            <button
              onClick={() => {
                handleResetEditor();
                setActiveSubTab('editor');
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nova Associação</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {associations.map((assoc) => (
              <div
                key={assoc.id}
                className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4 hover:border-purple-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-purple-800 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 inline-block">
                      ID Saca: {assoc.id}
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                      {assoc.nome}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => handleLoadAssociationForEdit(assoc)}
                      className="text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border border-purple-200"
                    >
                      <Edit3 className="w-3.5 h-3.5 shrink-0" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeleteAssociation(assoc.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl cursor-pointer transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 text-xs">
                  <span className="text-slate-500 font-bold block">🏢 Recebedor Padrão na Sede:</span>
                  <strong className="text-slate-900 text-xs sm:text-sm font-black">{assoc.recebedor_padrao}</strong>
                </div>

                {assoc.moradores && assoc.moradores.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-700">👤 Moradores Mapeados ({assoc.moradores.length}):</span>
                    <div className="flex flex-wrap gap-1">
                      {assoc.moradores.map((m, i) => (
                        <span key={i} className="text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {assoc.excecoes_enderecos && assoc.excecoes_enderecos.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-rose-700">🚫 Endereços Excluídos / Rua Comum ({assoc.excecoes_enderecos.length}):</span>
                    <div className="flex flex-wrap gap-1">
                      {assoc.excecoes_enderecos.map((ex, i) => (
                        <span key={i} className="text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-200 px-2 py-0.5 rounded-lg">
                          🚫 {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700">🛣️ Ruas Vinculadas ({assoc.ruas.length}):</span>
                  <div className="flex flex-wrap gap-1">
                    {assoc.ruas.map((st) => (
                      <span key={st} className="text-[11px] font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {st}
                      </span>
                    ))}
                  </div>
                </div>

                {assoc.cerca_virtual && (
                  <div className="pt-2 border-t border-slate-100 text-[11px] font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">Cerca Virtual Ativa: {assoc.cerca_virtual.descricao_area || 'Geofence Ativo'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
