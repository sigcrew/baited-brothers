import Image from "next/image";
import Link from "next/link";

import { CatchCardPreview } from "@/components/catch-card-preview";
import { Header } from "@/components/header";
import { Reveal } from "@/components/reveal";
import { APP_STORE_URL, PLAY_STORE_URL, officialBlogSections, publicBlogUrl } from "@/lib/links";

function StoreButton({ href, children, store }: Readonly<{ href: string; children: React.ReactNode; store: "apple" | "play" }>) {
  return (
    <a className="store-button" href={href} target="_blank" rel="noreferrer">
      {store === "apple" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.33-.07 2.26.73 3.04.79 1.17-.24 2.29-.93 3.54-.84 1.5.12 2.63.71 3.38 1.8-3.1 1.86-2.36 5.95.48 7.09-.57 1.5-1.31 2.99-2.44 4.13ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z" /></svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3.22 2.45 10.9 9.55-10.9 9.55A2.6 2.6 0 0 1 3 20.5v-17c0-.37.08-.72.22-1.05Zm12.16 10.66 2.7 2.36-11.2 6.28 8.5-8.64Zm3.9-4.25c.94.53.94 1.75 0 2.28l-2.45 1.38-2.93-2.57 2.92-2.57 2.46 1.48ZM6.87 2.25l11.2 6.28-2.69 2.36-8.51-8.64Z" /></svg>
      )}
      <span>{children}</span>
    </a>
  );
}

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">본문 바로가기</a>
      <Header />
      <main id="main">
        <section className="hero" id="top">
          <div className="hero-copy">
            <h1>잡은 순간을 기록해,<br />나만의 도감으로.</h1>
            <p>사진으로 어종 후보를 확인하고 조과를 기록하세요.<br className="desktop-break" /> 낚시의 기억이 나만의 도감으로 쌓입니다.</p>
            <div className="store-actions" aria-label="앱 다운로드">
              <StoreButton href={APP_STORE_URL} store="apple">App Store</StoreButton>
              <StoreButton href={PLAY_STORE_URL} store="play">Google Play</StoreButton>
            </div>
            <p className="hero-note">iPhone과 Android에서 시작하세요.</p>
            <Link className="hero-details" href="#features">기록부터 수집까지 살펴보기 <span aria-hidden="true">↓</span></Link>
          </div>
          <div className="hero-media" aria-label="낚시당한 녀석들 지도 화면">
            <Image className="harbor-photo" src="/images/harbor-hero.png" alt="푸른 바다와 방파제 등대" fill priority sizes="(max-width: 760px) 100vw, 51vw" />
            <div className="phone phone-hero"><Image src="/images/map-screen.png" alt="앱의 나의 바다 지도 화면" fill priority sizes="(max-width: 760px) 300px, 310px" /></div>
            <p className="hero-caption">실제 앱 화면 · 나의 바다</p>
          </div>
        </section>

        <section className="field-section" id="features">
          <Reveal className="section-intro"><h2>낚시의 기억을<br />한 권에 모으다.</h2><p>출조부터 기록, 수집까지.<br />바다에서 생긴 모든 순간이 나만의 도감이 됩니다.</p></Reveal>
          <div className="field-route" aria-label="앱 사용 흐름">
            <div className="route-line" aria-hidden="true"><span>0　　　　　　　　　　　　　　　　　　　　　　　　　　　　　50</span></div>
            <Reveal className="route-step step-one">
              <div className="step-copy"><strong>01</strong><div><h3>사진으로 어종 확인</h3><p>잡은 물고기를 촬영하면<br />AI가 어종 후보를 찾아드려요.</p></div></div>
              <div className="specimen-frame"><span>FIELD SPECIMEN · 01</span><Image src="/images/halibut.png" alt="넙치 일러스트" width={500} height={300} /></div>
            </Reveal>
            <Reveal className="route-step step-two">
              <div className="mini-phone"><Image src="/images/home-promo.png" alt="출조를 기록하는 앱 화면" fill sizes="210px" /></div>
              <div className="step-copy"><strong>02</strong><div><h3>조과와 출조 기록</h3><p>날짜, 장소, 크기를 남겨<br />그날의 바다를 오래 기억하세요.</p></div></div>
            </Reveal>
            <Reveal className="route-step step-three">
              <div className="collection-phone"><Image src="/images/collection-screen.png" alt="60종 수집 도감 화면" fill sizes="230px" /></div>
              <div className="step-copy" id="collection"><strong>03</strong><div><h3>수집 도감 완성</h3><p>위치와 촬영 시각이 인증된 조과로<br />나만의 도감을 채워보세요.</p></div></div>
            </Reveal>
          </div>
        </section>

        <section className="share-section" id="share">
          <div className="share-inner">
            <Reveal className="share-copy">
              <h2>잡았으면,<br />남겨야 제맛.</h2><p>조과는 한 장의 카드가 되고,<br />기록은 한 권의 도감이 됩니다.<br />모으고, 꺼내 보고, 함께 자랑하세요.</p>
              <CatchCardPreview className="outline-button">조과 카드 미리보기<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></CatchCardPreview>
            </Reveal>
            <Reveal className="card-stage">
              <Image className="badge badge-round" src="/images/badge-first-catch.png" alt="첫 조과 배지" width={500} height={500} />
              <Image className="badge badge-hex" src="/images/badge-dawn-trip.png" alt="새벽 출조 배지" width={500} height={500} />
              <CatchCardPreview className="catch-card-button" ariaLabel="조과 카드 크게 보기"><Image src="/images/catch-card.png" alt="넙치 42.5cm 조과 카드" width={996} height={1538} /></CatchCardPreview>
            </Reveal>
            <div className="share-points">
              <article><span>01</span><div><h3>현장 인증</h3><p>날짜와 위치를 기록해요.</p></div></article>
              <article><span>02</span><div><h3>도감 해금</h3><p>위치·촬영 시각이 인증된 도감 어종이 열려요.</p></div></article>
              <article><span>03</span><div><h3>공유 카드</h3><p>멋진 한 장으로 공유해요.</p></div></article>
            </div>
          </div>
        </section>

        <section className="journal-section" id="blog">
          <Reveal className="section-intro"><h2>바다에서 건진<br />이야기들.</h2><p>조행기와 초보 가이드, 앱 소식을 공식 블로그에서 이어서 읽으세요.</p></Reveal>
          <div className="journal-links">
            {officialBlogSections().map(([label, href]) => <a key={href} href={href}>{label}<span>↗</span></a>)}
            <a href={publicBlogUrl()}>전체 이야기<span>↗</span></a>
          </div>
        </section>

        <section className="download-section" id="download"><div className="download-grid">
          <Reveal className="download-copy"><h2>다음 출조의 기록,<br />지금 시작하세요.</h2><p>iPhone은 App Store, Android는 Google Play에서.</p></Reveal>
          <Reveal className="download-actions"><a href={APP_STORE_URL} target="_blank" rel="noreferrer">App Store에서 시작하기 <span>↗</span></a><a href={PLAY_STORE_URL} target="_blank" rel="noreferrer">Google Play에서 시작하기 <span>↗</span></a></Reveal>
        </div></section>
      </main>

      <footer id="support"><div className="footer-top"><Link className="brand footer-brand" href="#top"><Image src="/images/app-icon.png" alt="" width={44} height={44} /><span>낚시당한 녀석들</span></Link><p>조과와 도감을 쌓는 낚시 일지</p></div><div className="footer-bottom"><div><Link href={publicBlogUrl()}>공식 블로그</Link><Link href="/privacy">개인정보 처리방침</Link><Link href="/support">고객지원</Link></div><span>© 2026 SIGCREW</span></div></footer>
    </>
  );
}
