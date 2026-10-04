"use client";
import { useState } from "react";
import type { Memo } from "@/types/memo";
import { MapCanvas } from "@/components/MapCanvas";
import { DemoMap } from "@/components/DemoMap";
type Coords = { lat: number; lng: number };
const defaultCenter = { lat: 36.7411, lng: 137.0154 };
export function MapView({ selected, memos, onSelect, onMemoSelect, demo = false }: { demo?: boolean; selected: Coords | null; memos: Memo[]; onSelect: (coords: Coords) => void; onMemoSelect: (memo: Memo) => void }) {
  const [googleRequested, setGoogleRequested] = useState(false);
  const mapsEnabled = process.env.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED === "true" && !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const useDemoMap = demo && !googleRequested;
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  function locate() {
    if (!navigator.geolocation) { setError("このブラウザーは現在地取得に対応していません。"); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(position => { onSelect({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false); }, err => { setLocating(false); setError(err.code === 1 ? "位置情報が許可されていません。ブラウザーの設定で許可するか、地図・座標から場所を選んでください。" : "現在地を取得できませんでした。地図・座標から選ぶか、再度お試しください。"); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  function manual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSelect({ lat: Number(data.get("lat")), lng: Number(data.get("lng")) });
  }
  return <section className="card"><div className="cardHeader"><h2>1. 場所を選ぶ</h2><small>表示 {memos.length} 件</small></div>
    <p className="cardLead">地図をタップして場所を選択。ピンを押すとメモを開けます。</p>
    {useDemoMap ? <DemoMap selected={selected} memos={memos} onSelect={onSelect} onMemoSelect={onMemoSelect} /> : googleRequested && mapsEnabled ? <MapCanvas center={selected ?? defaultCenter} selected={selected} memos={memos} onSelect={onSelect} onMemoSelect={onMemoSelect} /> : <div className="mapUnavailable"><strong>{mapsEnabled ? "地図を表示して場所を探す" : "地図は準備中です"}</strong><p>現在地や座標の入力でもメモを残せます。</p></div>}
    <button type="button" onClick={useDemoMap ? () => onSelect({ lat: 36.7411, lng: 137.0154 }) : locate} disabled={locating}>{locating ? "現在地を取得中…" : useDemoMap ? "散歩のスタート地点を選ぶ" : "現在地を選ぶ"}</button>
    {mapsEnabled && !googleRequested && <button type="button" onClick={() => setGoogleRequested(true)}>Google Mapsを表示</button>}

    {error && <p role="alert" className="error">{error}</p>}
    <p className="coords">{selected ? `選択中: ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}` : "場所はまだ選択されていません。"}</p>
    <details><summary>緯度・経度で選ぶ</summary><form className="form" onSubmit={manual} key={selected ? `${selected.lat},${selected.lng}` : "initial"}>
      <label>緯度<input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={selected?.lat ?? defaultCenter.lat} /></label>
      <label>経度<input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={selected?.lng ?? defaultCenter.lng} /></label>
      <button type="submit">この座標を選ぶ</button>
    </form></details>
  </section>;
}
