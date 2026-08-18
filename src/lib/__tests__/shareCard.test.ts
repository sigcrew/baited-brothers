import { getShareMessage, SMART_APP_LINK_URL } from "@/src/lib/shareCard";

describe("getShareMessage", () => {
  it("includes the catch summary and smart app link", () => {
    const message = getShareMessage({ fishName: "넙치", sizeCm: 42.5 });

    expect(message).toContain("넙치 42.5cm 조과를 기록했어요.");
    expect(message).toContain(
      `앱에서 열기 또는 설치하기: ${SMART_APP_LINK_URL}`,
    );
  });

  it("omits an unrecorded size without exposing location data", () => {
    const message = getShareMessage({ fishName: "농어", sizeCm: null });

    expect(message).toContain("농어 조과를 기록했어요.");
    expect(message).not.toContain("cm");
    expect(message).not.toContain("위치");
  });
});
