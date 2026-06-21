import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 顾投小助手 MVP",
  description: "低代码可演示的 AI 顾投小助手"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
