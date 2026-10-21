import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "고객 지원 | 낚시당한 녀석들", description: "낚시당한 녀석들 앱 고객 지원 및 문의 안내" };

export default function SupportPage() {
  return <main className="content-page">
    <Link className="home-link" href="/">← 낚시당한 녀석들</Link>
    <h1>고객 지원</h1><p className="meta">BAITED BROTHERS · SUPPORT</p>
    <div className="contact"><p><strong>앱 이용 중 도움이 필요하신가요?</strong></p><p>이메일: <a href="mailto:yong@sigcrew.com">yong@sigcrew.com</a></p><p>지원 채널: <a href="https://github.com/sigcrew/baited-brothers/issues">GitHub 문의</a></p><p>문의에는 영업일 기준 3일 이내 답변을 드리겠습니다.</p></div>
    <section><h2>문의할 때 알려주세요</h2><ul><li>사용 중인 기기 모델과 운영체제 버전(iOS 또는 Android)</li><li>앱에서 문제가 발생한 화면과 수행한 작업</li><li>문제를 확인할 수 있는 스크린샷</li></ul><p>비밀번호, 인증 코드, 정확한 위치 등 민감한 정보는 보내지 마세요.</p></section>
    <section><h2>자주 묻는 질문</h2><h3>위치 권한 없이 조과를 기록할 수 있나요?</h3><p>네. 촬영 전 안내에서 ‘위치 없이 계속’을 선택하면 사진 분석과 일반 조과 저장을 계속할 수 있습니다. 해당 기록은 위치 미인증 상태로 저장되어 지도 표시와 도감 해금에서는 제외됩니다.</p><h3>사진 보관함의 사진도 인증할 수 있나요?</h3><p>네. 선택한 사진에 촬영 위치와 시각이 있고 해당 위치가 연안으로 확인되면 도감·배지·개인 최대어에 반영됩니다. 사진 위치가 없거나 확인되지 않으면 일반 기록으로 저장됩니다. 사진 보관함 기록은 위치 메타데이터를 수정할 수 있어 랭킹에서는 제외됩니다.</p><h3>AI가 물고기 어종을 자동으로 확정하나요?</h3><p>아닙니다. AI는 최대 3개의 후보를 제안하며, 사용자가 최종 어종을 직접 선택해야 기록됩니다. 후보가 맞지 않으면 도감에서 직접 검색할 수 있습니다.</p><h3>조과 사진을 사진 앱에 저장하려면 어떻게 하나요?</h3><p>일지에서 완료한 출조를 열고 현장 기록의 조과 카드에서 ‘사진 저장’을 누르세요. 사용자가 선택한 사진을 추가할 때만 사진 추가 권한을 요청합니다.</p><h3>계정을 삭제하려면 어떻게 하나요?</h3><p>앱의 프로필 → 계정 → 계정 탈퇴에서 계정과 연결된 출조·조과·사진을 삭제할 수 있습니다.</p></section>
    <section><h2>개인정보 및 권리 요청</h2><p>개인정보 처리, 열람 또는 삭제에 관한 문의도 지원 이메일로 요청할 수 있습니다. 자세한 내용은 <Link href="/privacy">개인정보 처리방침</Link>에서 확인하세요.</p></section>
    <footer>운영 주체: SIGCREW<br />지원 이메일: <a href="mailto:yong@sigcrew.com">yong@sigcrew.com</a><br />개인정보 처리방침: <Link href="/privacy">바로가기</Link></footer>
  </main>;
}
