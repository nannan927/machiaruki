"use client";

import type { Memo } from "@/types/memo";
import { MapCanvas } from "@/components/MapCanvas";

type MapViewProps = {
  selected: { lat: number; lng: number } | null;
  memos: Memo[];
  onSelect: (coords: { lat: number; lng: number }) => void;
};

const defaultCenter = { lat: 36.7411, lng: 137.0154 };

export function MapView({ selected, memos, onSelect }: MapViewProps) {
  const center = selected ?? defaultCenter;

  return (
    <section className="card">
      <div className="cardHeader">
        <h2>1. ホーム / 地図</h2>
        <small>保存済み {memos.length} 件</small>
      </div>
      <p className="cardLead">Google Maps導入前の仮マップ。導入時は MapCanvas のみ差し替えます。</p>
      <MapCanvas center={center} onSelect={onSelect} />
      <p className="coords">
        center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
      </p>
    </section>
  );
}
