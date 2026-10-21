import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";
import "./font-vars.css";
import "./content.css";

const notoSans = localFont({
  variable: "--font-noto-sans",
  display: "swap",
  src: [
    { path: "../public/fonts/noto-sans-kr-regular.ttf", weight: "400" },
    { path: "../public/fonts/noto-sans-kr-semibold.ttf", weight: "600" },
    { path: "../public/fonts/noto-sans-kr-extrabold.ttf", weight: "800" },
  ],
});

const blackHan = localFont({
  variable: "--font-black-han",
  display: "swap",
  src: "../public/fonts/black-han-sans.ttf",
});

const spaceMono = localFont({
  variable: "--font-space-mono",
  display: "swap",
  src: "../public/fonts/space-mono.ttf",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sigcrew.github.io/baited-brothers/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "낚시당한 녀석들 — 조과와 도감을 쌓는 낚시 일지",
  description: "사진으로 어종 후보를 확인하고, 출조와 조과를 기록해 나만의 낚시 도감을 완성하세요.",
  icons: { icon: "/images/app-icon.png" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "낚시당한 녀석들 — 조과와 도감을 쌓는 낚시 일지",
    description: "잡은 순간을 기록하고 나만의 바다 도감을 완성하세요.",
    images: [{ url: "/images/home-promo.png" }],
  },
};

export const viewport: Viewport = { themeColor: "#f4f7f6" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${notoSans.variable} ${blackHan.variable} ${spaceMono.variable}`}>{children}</body>
    </html>
  );
}
