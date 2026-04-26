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

  return (
    <section className="card">
      <h2>地図（MVPプレースホルダー）</h2>
      <p>
        Google Maps APIキー設定後に実マップへ置き換えます。今は座標入力でメモ作成フローを確認できます。
      </p>
      <div className="mapPlaceholder">
        <p>
          center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </p>
        <button
          type="button"
          onClick={() =>
            onSelect({
              lat: +(center.lat + 0.0005).toFixed(6),
              lng: +(center.lng + 0.0005).toFixed(6),
            })
          }
        >
          + 座標を選択
        </button>
      </div>
      <p>保存済みメモ: {memos.length} 件</p>
    </section>
  );
}
