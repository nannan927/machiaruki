"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Memo } from "@/types/memo";

type Coords = { lat: number; lng: number };
export type LocatedPosition = Coords & { accuracy: number };
type Props = {
  selected: Coords | null;
  location: LocatedPosition | null;
  memos: Memo[];
  onSelect: (coords: Coords) => void;
  onMemoSelect: (memo: Memo) => void;
};
const defaultCenter: L.LatLngExpression = [36.7411, 137.0154];
const tileUrl = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";

export function MapCanvas({ selected, location, memos, onSelect, onMemoSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const callbacks = useRef({ onSelect, onMemoSelect });
  const [ready, setReady] = useState(false);
  const [tileState, setTileState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { callbacks.current = { onSelect, onMemoSelect }; }, [onSelect, onMemoSelect]);

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, {
      center: defaultCenter, zoom: 16, minZoom: 5, maxZoom: 20,
      zoomControl: false, zoomAnimation: false, scrollWheelZoom: false, worldCopyJump: true,
    });
    map.current = instance;
    L.control.zoom({ zoomInTitle: "拡大", zoomOutTitle: "縮小" }).addTo(instance);
    L.control.scale({ imperial: false }).addTo(instance);
    instance.attributionControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');
    const layer = L.tileLayer(tileUrl, {
      minZoom: 5, maxNativeZoom: 18, maxZoom: 20, noWrap: true,
      updateWhenIdle: true, keepBuffer: 1,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
    });
    tiles.current = layer;
    let failed = false;
    let timer: ReturnType<typeof setTimeout>;
    layer.on("loading", () => {
      failed = false;
      setTileState("loading");
      clearTimeout(timer);
      timer = setTimeout(() => setTileState("error"), 12000);
    });
    layer.on("tileerror", () => { failed = true; setTileState("error"); });
    layer.on("load", () => { clearTimeout(timer); setTileState(failed ? "error" : "ready"); });
    layer.addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) => {
      const point = event.latlng.wrap();
      callbacks.current.onSelect({ lat: point.lat, lng: point.lng });
    });
    const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    resize.observe(host.current);
    const frame = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      resize.disconnect();
      layer.off();
      instance.remove();
      map.current = null;
      tiles.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !selected || !map.current) return;
    const atLocation = selected.lat === location?.lat && selected.lng === location?.lng;
    const zoom = atLocation ? Math.max(16, map.current.getZoom()) : map.current.getZoom();
    map.current.setView([selected.lat, selected.lng], zoom, { animate: false });
  }, [selected, location, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const layer = L.layerGroup().addTo(map.current);
    for (const memo of memos) {
      const label = memo.title || memo.body.slice(0, 40);
      const dot = document.createElement("span");
      dot.className = "memoMapDot";
      // Leaflet accepts HTML strings; use textContent to keep memo text inert.
      const text = document.createElement("span");
      text.textContent = label;
      const marker = L.marker([memo.lat, memo.lng], {
        icon: L.divIcon({ className: "memoMapMarker", html: dot, iconSize: [28, 36], iconAnchor: [14, 36] }),
        title: `${label}を開く`, keyboard: true,
      }).addTo(layer);
      marker.bindTooltip(text, { permanent: true, direction: "top", offset: [0, -34], className: "memoMapLabel" });
      marker.on("click", () => callbacks.current.onMemoSelect(memo));
      marker.on("keydown", (event: L.LeafletKeyboardEvent) => {
        if (event.originalEvent.key === "Enter" || event.originalEvent.key === " ") {
          L.DomEvent.stop(event.originalEvent);
          callbacks.current.onMemoSelect(memo);
        }
      });
      marker.getElement()?.setAttribute("aria-label", `${label}を開く`);
    }
    return () => { layer.eachLayer(item => item.off()); layer.remove(); };
  }, [memos, ready]);

  useEffect(() => {
    if (!ready || !map.current || !selected) return;
    const marker = L.circleMarker([selected.lat, selected.lng], {
      radius: 10, color: "#fff", weight: 3, fillColor: "#ac572e", fillOpacity: 1, interactive: false,
      className: "selectedLocationMarker",
    }).addTo(map.current);
    return () => { marker.remove(); };
  }, [selected, ready]);

  useEffect(() => {
    if (!ready || !map.current || !location) return;
    const point: L.LatLngExpression = [location.lat, location.lng];
    const layer = L.layerGroup([
      L.circle(point, { radius: location.accuracy, color: "#376bc2", weight: 1, fillOpacity: .08, interactive: false, className: "locationAccuracy" }),
      L.circleMarker(point, { radius: 5, color: "#fff", weight: 2, fillColor: "#376bc2", fillOpacity: 1, interactive: false, pane: "markerPane", className: "currentLocationMarker" }),
    ]).addTo(map.current);
    return () => { layer.remove(); };
  }, [location, ready]);

  return <>
    <div ref={host} className="mapStage" role="region" aria-label="メモの地図" />
    <p className="mapLegend">緑：保存した言葉　茶：選択中　青：取得時の現在地</p>
    <button type="button" disabled={!ready} onClick={() => {
      const point = map.current?.getCenter().wrap();
      if (point) onSelect({ lat: point.lat, lng: point.lng });
    }}>地図の中央を選ぶ</button>
    {tileState === "loading" && <p role="status" className="coords">地図を読み込み中…</p>}
    {tileState === "error" && <div className="mapLoadError">
      <p className="error" role="alert">背景地図を読み込めない部分があります。通信状況や表示範囲をご確認ください。現在地・座標からのメモ保存は引き続き使えます。</p>
      <button type="button" onClick={() => tiles.current?.redraw()}>地図を再読み込み</button>
    </div>}
    <p className="coords">日本国内向けの地図です。移動・拡大縮小できます。</p>
  </>;
}
