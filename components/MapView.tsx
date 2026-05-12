"use client";

import { useMemo, useState } from "react";
import type { Memo } from "@/types/memo";

type MapViewProps = {
  selected: { lat: number; lng: number } | null;
  memos: Memo[];
  onSelect: (coords: { lat: number; lng: number }) => void;
};

type Layer = "normal" | "night" | "walk";

const defaultCenter = { lat: 36.7411, lng: 137.0154 };

const layerLabel: Record<Layer, string> = {
  normal: "標準",
  night: "ナイト",
  walk: "さんぽ",
};

const layerDescription: Record<Layer, string> = {
  normal: "普段の地図。位置関係が見やすいベース表示です。",
  night: "夜道を想定したコントラスト高めの見え方です。",
  walk: "緑地と歩道を強調した、散歩向けの見え方です。",
};

export function MapView({ selected, memos, onSelect }: MapViewProps) {
  const center = selected ?? defaultCenter;
  const [layer, setLayer] = useState<Layer>("normal");

  const memoPreview = useMemo(() => {
    if (memos.length === 0) return "まだメモはありません。";
    const titles = memos.slice(0, 3).map((memo) => memo.title || "無題");
    return `メモ: ${titles.join(" / ")}${memos.length > 3 ? " ..." : ""}`;
  }, [memos]);

  return (
    <section className="card">
      <h2>地図（MVPプレースホルダー）</h2>
      <p>レイヤーを切り替えて、同じ場所でも印象が変わる体験を試せます。</p>

      <div className="layerButtons" role="tablist" aria-label="地図レイヤー切替">
        {(Object.keys(layerLabel) as Layer[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            aria-pressed={layer === key}
            className={layer === key ? "active" : ""}
          >
            {layerLabel[key]}
          </button>
        ))}
      </div>

      <div className={`mapPlaceholder mapLayer-${layer}`}>
        <p className="layerTitle">{layerLabel[layer]}レイヤー</p>
        <p>{layerDescription[layer]}</p>
        <p>
          center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </p>
        <p>{memoPreview}</p>
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
