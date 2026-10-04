import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "地図の余白 | Machinote",
  description: "街歩きの気づきを、場所と一緒に残す自分だけの散歩ノート。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
