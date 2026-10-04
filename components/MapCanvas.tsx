"use client";
import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { Memo } from "@/types/memo";

type Coords = { lat: number; lng: number };
type Props = { center: Coords; selected: Coords | null; memos: Memo[]; onSelect: (coords: Coords) => void; onMemoSelect: (memo: Memo) => void };
let configured = false;
export function MapCanvas({ center, selected, memos, onSelect, onMemoSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const callbacks = useRef({ onSelect, onMemoSelect });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => { callbacks.current = { onSelect, onMemoSelect }; }, [onSelect, onMemoSelect]);
  useEffect(() => {
    if (!key) return;
    let active = true;
    let listener: google.maps.MapsEventListener | undefined;
    const authWindow = window as Window & { gm_authFailure?: () => void };
    const previousAuthFailure = authWindow.gm_authFailure;
    const authFailure = () => { if (active) setError("Google Mapsの認証に失敗しました。APIの有効化・請求先・利用サイトの制限を確認してください。"); };
    authWindow.gm_authFailure = authFailure;
    const timeout = window.setTimeout(() => { if (active) setError("地図の読み込みがタイムアウトしました。接続とAPIキーの設定を確認し、ページを再読み込みしてください。"); }, 15000);
    async function init() {
      try {
        if (!configured) { setOptions({ key: key!, v: "weekly", language: "ja", region: "JP" }); configured = true; }
        const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;
        await importLibrary("marker");
        if (!active || !host.current) return;
        map.current = new Map(host.current, { center: { lat: 36.7411, lng: 137.0154 }, zoom: 16, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID", streetViewControl: false, mapTypeControl: false, gestureHandling: "cooperative" });
        listener = map.current.addListener("click", (event: google.maps.MapMouseEvent) => { if (event.latLng) callbacks.current.onSelect(event.latLng.toJSON()); });
        setReady(true); setError("");
      } catch { if (active) setError("地図を読み込めませんでした。接続とAPIキーの設定を確認し、ページを再読み込みしてください。"); }
      finally { window.clearTimeout(timeout); }
    }
    void init();
    return () => { active = false; window.clearTimeout(timeout); listener?.remove(); map.current = null; if (authWindow.gm_authFailure === authFailure) authWindow.gm_authFailure = previousAuthFailure; };
  }, [key]);
  useEffect(() => { if (ready) map.current?.panTo(center); }, [center, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const markers = memos.map(memo => {
      const marker = new google.maps.marker.AdvancedMarkerElement({ map: map.current, position: { lat: memo.lat, lng: memo.lng }, title: memo.title || memo.body.slice(0, 40) });
      marker.addListener("click", () => callbacks.current.onMemoSelect(memo));
      return marker;
    });
    if (selected) {
      const pin = document.createElement("div"); pin.className = "selectedMapPin";
      markers.push(new google.maps.marker.AdvancedMarkerElement({ map: map.current, position: selected, title: "選択中の場所", content: pin, zIndex: 1000 }));
    }
    return () => { markers.forEach(marker => { google.maps.event.clearInstanceListeners(marker); marker.map = null; }); };
  }, [memos, selected, ready]);
  if (!key) return <div className="mapUnavailable"><strong>地図は準備中です</strong><p>Google Mapsの接続設定後に利用できます。下の緯度・経度からも場所を選べます。</p></div>;
  return <><div ref={host} className="mapStage" aria-label="メモの地図" /><button type="button" disabled={!ready || !!error} onClick={() => { const center = map.current?.getCenter(); if (center) onSelect(center.toJSON()); }}>地図の中央を選ぶ</button>{!ready && !error && <p role="status">地図を読み込み中…</p>}{error && <p className="error" role="alert">{error}</p>}</>;
}
