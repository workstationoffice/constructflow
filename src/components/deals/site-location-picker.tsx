"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Search, X, Navigation, Hash, Loader2 } from "lucide-react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

interface Props {
  value: string;
  lat: number | null;
  lng: number | null;
  onChange: (location: string, lat: number | null, lng: number | null) => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Load once and cache the promise
let mapsPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (!API_KEY) return Promise.reject(new Error("No API key"));
  if (!mapsPromise) {
    setOptions({ key: API_KEY, v: "weekly" });
    mapsPromise = importLibrary("maps")
      .then(() => importLibrary("places"))
      .then(() => importLibrary("marker"))
      .then(() => undefined);
  }
  return mapsPromise;
}

export default function SiteLocationPicker({ value, lat, lng, onChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<google.maps.Map | null>(null);
  const markerRef        = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const autocompleteRef  = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef   = useRef<HTMLInputElement>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [mode, setMode]           = useState<"search" | "coord">("search");
  const [coordInput, setCoordInput] = useState(
    lat != null && lng != null ? `${lat}, ${lng}` : ""
  );
  const [coordError, setCoordError] = useState("");
  const [showMap, setShowMap]       = useState(lat != null && lng != null);

  // Load Maps SDK
  useEffect(() => {
    if (!API_KEY) return;
    setLoading(true);
    loadMaps()
      .then(() => { setMapsReady(true); setLoading(false); })
      .catch(() => { setMapsError(true); setLoading(false); });
  }, []);

  // Initialise / update map when showMap becomes true
  const initMap = useCallback((position: { lat: number; lng: number }) => {
    if (!mapContainerRef.current || !mapsReady) return;

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: position,
        zoom: 15,
        mapId: "buildflow-site",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
    }

    if (!markerRef.current) {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        gmpDraggable: true,
        title: "Site location",
      });
      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current!.position as google.maps.LatLng;
        if (pos) {
          const newLat = pos.lat();
          const newLng = pos.lng();
          onChange(value, newLat, newLng);
          setCoordInput(`${newLat.toFixed(6)}, ${newLng.toFixed(6)}`);
        }
      });
    } else {
      markerRef.current.position = position;
    }

    mapRef.current.panTo(position);
    mapRef.current.setZoom(15);
  }, [mapsReady, onChange, value]);

  // When existing lat/lng + maps loaded, show the map
  useEffect(() => {
    if (!mapsReady || !showMap || lat == null || lng == null) return;
    setTimeout(() => initMap({ lat, lng }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady, showMap]);

  // Attach Places Autocomplete
  useEffect(() => {
    if (!mapsReady || mode !== "search" || !searchInputRef.current) return;
    if (autocompleteRef.current) return;

    const ac = new google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ["geometry", "formatted_address", "name"],
    });
    autocompleteRef.current = ac;

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      const newLat = loc.lat();
      const newLng = loc.lng();
      const label = place.name ?? place.formatted_address ?? "";
      onChange(label, newLat, newLng);
      setCoordInput(`${newLat.toFixed(6)}, ${newLng.toFixed(6)}`);
      setShowMap(true);
      setTimeout(() => initMap({ lat: newLat, lng: newLng }), 50);
    });
  }, [mapsReady, mode, initMap, onChange]);

  useEffect(() => {
    if (mode === "coord") autocompleteRef.current = null;
  }, [mode]);

  const applyCoords = () => {
    setCoordError("");
    const parts = coordInput.split(",").map((s) => s.trim());
    if (parts.length !== 2) { setCoordError("Enter as: lat, lng"); return; }
    const newLat = parseFloat(parts[0]);
    const newLng = parseFloat(parts[1]);
    if (isNaN(newLat) || isNaN(newLng)) { setCoordError("Invalid numbers"); return; }
    if (newLat < -90 || newLat > 90) { setCoordError("Latitude must be -90 to 90"); return; }
    if (newLng < -180 || newLng > 180) { setCoordError("Longitude must be -180 to 180"); return; }
    const label = value || `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
    onChange(label, newLat, newLng);
    setShowMap(true);
    setTimeout(() => initMap({ lat: newLat, lng: newLng }), 50);
  };

  const clearLocation = () => {
    onChange("", null, null);
    setCoordInput("");
    setCoordError("");
    setShowMap(false);
    if (markerRef.current) { markerRef.current.map = null; markerRef.current = null; }
    mapRef.current = null;
    if (searchInputRef.current) searchInputRef.current.value = "";
  };

  const hasLocation = lat != null && lng != null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-slate-400" />
        Site Location
        <span className="text-slate-400 font-normal text-xs">(optional)</span>
      </label>

      {/* Mode toggle — only when Maps is ready */}
      {mapsReady && (
        <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit text-xs font-medium">
          <button type="button" onClick={() => setMode("search")}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${mode === "search" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <Search className="w-3 h-3" /> Search
          </button>
          <button type="button" onClick={() => setMode("coord")}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-slate-200 ${mode === "coord" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <Hash className="w-3 h-3" /> Coordinates
          </button>
        </div>
      )}

      {/* Search input */}
      {(mode === "search" || !mapsReady) && (
        <div className="relative">
          <div className="flex items-center border-2 border-slate-200 rounded-xl focus-within:border-violet-500 transition-colors overflow-hidden">
            {loading
              ? <Loader2 className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 animate-spin" />
              : mapsReady
                ? <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
                : <MapPin className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
            }
            <input
              ref={searchInputRef}
              type="text"
              defaultValue={value}
              onChange={(e) => {
                if (!mapsReady || mapsError) onChange(e.target.value, lat, lng);
              }}
              placeholder={mapsReady ? "Search for a place…" : "e.g. Silom Complex, Bangkok"}
              className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent"
            />
            {(value || hasLocation) && (
              <button type="button" onClick={clearLocation} className="mr-3 text-slate-300 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Coordinate input */}
      {mode === "coord" && mapsReady && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Navigation className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                placeholder="13.756331, 100.501765"
                className={`w-full border-2 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${coordError ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-violet-500"}`}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyCoords())}
              />
            </div>
            <button type="button" onClick={applyCoords}
              className="bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors shrink-0">
              Pin
            </button>
          </div>
          {coordError && <p className="text-xs text-red-500">{coordError}</p>}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value, lat, lng)}
            placeholder="Location label (optional)"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
      )}

      {/* Map */}
      {showMap && hasLocation && (
        <div className="space-y-1">
          <div ref={mapContainerRef} className="w-full h-52 rounded-xl border-2 border-slate-200 overflow-hidden" />
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            {lat!.toFixed(6)}, {lng!.toFixed(6)}
            <span className="ml-1 text-slate-300">— drag the pin to adjust</span>
          </p>
        </div>
      )}

      {/* No API key notice */}
      {!API_KEY && !loading && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable map search and pin placement.
        </p>
      )}
    </div>
  );
}
