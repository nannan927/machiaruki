"use client";

type MapCanvasProps = {
  onSelect: (coords: { lat: number; lng: number }) => void;
  center: { lat: number; lng: number };
};

/**
 * Google Maps導入時はこのコンポーネント実装のみ差し替える。
 */
export function MapCanvas({ onSelect, center }: MapCanvasProps) {
  return (
    <>
      <div className="mapStage" role="img" aria-label="地図プレースホルダー">
        <div className="pin" style={{ top: "30%", left: "28%" }} />
        <div className="pin" style={{ top: "58%", left: "70%" }} />
        <div className="pin pinActive" style={{ top: "47%", left: "52%" }} />
      </div>
      <button
        className="primaryBtn"
        type="button"
        onClick={() =>
          onSelect({
            lat: +(center.lat + 0.0005).toFixed(6),
            lng: +(center.lng + 0.0005).toFixed(6),
          })
        }
      >
        この場所を選ぶ
      </button>
    </>
  );
}
