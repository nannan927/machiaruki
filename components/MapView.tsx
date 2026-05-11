"use client";

import type { Memo } from "@/types/memo";

type MapViewProps = {
  selected: { lat: number; lng: number } | null;
  memos: Memo[];
  onSelect: (coords: { lat: number; lng: number }) => void;
};

const defaultCenter = { lat: 36.7411, lng: 137.0154 };

export function MapView({ selected, memos, onSelect }: MapViewProps) {
  const center = selected ?? defaultCenter;
  const hasSelected = Boolean(selected);

  return (
    <section className="card">
      <h2>地図で場所を選ぶ</h2>
      <p>気になった場所を選ぶと、下のフォームに座標が反映されます。</p>
      <div className="mapPlaceholder">
        <div className="mapStatus">
          {hasSelected ? "✅ 場所を選択済み。下のフォームから保存できます。" : "👆 まずはボタンで場所を選択しましょう。"}
        </div>
        <p>
          center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </p>
        <div className="mapActions">
          <button
            type="button"
            onClick={() =>
              onSelect({
                lat: +(center.lat + 0.0005).toFixed(6),
                lng: +(center.lng + 0.0005).toFixed(6),
              })
            }
          >
            + ここを選ぶ
          </button>
          <button
            type="button"
            onClick={() =>
              onSelect({
                lat: +(center.lat - 0.0007).toFixed(6),
                lng: +(center.lng + 0.0003).toFixed(6),
              })
            }
          >
            + 少し先を選ぶ
          </button>
        </div>
      </div>
      <p>保存済みメモ: {memos.length} 件</p>
    </section>
  );
}
