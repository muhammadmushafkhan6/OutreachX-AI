import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapLead } from "@/types";
import { geocodeLocation, getLeadCoordinates, resolveLocationCoords, CityCoord } from "@/lib/geo";

interface BusinessMapProps {
  leads: MapLead[];
  selectedLead: MapLead | null;
  onSelectLead: (lead: MapLead) => void;
  city?: string;
  country?: string;
  isLoading?: boolean;
}

type MapFilter = "all" | "high" | "medium" | "low" | "has_website" | "has_email" | "no_website";

// Custom dark map style (matches app theme)
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0d121c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d121c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e2433" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0d121c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#263046" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0b8c8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#060c18" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#374151" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f1a10" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#131d2e" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#374151" }] },
];

// Singleton loader — loads Google Maps JS API only once
let gmapsPromise: Promise<void> | null = null;
function loadGoogleMapsAPI(apiKey: string): Promise<void> {
  if (gmapsPromise) return gmapsPromise;
  if (typeof window !== "undefined" && (window as any).google?.maps) {
    gmapsPromise = Promise.resolve();
    return gmapsPromise;
  }
  gmapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      // Already injected — wait for it
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    // No "marker" library — use classic Marker (no mapId required)
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return gmapsPromise;
}

export function BusinessMap({
  leads,
  selectedLead,
  onSelectLead,
  city = "Manchester",
  country = "UK",
  isLoading = false,
}: BusinessMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<"dark" | "streets">("dark");
  const [loadError, setLoadError] = useState(false);

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const lastFittedCountRef = useRef(0);

  const [targetCityCoords, setTargetCityCoords] = useState<CityCoord>(() =>
    resolveLocationCoords(city, country)
  );

  // Geocode city when it changes
  useEffect(() => {
    let alive = true;
    if (!city.trim()) return;
    geocodeLocation(city, country).then((coord) => {
      if (alive) setTargetCityCoords(coord);
    });
    return () => { alive = false; };
  }, [city, country]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const score = (lead.lead_score || "HIGH").toUpperCase();
      const hasEmail = Boolean(lead.email || (lead.emails && lead.emails.length > 0));
      const hasWebsite = Boolean(lead.website && lead.website.trim() !== "");
      if (filter === "high") return score === "HIGH";
      if (filter === "medium") return score === "MEDIUM";
      if (filter === "low") return score === "LOW";
      if (filter === "has_email") return hasEmail;
      if (filter === "has_website") return hasWebsite;
      if (filter === "no_website") return !hasWebsite;
      return true;
    });
  }, [leads, filter]);

  const leadsWithCoords = useMemo(() => {
    return filteredLeads.map((lead) => ({
      lead,
      coords: getLeadCoordinates(lead, targetCityCoords),
    }));
  }, [filteredLeads, targetCityCoords]);

  // Initialize Google Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

    loadGoogleMapsAPI(apiKey)
      .then(() => {
        if (!mapContainerRef.current) return;

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: targetCityCoords.lat, lng: targetCityCoords.lng },
          zoom: targetCityCoords.zoom || 13,
          // No mapId — works with classic Marker, no billing restriction
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
          },
          styles: DARK_MAP_STYLES,
          backgroundColor: "#0d121c",
          gestureHandling: "greedy",
        });

        infoWindowRef.current = new window.google.maps.InfoWindow({
          disableAutoPan: false,
        });

        mapInstanceRef.current = map;
        setMapReady(true);
      })
      .catch(() => setLoadError(true));

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapInstanceRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle dark / streets style
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({
      styles: mapStyle === "dark" ? DARK_MAP_STYLES : [],
      mapTypeId: mapStyle === "streets"
        ? window.google.maps.MapTypeId.ROADMAP
        : window.google.maps.MapTypeId.ROADMAP,
    });
  }, [mapStyle, mapReady]);

  // Update center when city changes and no leads
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || leads.length > 0) return;
    mapInstanceRef.current.panTo({ lat: targetCityCoords.lat, lng: targetCityCoords.lng });
    mapInstanceRef.current.setZoom(targetCityCoords.zoom || 13);
  }, [targetCityCoords, mapReady, leads.length]);

  // Popup HTML
  const createInfoContent = useCallback((lead: MapLead) => {
    const score = (lead.lead_score || "HIGH").toUpperCase();
    const hasWebsite = Boolean(lead.website && lead.website.trim() !== "");
    const email = lead.email || (lead.emails && lead.emails[0]);
    const phone = lead.phone || lead.whatsapp;
    const opportunity =
      lead.recommended_service ||
      (!hasWebsite ? "Complete Website Build + Local SEO" : "Modern Redesign + Lead Funnel");

    return `
      <div style="font-family:system-ui,sans-serif;color:#fff;background:#0d121c;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);width:260px;box-shadow:0 16px 32px rgba(0,0,0,0.75);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:9px;font-weight:800;text-transform:uppercase;padding:2px 7px;border-radius:9999px;background:${score === "HIGH" ? "rgba(170,255,0,0.15)" : "rgba(255,255,255,0.1)"};color:${score === "HIGH" ? "#AAFF00" : "#94a3b8"};border:1px solid ${score === "HIGH" ? "rgba(170,255,0,0.3)" : "rgba(255,255,255,0.15)"};">${score} Priority</span>
          ${lead.rating ? `<span style="font-size:11px;font-weight:700;color:#e2e8f0;">★ ${lead.rating.toFixed(1)} ${lead.reviews ? `<span style="color:#64748b;font-size:10px;">(${lead.reviews})</span>` : ""}</span>` : ""}
        </div>
        <h4 style="font-size:13px;font-weight:800;margin:0 0 2px 0;color:#fff;line-height:1.3;">${lead.business_name}</h4>
        ${lead.category ? `<p style="font-size:10px;color:#94a3b8;margin:0 0 8px 0;">${lead.category}</p>` : ""}
        <div style="padding:6px 0;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);margin:6px 0;font-size:11px;">
          ${hasWebsite
            ? `<div style="display:flex;align-items:center;gap:6px;color:#e2e8f0;margin-bottom:3px;"><span>🌐</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${lead.website!.replace(/^https?:\/\//, "")}</span></div>`
            : `<div style="display:flex;align-items:center;gap:6px;color:#f87171;margin-bottom:3px;"><span>⚠️</span><span style="font-weight:600;">No Website Found</span></div>`
          }
          ${email ? `<div style="display:flex;align-items:center;gap:6px;color:#cbd5e1;margin-bottom:3px;"><span>✉️</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${email}</span></div>` : ""}
          ${phone ? `<div style="display:flex;align-items:center;gap:6px;color:#94a3b8;"><span>📞</span><span>${phone}</span></div>` : ""}
        </div>
        <div style="margin:6px 0 10px 0;">
          <span style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;">Opportunity</span>
          <p style="font-size:11px;color:#cbd5e1;margin:1px 0 0 0;line-height:1.3;">${opportunity}</p>
        </div>
        <button id="btn-view-lead-${lead.id}" style="width:100%;padding:7px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:background 0.15s;">
          View Lead Details →
        </button>
      </div>
    `;
  }, []);

  // Render custom HTML markers (overlay-based, no AdvancedMarker needed)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.google?.maps) return;
    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (leadsWithCoords.length === 0) {
      map.panTo({ lat: targetCityCoords.lat, lng: targetCityCoords.lng });
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();

    leadsWithCoords.forEach(({ lead, coords }) => {
      const score = (lead.lead_score || "HIGH").toUpperCase();
      const isSelected = selectedLead?.id === lead.id;
      const isHigh = score === "HIGH";
      const cleanName = (lead.business_name || "Lead").trim();
      const shortName = cleanName.length > 20 ? cleanName.slice(0, 18) + "…" : cleanName;

      // Build custom SVG/HTML icon as a data URI
      const label = `
        <svg xmlns="http://www.w3.org/2000/svg" width="170" height="36">
          <defs>
            <filter id="shadow">
              <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.6)"/>
            </filter>
          </defs>
          <rect rx="18" ry="18" width="170" height="28" fill="${isSelected ? "#0d131f" : "rgba(13,18,28,0.94)"}"
            stroke="${isSelected ? "#AAFF00" : "rgba(255,255,255,0.18)"}" stroke-width="${isSelected ? 2 : 1.2}"
            filter="url(#shadow)"/>
          <circle cx="16" cy="14" r="4"
            fill="${isHigh ? "#AAFF00" : "#64748b"}"
            ${isHigh ? 'filter="url(#shadow)"' : ""}/>
          <text x="26" y="19" font-family="system-ui,sans-serif" font-size="11" font-weight="700"
            fill="#ffffff" dominant-baseline="middle">${shortName}${lead.rating ? ` ${lead.rating.toFixed(1)}★` : ""}</text>
          <!-- caret -->
          <polygon points="81,28 88,36 95,28" fill="${isSelected ? "#AAFF00" : "rgba(13,18,28,0.94)"}"/>
        </svg>
      `;

      const svgBlob = new Blob([label], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);

      const marker = new window.google.maps.Marker({
        position: { lat: coords.lat, lng: coords.lng },
        map,
        icon: {
          url,
          scaledSize: new window.google.maps.Size(170, 36),
          anchor: new window.google.maps.Point(85, 36),
        },
        zIndex: isSelected ? 1000 : isHigh ? 500 : 100,
        title: lead.business_name,
      });

      marker.addListener("click", () => {
        onSelectLead(lead);
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(createInfoContent(lead));
          infoWindowRef.current.open(map, marker);
          setTimeout(() => {
            const btn = document.getElementById(`btn-view-lead-${lead.id}`);
            if (btn) btn.onclick = () => onSelectLead(lead);
          }, 80);
        }
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: coords.lat, lng: coords.lng });
    });

    // Auto-fit on new batches
    if (Math.abs(leadsWithCoords.length - lastFittedCountRef.current) >= 4) {
      lastFittedCountRef.current = leadsWithCoords.length;
      map.fitBounds(bounds, 60);
    }
  }, [leadsWithCoords, selectedLead, mapReady, onSelectLead, createInfoContent, targetCityCoords]);

  // Pan to selected lead
  useEffect(() => {
    if (!selectedLead || !mapReady || !mapInstanceRef.current) return;
    const coords = getLeadCoordinates(selectedLead, targetCityCoords);
    mapInstanceRef.current.panTo({ lat: coords.lat, lng: coords.lng });
    mapInstanceRef.current.setZoom(15);
  }, [selectedLead, mapReady, targetCityCoords]);

  const handleRecenter = () => {
    if (!mapReady || !mapInstanceRef.current || !window.google?.maps) return;
    if (leadsWithCoords.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      leadsWithCoords.forEach(({ coords }) => bounds.extend({ lat: coords.lat, lng: coords.lng }));
      mapInstanceRef.current.fitBounds(bounds, 60);
    } else {
      mapInstanceRef.current.panTo({ lat: targetCityCoords.lat, lng: targetCityCoords.lng });
      mapInstanceRef.current.setZoom(targetCityCoords.zoom || 13);
    }
  };

  return (
    <div
      className={`relative rounded-[2rem] border border-white/10 bg-[#0a0d14] overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen ? "fixed inset-4 z-50 rounded-2xl h-[calc(100vh-2rem)]" : "w-full h-[580px] lg:h-[640px]"
      }`}
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-xl border border-white/10 px-3.5 py-1.5 rounded-full shadow-lg pointer-events-auto">
          <span className="inline-flex rounded-full h-2 w-2 bg-primary shadow-[0_0_6px_#AAFF00]" />
          <span className="text-xs font-bold text-foreground">{city}</span>
          <div className="h-3 w-[1px] bg-white/15" />
          <span className="text-[11px] font-medium text-muted-foreground">{filteredLeads.length} leads</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
          <div className="flex items-center bg-black/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-lg gap-1">
            {[
              { id: "all" as const, label: "All" },
              { id: "high" as const, label: "High Priority" },
              { id: "has_website" as const, label: "Has Website" },
              { id: "no_website" as const, label: "No Website" },
              { id: "has_email" as const, label: "Has Email" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  filter === f.id
                    ? "bg-white/10 text-foreground border border-white/15 font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-black/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-lg">
            <Button
              size="icon" variant="ghost"
              onClick={() => setMapStyle(mapStyle === "dark" ? "streets" : "dark")}
              title={mapStyle === "dark" ? "Switch to Streets View" : "Switch to Dark View"}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10"
            >
              <Layers className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost"
              onClick={handleRecenter}
              title="Recenter Map"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Load error fallback */}
      {loadError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0d14]">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Map failed to load.</p>
            <p className="text-xs text-muted-foreground mt-1">Check your Google Maps API key.</p>
          </div>
        </div>
      )}

      {/* Google Map canvas */}
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Scanning indicator */}
      {isLoading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl border border-primary/40 px-4 py-2 rounded-full shadow-xl flex items-center gap-2.5 animate-pulse">
            <Zap className="h-3.5 w-3.5 text-primary animate-spin" />
            <span className="text-xs font-bold text-foreground">Scanning Google Maps in {city}...</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-black/80 backdrop-blur-xl border border-white/10 px-3.5 py-1.5 rounded-full text-xs text-muted-foreground shadow-lg pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#AAFF00] shadow-[0_0_5px_#AAFF00]" />
          <span className="text-foreground text-[11px] font-semibold">High Priority</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-muted-foreground text-[11px]">Standard</span>
        </div>
      </div>
    </div>
  );
}
