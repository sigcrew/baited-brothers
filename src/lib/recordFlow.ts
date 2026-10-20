import type { CatchVerificationStatus } from "@/src/lib/catchRewards";
import type { Fish } from "@/src/hooks/useFishes";

/** 촬영/선택된 사진과 그에 딸린 현장 정보. 로컬 큐의 job과 1:1로 대응한다. */
export type RecordCapture = {
  uri: string;
  width: number;
  height: number;
  base64: string;
  mimeType: "image/jpeg" | "image/png";
  latitude: number | null;
  longitude: number | null;
  capturedAt: string | null;
  locationAccuracyM: number | null;
  locationCapturedAt: string | null;
  source: "camera" | "photo_library";
  tripId: string | null;
  tripName: string | null;
  pendingCatchId: string;
  clientRequestId: string;
};

export type RecordCompletion = {
  fish: Fish | null;
  customSpeciesName: string | null;
  catchId: string | null;
  isFirstDiscovery: boolean;
  isDevelopmentTest: boolean;
  isFileUpload: boolean;
  discoveredCount: number;
  verificationStatus: CatchVerificationStatus;
  verificationReason: string | null;
  sizeCm?: number;
};

export type AiConsentState = "loading" | "pending" | "accepted" | "manual";

/** identify-fish가 받는 base64 상한(≈10MB JPEG). */
export const MAX_RECOGNITION_BASE64_LENGTH = 13_500_000;
export const AI_PHOTO_CONSENT_KEY = "ai-photo-consent-v1";
export const PRIVACY_POLICY_URL = "https://sigcrew.github.io/baited-brothers/privacy/";
/** 입력 가능한 최대 체장(cm). 국내 기록어 기준으로도 충분히 크다. */
export const MAX_SIZE_CM = 500;

export type SizeParseResult =
  | { isValid: true; sizeCm: number | undefined; error: null }
  | { isValid: false; sizeCm: undefined; error: string };

/**
 * 크기 입력 파싱. 빈 값은 "미입력"으로 유효하다. 소수점은 쉼표도 허용하고
 * (한국어 키보드), 지수/16진수 같은 Number()의 관대한 표기는 거부한다.
 */
export const parseOptionalSize = (raw: string): SizeParseResult => {
  const text = raw.trim().replace(",", ".");
  if (!text) return { isValid: true, sizeCm: undefined, error: null };
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { isValid: false, sizeCm: undefined, error: "크기는 0보다 큰 숫자로 입력해 주세요." };
  }
  const sizeCm = Number(text);
  if (!Number.isFinite(sizeCm) || sizeCm <= 0) {
    return { isValid: false, sizeCm: undefined, error: "크기는 0보다 큰 숫자로 입력해 주세요." };
  }
  if (sizeCm > MAX_SIZE_CM) {
    return { isValid: false, sizeCm: undefined, error: `크기는 ${MAX_SIZE_CM}cm 이하로 입력해 주세요.` };
  }
  return { isValid: true, sizeCm, error: null };
};

/** 리뷰 화면 상단의 위치 상태 한 줄. */
export const captureLocationLabel = (
  capture: Pick<RecordCapture, "source" | "latitude" | "longitude" | "capturedAt">,
) => {
  const hasPosition = capture.latitude != null && capture.longitude != null;
  if (capture.source === "photo_library") {
    return hasPosition && capture.capturedAt
      ? "사진 위치 확인됨 · 인증 조과 심사 대상"
      : "사진 위치 없음 · 일반 기록으로 저장";
  }
  return hasPosition
    ? "GPS 확보 완료 · 서버 인증 예정"
    : "위치 미인증 · 지도와 도감 해금에서 제외";
};
