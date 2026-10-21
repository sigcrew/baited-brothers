"use client";

import { publicBlogUrl } from "@/lib/links";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const navigation = [
  ["기능", "/#features"],
  ["수집 도감", "/#collection"],
  ["조과 카드", "/#share"],
  ["블로그", publicBlogUrl()],
  ["지원", "/#support"],
] as const;

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 16);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  return (
    <header className={`site-header${scrolled ? " scrolled" : ""}`}>
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="낚시당한 녀석들 홈">
          <Image src="/images/app-icon.png" alt="" width={44} height={44} priority />
          <span>낚시당한 녀석들</span>
        </Link>
        <button
          className="menu-button"
          type="button"
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span />
        </button>
        <nav className={`site-nav${menuOpen ? " open" : ""}`} id="site-nav" aria-label="주요 메뉴">
          {navigation.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}
        </nav>
        <Link className="header-cta" href="/#download" onClick={() => setMenuOpen(false)}>앱 다운로드</Link>
      </div>
    </header>
  );
}
