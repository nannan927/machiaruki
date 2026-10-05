"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Memo } from "@/types/memo";
import { memoLabel, type MapBounds, type Point } from "@/lib/walking-data";
type Props = { showCenterSelect?: boolean; owner: string; memos: Memo[]; selected: Point | null; focus: Point | null; location: (Point & { accuracy: number }) | null; onSelect: (point: Point) => void; onBounds: (bounds: MapBounds) => void; onOpen: (memos: Memo[]) => void };
export function WalkingMap(props: Props) {
  const host = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null);
  const callbacks = useRef(props); const tile = useRef<L.TileLayer | null>(null);
  const [ready, setReady] = useState(false); const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => { callbacks.current = props; }, [props]);
  useEffect(() => {
    if (!host.current) return;
    let center: L.LatLngExpression = [36.7411, 137.0154]; let zoom = 16;
    try { const saved = JSON.parse(localStorage.getItem(`machinote-view:${props.owner}`) || "null"); if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng) && Math.abs(saved.lat) <= 85 && Math.abs(saved.lng) <= 180 && saved.zoom >= 5 && saved.zoom <= 20) { center = [saved.lat, saved.lng]; zoom = saved.zoom; } } catch { /* A viewport preference is optional. */ }
    const instance = L.map(host.current, { center, zoom, minZoom: 5, maxZoom: 20, zoomControl: false, zoomAnimation: false, scrollWheelZoom: false, maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 1 });
    map.current = instance;
    L.control.zoom({ position: "topright", zoomInTitle: "拡大", zoomOutTitle: "縮小" }).addTo(instance);
    instance.attributionControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');
    const layer = L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", { noWrap: true, maxNativeZoom: 18, maxZoom: 20, keepBuffer: 1, updateWhenIdle: true, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>' });
    tile.current = layer; let failed = false; let timer: ReturnType<typeof setTimeout>;
    layer.on("loading", () => { failed = false; clearTimeout(timer); timer = setTimeout(() => setError(true), 12000); });
    layer.on("tileerror", () => { failed = true; setError(true); });
    layer.on("load", () => { clearTimeout(timer); setError(failed); }); layer.addTo(instance);
    function changed() {
      const b = instance.getBounds(); const c = instance.getCenter().wrap();
      callbacks.current.onBounds({ west: Math.max(-180, b.getWest()), south: Math.max(-85, b.getSouth()), east: Math.min(180, b.getEast()), north: Math.min(85, b.getNorth()) });
      setRevision(n => n + 1);
      try { localStorage.setItem(`machinote-view:${props.owner}`, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: instance.getZoom() })); } catch { /* Map use remains available. */ }
    }
    instance.on("moveend", changed);
    instance.on("click", (event: L.LeafletMouseEvent) => { const p = event.latlng.wrap(); callbacks.current.onSelect({ lat: p.lat, lng: p.lng }); });
    const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false })); resize.observe(host.current);
    const frame = requestAnimationFrame(() => { setReady(true); changed(); });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); resize.disconnect(); layer.off(); instance.remove(); map.current = null; };
  }, [props.owner]);
  useEffect(() => { if (ready && props.focus && map.current) map.current.setView([props.focus.lat, props.focus.lng], Math.max(16, map.current.getZoom()), { animate: false }); }, [props.focus, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current; const layer = L.layerGroup().addTo(instance);
    const cells = new Map<string, Memo[]>(); const cellSize = instance.getZoom() >= 18 ? 35 : 75;
    for (const memo of props.memos) {
      const p = instance.latLngToLayerPoint([memo.lat, memo.lng]); const cell = `${Math.floor(p.x / cellSize)}:${Math.floor(p.y / cellSize)}`;
      cells.set(cell, [...(cells.get(cell) ?? []), memo]);
    }
    const labels: L.Point[] = [];
    for (const group of cells.values()) {
      const first = group[0]; const dot = document.createElement("span");
      dot.className = group.length > 1 ? "walkingCluster" : "memoMapDot"; dot.textContent = group.length > 1 ? String(group.length) : "";
      const label = group.length > 1 ? `この場所に${group.length}つの記録` : memoLabel(first);
      const marker = L.marker([first.lat, first.lng], { title: label, keyboard: true, icon: L.divIcon({ className: "walkingMarker", html: dot, iconSize: [40, 44], iconAnchor: [20, 44] }) }).addTo(layer);
      marker.getElement()?.setAttribute("aria-label", label);
      const p = instance.latLngToContainerPoint([first.lat, first.lng]);
      if (group.length === 1 && !labels.some(other => Math.abs(other.x - p.x) < 180 && Math.abs(other.y - p.y) < 55)) {
        const text = document.createElement("span"); text.textContent = label;
        marker.bindTooltip(text, { permanent: true, direction: "top", offset: [0, -35], className: "memoMapLabel" }); labels.push(p);
      }
      marker.on("click", () => callbacks.current.onOpen(group));
    }
    return () => { layer.eachLayer(item => item.off()); layer.remove(); };
  }, [props.memos, ready, revision]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const layer = L.layerGroup().addTo(map.current);
    if (props.selected) L.circleMarker([props.selected.lat, props.selected.lng], { radius: 10, color: "#fff", weight: 3, fillColor: "#ac572e", fillOpacity: 1, interactive: false }).addTo(layer);
    if (props.location) {
      const loc = props.location;
      L.circle([loc.lat, loc.lng], { radius: loc.accuracy, color: "#376bc2", weight: 1, fillOpacity: .08, interactive: false }).addTo(layer);
      L.circleMarker([loc.lat, loc.lng], { radius: 5, color: "white", fillColor: "#376bc2", fillOpacity: 1, interactive: false }).addTo(layer);
    }
    return () => { layer.remove(); };
  }, [ready, props.selected, props.location]);
  return <><div className="mapStage walkingMap" ref={host} role="region" aria-label="思い出の地図" /><button hidden={props.showCenterSelect === false} className="mapCenterSelect" onClick={() => { const p = map.current?.getCenter().wrap(); if (p) props.onSelect({ lat: p.lat, lng: p.lng }); }}>地図の中央を選ぶ</button>{error && <p className="error" role="alert">背景地図を取得できません。現在地や選択済みの場所で記録できます。<button onClick={() => tile.current?.redraw()}>地図を再読み込み</button></p>}</>;
}
