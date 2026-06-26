'use client';
/* Mapa real (Leaflet + OpenStreetMap, sin API key) para marcar la ubicación
   EXACTA del reporte. Clic en el mapa = pin con lat/lng. */
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const PIN_HTML =
  '<svg width="30" height="30" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">' +
  '<path d="M12 2C8.7 2 6 4.7 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z" fill="#E4002B"/>' +
  '<circle cx="12" cy="8" r="2.4" fill="#fff"/></svg>';

export default function RealMapPicker({ value, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Inicializa el mapa una sola vez (solo en cliente).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const start = value && value.lat ? [value.lat, value.lng] : [10.4806, -66.9036]; // Caracas por defecto
      const map = L.map(elRef.current, { zoomControl: true, attributionControl: true })
        .setView(start, value && value.lat ? 15 : 6);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap',
      }).addTo(map);

      const icon = L.divIcon({ className: 'rmp-pin', html: PIN_HTML, iconSize: [30, 30], iconAnchor: [15, 28] });
      const place = (lat, lng) => {
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        else markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      };
      if (value && value.lat) place(value.lat, value.lng);
      map.on('click', (e) => { place(e.latlng.lat, e.latlng.lng); onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }); });
      setTimeout(() => map.invalidateSize(), 120);
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Si llega una ubicación externa (GPS), centra el mapa y mueve el pin.
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map || !value || !value.lat) return;
    const icon = L.divIcon({ className: 'rmp-pin', html: PIN_HTML, iconSize: [30, 30], iconAnchor: [15, 28] });
    if (markerRef.current) markerRef.current.setLatLng([value.lat, value.lng]);
    else markerRef.current = L.marker([value.lat, value.lng], { icon }).addTo(map);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
  }, [value]);

  return <div ref={elRef} className="real-map" />;
}
