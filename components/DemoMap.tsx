"use client";
import type { Memo } from "@/types/memo";
type Coords = { lat: number; lng: number };
const origin = { lat: 36.7411, lng: 137.0154 };
function position(coords: Coords) { return { x: 50 + (coords.lng - origin.lng) / .008 * 100, y: 50 - (coords.lat - origin.lat) / .006 * 100 }; }
export function DemoMap({ selected, memos, onSelect, onMemoSelect }: { selected: Coords | null; memos: Memo[]; onSelect: (coords: Coords) => void; onMemoSelect: (memo: Memo) => void }) {
  const point = selected ? position(selected) : null;
  return <div className="demoMap">
    <svg viewBox="0 0 600 450" preserveAspectRatio="none" aria-hidden="true" className="demoMapArt">
      <rect width="600" height="450" fill="#eee9db" />
      <path d="M420 -30 Q330 100 445 240 T425 490" stroke="#bad5d9" strokeWidth="65" fill="none" />
      <path d="M420 -30 Q330 100 445 240 T425 490" stroke="#d7e7e7" strokeWidth="2" strokeDasharray="9 12" fill="none" />
      <rect x="45" y="36" width="185" height="130" rx="35" fill="#d3dfc4" />
      <rect x="64" y="275" width="125" height="125" rx="16" fill="#e1d5bf" />
      <rect x="257" y="270" width="85" height="90" rx="12" fill="#e2d7c7" />
      <rect x="470" y="60" width="110" height="125" rx="20" fill="#e4dbc8" />
      <path d="M0 217 L600 195 M242 0 L217 450 M0 380 L365 370 M0 55 L310 440" stroke="#fbf9f2" strokeWidth="20" fill="none" />
      <path d="M0 217 L600 195 M242 0 L217 450" stroke="#d6cebc" strokeWidth="1" fill="none" />
      <path d="M360 195 L440 193" stroke="#b69c77" strokeWidth="25" />
      <path d="M361 195 L439 193" stroke="#f7f0e4" strokeWidth="17" />
      {[70, 115, 160, 200].map((x, i) => <circle key={x} cx={x} cy={70 + i % 2 * 50} r="16" fill="#a9c398" />)}
      <g fill="#65705c" fontSize="16" fontFamily="sans-serif"><text x="90" y="155">こもれび公園</text><text x="75" y="327">路地の商店街</text><text x="463" y="320">余白川</text><text x="266" y="405">散歩通り</text></g>
    </svg>
    <button className="demoMapSurface" type="button" aria-label="デモ地図で場所を選ぶ" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.detail === 0 ? .5 : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = event.detail === 0 ? .5 : Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      onSelect({ lat: +(origin.lat + (.5 - y) * .006).toFixed(6), lng: +(origin.lng + (x - .5) * .008).toFixed(6) });
    }} />
    {memos.map((memo, index) => { const p = position(memo); return p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100 ? <button key={memo.id} type="button" className="demoMarker" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-label={`${memo.title || "無題"}を開く`} title={memo.title || "無題"} onClick={() => onMemoSelect(memo)}>{index + 1}</button> : null; })}
    {point && point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100 && <span className="demoSelection" style={{ left: `${point.x}%`, top: `${point.y}%` }} />}
    <span className="demoMapLegend">N ↑ · 架空の散歩マップ</span>
  </div>;
}
