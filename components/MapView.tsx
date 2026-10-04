"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Memo } from "@/types/memo";
import type { LocatedPosition } from "@/components/MapCanvas";
import { DemoMap } from "@/components/DemoMap";

const MapCanvas = dynamic(() => import("@/components/MapCanvas").then(module => module.MapCanvas), {
  ssr: false,
  loading: () => <div className="mapStage" role="status">地図を準備中…</div>,
});
type Coords = { lat: number; lng: number };
const defaultCenter = { lat: 36.7411, lng: 137.0154 };

export function MapView({ selected, memos, onSelect, onMemoSelect, demo = false }: { demo?: boolean; selected: Coords | null; memos: Memo[]; onSelect: (coords: Coords) => void; onMemoSelect: (memo: Memo) => void }) {
  const [realMap, setRealMap] = useState(!demo);
  const [location, setLocation] = useState<LocatedPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const locationRequest = useRef(0);
  const latestSelection = useRef(selected);
  useEffect(() => { latestSelection.current = selected; }, [selected]);
  useEffect(() => () => { locationRequest.current++; }, []);

  function select(coords: Coords) {
    locationRequest.current++;
    setLocating(false);
    setError("");
    onSelect(coords);
  }
  function locate() {
    if (!navigator.geolocation) { setError("このブラウザーは現在地取得に対応していません。"); return; }
    const request = ++locationRequest.current;
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      if (latestSelection.current !== selected) { setLocating(false); return; }
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation({ ...coords, accuracy: Number.isFinite(position.coords.accuracy) ? Math.max(0, position.coords.accuracy) : 0 });
      onSelect(coords);
      setLocating(false);
    }, err => {
      if (request !== locationRequest.current) return;
      setLocating(false);
      setError(err.code === 1 ? "位置情報が許可されていません。ブラウザーの設定で許可するか、地図・座標から場所を選んでください。" : "現在地を取得できませんでした。地図・座標から選ぶか、再度お試しください。");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  function manual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const coords = { lat: Number(data.get("lat")), lng: Number(data.get("lng")) };
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng) || Math.abs(coords.lat) > 90 || Math.abs(coords.lng) > 180) return;
    select(coords);
  }
  return <section className="card"><div className="cardHeader"><h2>1. 場所を選ぶ</h2><small>表示 {memos.length} 件</small></div>
    <p className="cardLead">地図をタップして場所を選択。緑のピンを押すとメモを開けます。</p>
    {demo && <div className="mapMode"><button type="button" aria-pressed={realMap} onClick={() => {
      locationRequest.current++; setLocating(false); setError(""); setRealMap(value => !value);
    }}>{realMap ? "架空のデモ地図に戻る" : "実際の地図で試す"}</button>
      <small>サンプルの言葉は架空です。実地図でも保存先はこのブラウザーです。</small></div>}
    {realMap
      ? <MapCanvas selected={selected} location={location} memos={memos} onSelect={select} onMemoSelect={memo => { locationRequest.current++; setLocating(false); onMemoSelect(memo); }} />
      : <DemoMap selected={selected} memos={memos} onSelect={select} onMemoSelect={onMemoSelect} />}
    <button type="button" onClick={realMap ? locate : () => select(defaultCenter)} disabled={locating}>{locating ? "現在地を取得中…" : realMap ? "現在地を選ぶ" : "散歩のスタート地点を選ぶ"}</button>
    {realMap && location && <p className="coords">取得時の位置精度：約{Math.round(location.accuracy)}m。ずれている場合は地図で場所を選び直せます。</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <p className="coords">{selected ? `選択中: ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}` : "場所はまだ選択されていません。"}</p>
    <details><summary>緯度・経度で選ぶ</summary><form className="form" onSubmit={manual} key={selected ? `${selected.lat},${selected.lng}` : "initial"}>
      <label>緯度<input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={selected?.lat ?? defaultCenter.lat} /></label>
      <label>経度<input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={selected?.lng ?? defaultCenter.lng} /></label>
      <button type="submit">この座標を選ぶ</button>
    </form></details>
  </section>;
}
