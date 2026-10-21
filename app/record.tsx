import type { RecognitionAnalysis } from "@/src/lib/fishRecognition";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useFishes, type Fish } from "@/src/hooks/useFishes";
import { useCreateCatch } from "@/src/hooks/useCreateCatch";
import { useAuth } from "@/src/contexts/AuthContext";
import { FieldNoticeProvider, useFieldNotice } from "@/src/contexts/FieldNoticeContext";
import {
  useFishRecognition,
  type FishRecognitionCandidate,
} from "@/src/hooks/useFishRecognition";
import { CatchCompletionView } from "@/components/record/CatchCompletionView";
import { ShareCatchCardModal } from "@/components/share/ShareCatchCardModal";
import { FishCatalogSheet } from "@/components/record/FishCatalogSheet";
import { AiConsentLoadingScreen, AiConsentScreen } from "@/components/record/AiConsentScreen";
import { CameraPermissionScreen } from "@/components/record/CameraPermissionScreen";
import { CameraCaptureScreen } from "@/components/record/CameraCaptureScreen";
import { CatchReviewScreen } from "@/components/record/CatchReviewScreen";
import {
  AI_PHOTO_CONSENT_KEY,
  AI_PHOTO_CONSENT_VERSION,
  MAX_RECOGNITION_BASE64_LENGTH,
  isAiConsentCurrent,
  parseOptionalSize as parseSizeInput,
  type AiConsentState,
  type RecordCapture as Capture,
  type RecordCompletion as CompletionResult,
} from "@/src/lib/recordFlow";
import { getField60Illustration } from "@/src/data/field60Illustrations";
import { optimizeUserPhoto } from "@/src/lib/optimizeUserPhoto";
import { extractLibraryPhotoMetadata } from "@/src/lib/photoMetadata";
import { trackAnalyticsEvent } from "@/src/lib/analytics";
import {
  getPendingCatch,
  lockPendingCatch,
  preservePendingCatch,
  readPendingCatchBase64,
  removePendingCatch,
  resolvePendingCatchFailure,
  unlockPendingCatch,
  updatePendingCatch,
} from "@/src/lib/pendingCatchQueue";
import type { ShareCatchData } from "@/src/lib/shareCard";

const RecordScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tripId?: string;
    tripName?: string;
    completionPreview?: string;
    consentPreview?: string;
    pendingId?: string;
  }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;
  const tripName = typeof params.tripName === "string" ? params.tripName : undefined;
  const pendingId =
    typeof params.pendingId === "string" ? params.pendingId : undefined;
  const cameraRef = useRef<CameraView>(null);
  const saveRequestId = useRef<string | null>(null);
  const flowTracked = useRef(false);
  const cameraOpenedTracked = useRef(false);
  const resumedPendingId = useRef<string | null>(null);
  // 분석 세대. 다시 찍기/다른 사진/화면 이탈 뒤 도착한 이전 결과는 버린다.
  const analysisGeneration = useRef(0);
  const inFlightAnalysis = useRef<{ userId: string; pendingCatchId: string } | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { session } = useAuth();
  const { alert, confirm } = useFieldNotice();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const lastCameraPermission = useRef(cameraPermission);
  if (cameraPermission) {
    lastCameraPermission.current = cameraPermission;
  }
  const effectiveCameraPermission =
    cameraPermission ?? lastCameraPermission.current;
  const [recognitionAnalysis, setRecognitionAnalysis] = useState<RecognitionAnalysis | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [selectedFish, setSelectedFish] = useState<Fish | null>(null);
  const [customSpeciesName, setCustomSpeciesName] = useState<string | null>(
    null,
  );
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [shareCardVisible, setShareCardVisible] = useState(false);
  const [size, setSize] = useState("");
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRequestingCameraPermission, setIsRequestingCameraPermission] =
    useState(false);
  const [recognitionCandidates, setRecognitionCandidates] = useState<
    FishRecognitionCandidate[]
  >([]);
  const [recognitionNote, setRecognitionNote] = useState<string | null>(null);
  const [needsRetake, setNeedsRetake] = useState(false);
  const [recognitionSlow, setRecognitionSlow] = useState(false);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [aiConsent, setAiConsent] = useState<AiConsentState>("loading");
  const { fishes, isLoading: fishesLoading } = useFishes(null, "core");
  const { createCatch, isSaving } = useCreateCatch();
  const {
    recognize,
    isRecognizing,
    error: recognitionError,
  } = useFishRecognition();
  const completionPreviewMode =
    __DEV__ &&
    (params.completionPreview === "first" ||
      params.completionPreview === "existing")
      ? params.completionPreview
      : null;
  const previewFish =
    fishes.find((fish) => fish.catalog_sort_order === 2) ?? fishes[0] ?? null;
  const visibleCompletion =
    completion ??
    (completionPreviewMode && previewFish
      ? {
          fish: previewFish,
          customSpeciesName: null,
          catchId: null,
          isFirstDiscovery: completionPreviewMode === "first",
          isDevelopmentTest: true,
          isFileUpload: false,
          discoveredCount: completionPreviewMode === "first" ? 3 : 2,
          verificationStatus: "field_verified" as const,
          verificationReason: null,
          sizeCm: completionPreviewMode === "existing" ? 32.5 : undefined,
        }
      : null);
  const completionShareItem: ShareCatchData | null = visibleCompletion
    ? {
        id: visibleCompletion.catchId ?? "completion-preview-094",
        imageSource:
          capture?.uri
            ? { uri: capture.uri }
            : visibleCompletion.fish
              ? getField60Illustration(
                  visibleCompletion.fish.catalog_sort_order,
                  "color",
                ) ?? require("@/assets/images/card-app-icon-transparent.png")
              : require("@/assets/images/card-app-icon-transparent.png"),
        fishName:
          visibleCompletion.fish?.name_ko ??
          visibleCompletion.fish?.name ??
          visibleCompletion.customSpeciesName ??
          "어종 미확인",
        scientificName:
          visibleCompletion.fish?.name.split(/\s+/).slice(0, 2).join(" ") ??
          "OUTSIDE FIELD 60",
        sizeCm: visibleCompletion.sizeCm ?? null,
        caughtAt: capture?.capturedAt ?? new Date().toISOString(),
        regionLabel: null,
        verificationStatus: visibleCompletion.verificationStatus,
      }
    : null;

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(AI_PHOTO_CONSENT_KEY)
      .then((value) => {
        if (active) {
          setAiConsent(
            __DEV__ && params.consentPreview === "1"
              ? "pending"
              : isAiConsentCurrent(value)
                ? "accepted"
                : "pending",
          );
        }
      })
      .catch(() => {
        if (active) setAiConsent("pending");
      });

    return () => {
      active = false;
    };
  }, [params.consentPreview]);

  useEffect(() => {
    if (
      (aiConsent !== "accepted" && aiConsent !== "manual") ||
      flowTracked.current
    ) return;
    flowTracked.current = true;
    void trackAnalyticsEvent("catch_flow_started", {
      has_trip: Boolean(tripId),
      ai_enabled: aiConsent === "accepted",
    });
  }, [aiConsent, tripId]);

  useEffect(() => {
    if (
      (aiConsent !== "accepted" && aiConsent !== "manual") ||
      !effectiveCameraPermission?.granted ||
      capture ||
      cameraOpenedTracked.current
    ) {
      return;
    }
    cameraOpenedTracked.current = true;
    void trackAnalyticsEvent("camera_opened", {
      has_trip: Boolean(tripId),
    });
  }, [
    aiConsent,
    capture,
    effectiveCameraPermission?.granted,
    tripId,
  ]);

  const acceptAiPhotoConsent = async () => {
    setAiConsent("accepted");
    try {
      await AsyncStorage.setItem(AI_PHOTO_CONSENT_KEY, AI_PHOTO_CONSENT_VERSION);
    } catch {
      // 현재 사용 흐름에서는 동의를 유지하고 다음 실행에서 다시 안내합니다.
    }
  };

  const beginManualPhotoFlow = () => {
    setAiConsent("manual");
  };

  const candidateRows = useMemo(
    () =>
      recognitionCandidates
        .map((candidate) => ({
          candidate,
          fish: fishes.find((fish) => fish.id === candidate.fishId),
        }))
        .filter(
          (row): row is {
            candidate: FishRecognitionCandidate;
            fish: Fish;
          } => Boolean(row.fish),
        ),
    [fishes, recognitionCandidates],
  );

  const analyzeCapture = async (nextCapture: Capture) => {
    saveRequestId.current = nextCapture.clientRequestId;
    setCapture(nextCapture);
    setSelectedFish(null);
    setCustomSpeciesName(null);
    setCompletion(null);
    setRecognitionCandidates([]);
    setRecognitionNote(null);
    setRecognitionAnalysis(null);
    setNeedsRetake(false);
    setRecognitionSlow(false);
    setCatalogVisible(false);
    // 포그라운드 분석도 큐의 시도 횟수에 포함해 백그라운드 재시도 상한과 공유한다.
    let attemptCount = 1;
    if (session?.user.id) {
      const existing = await getPendingCatch(
        session.user.id,
        nextCapture.pendingCatchId,
      );
      attemptCount = (existing?.attemptCount ?? 0) + 1;
      await updatePendingCatch(
        session.user.id,
        nextCapture.pendingCatchId,
        {
          status: "analyzing",
          attemptCount,
          lastError: null,
          nextRetryAt: null,
        },
      );
    }

    const generation = ++analysisGeneration.current;
    inFlightAnalysis.current = session?.user.id
      ? { userId: session.user.id, pendingCatchId: nextCapture.pendingCatchId }
      : null;
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => setRecognitionSlow(true), 20_000);
    const result = await recognize({
      imageBase64: nextCapture.base64,
      mimeType: nextCapture.mimeType,
      fishes,
    });
    // 그 사이 다시 찍기/다른 사진/화면 이탈이 있었으면 이 결과는 다른 사진의 것이다.
    if (generation !== analysisGeneration.current) return;
    inFlightAnalysis.current = null;
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = null;
    setRecognitionSlow(false);
    setRecognitionCandidates(result.candidates);
    setRecognitionAnalysis(result.analysis);
    setRecognitionNote(result.note);
    setNeedsRetake(result.needsRetake);
    await updatePendingCatch(
      session?.user.id ?? "",
      nextCapture.pendingCatchId,
      {
        recognitionAnalysis: result.analysis,
        candidates: result.candidates,
        candidateFishIds: result.candidates.map(
          (candidate) => candidate.fishId,
        ),
        ...(result.error
          ? resolvePendingCatchFailure(attemptCount, result.error.message)
          : { status: "needs_confirmation", lastError: null, nextRetryAt: null }),
      },
    );
    void trackAnalyticsEvent("analysis_result_viewed", {
      candidate_count: result.candidates.length,
      needs_retake: result.needsRetake,
      has_error: Boolean(result.error),
    });
  };

  const prepareManualCapture = async (nextCapture: Capture) => {
    saveRequestId.current = nextCapture.clientRequestId;
    setCapture(nextCapture);
    setSelectedFish(null);
    setCustomSpeciesName(null);
    setCompletion(null);
    setRecognitionCandidates([]);
    setRecognitionNote(null);
    setRecognitionAnalysis(null);
    setNeedsRetake(false);
    setRecognitionSlow(false);
    setCatalogVisible(true);
    if (session?.user.id) {
      await updatePendingCatch(
        session.user.id,
        nextCapture.pendingCatchId,
        {
          status: "needs_confirmation",
          lastError: null,
          nextRetryAt: null,
        },
      );
    }
  };

  const preserveAndPrepareCapture = async (
    nextCapture: Omit<Capture, "pendingCatchId" | "clientRequestId">,
  ) => {
    const userId = session?.user.id;
    if (!userId) throw new Error("로그인이 필요합니다.");

    const pending = await preservePendingCatch({
      userId,
      tripId: nextCapture.tripId ?? undefined,
      tripName: nextCapture.tripName ?? undefined,
      imageUri: nextCapture.uri,
      imageWidth: nextCapture.width,
      imageHeight: nextCapture.height,
      mimeType: nextCapture.mimeType,
      captureMethod:
        nextCapture.source === "photo_library"
          ? "photo_library"
          : "live_camera",
      analysisRequested: aiConsent === "accepted",
      capturedAt: nextCapture.capturedAt ?? undefined,
      latitude: nextCapture.latitude ?? undefined,
      longitude: nextCapture.longitude ?? undefined,
      locationAccuracyM: nextCapture.locationAccuracyM ?? undefined,
      locationCapturedAt: nextCapture.locationCapturedAt ?? undefined,
    });
    const preservedCapture = {
      ...nextCapture,
      uri: pending.localImageUri,
      pendingCatchId: pending.localId,
      clientRequestId: pending.clientRequestId,
    };
    if (aiConsent === "accepted") {
      await analyzeCapture(preservedCapture);
    } else {
      await prepareManualCapture(preservedCapture);
    }
  };

  useEffect(() => {
    const userId = session?.user.id;
    if (
      !pendingId ||
      !userId ||
      fishesLoading ||
      resumedPendingId.current === pendingId
    ) {
      return;
    }
    resumedPendingId.current = pendingId;
    let active = true;

    const resume = async () => {
      const pending = await getPendingCatch(userId, pendingId);
      if (!pending) {
        if (active) {
          await alert({
            eyebrow: "LOCAL RECORD · NOTICE",
            title: "복구할 기록이 없습니다",
            message: "이미 저장했거나 삭제된 기록입니다.",
          });
          router.replace("/(tabs)");
        }
        return;
      }
      const base64 = await readPendingCatchBase64(pending);
      if (!active) return;

      const restoredCapture: Capture = {
        uri: pending.localImageUri,
        width: pending.imageWidth,
        height: pending.imageHeight,
        base64,
        mimeType: pending.mimeType,
        latitude: pending.latitude,
        longitude: pending.longitude,
        capturedAt: pending.capturedAt,
        locationAccuracyM: pending.locationAccuracyM,
        locationCapturedAt: pending.locationCapturedAt,
        source:
          pending.captureMethod === "photo_library"
            ? "photo_library"
            : "camera",
        tripId: pending.tripId,
        tripName: pending.tripName,
        pendingCatchId: pending.localId,
        clientRequestId: pending.clientRequestId,
      };
      saveRequestId.current = pending.clientRequestId;
      setCapture(restoredCapture);
      setRecognitionCandidates(pending.candidates);
      setRecognitionAnalysis(pending.recognitionAnalysis ?? null);
      setRecognitionNote(pending.recognitionAnalysis?.note ?? null);
      setNeedsRetake(pending.recognitionAnalysis?.status === "rejected");
      setSize(pending.sizeCm == null ? "" : String(pending.sizeCm));
      setMemo(pending.memo ?? "");
      setSelectedFish(
        pending.selectedFishId
          ? (fishes.find((fish) => fish.id === pending.selectedFishId) ?? null)
          : null,
      );
      setCustomSpeciesName(pending.customSpeciesName);

      // 분석이 아직 없거나 실패(status 'failed')로 끝난 기록은 이어갈 때 다시
      // 분석한다. 'rejected'는 재촬영 안내가 뜨므로 재분석하지 않는다. 종료된
      // (failed_terminal) 기록도 사용자가 직접 열었을 때는 한 번 더 시도한다.
      const analysisUnresolved =
        !pending.recognitionAnalysis ||
        pending.recognitionAnalysis.status === "failed";
      if (
        pending.status === "pending_analysis" ||
        ((pending.status === "failed_retryable" ||
          pending.status === "failed_terminal") &&
          !pending.selectedFishId &&
          pending.candidates.length === 0 &&
          analysisUnresolved)
      ) {
        if (pending.analysisRequested) {
          await analyzeCapture(restoredCapture);
        } else {
          await prepareManualCapture(restoredCapture);
        }
      }
    };

    void resume().catch(async (error) => {
      if (!active) return;
      const message =
        error instanceof Error
          ? error.message
          : "보관된 조과를 복구하지 못했습니다.";
      await updatePendingCatch(userId, pendingId, {
        status: "failed_retryable",
        lastError: message,
      });
      await alert({ eyebrow: "LOCAL RECORD · ERROR", title: "기록 복구 실패", message });
    });

    return () => {
      active = false;
    };
  }, [fishes, fishesLoading, pendingId, router, session?.user.id]);

  // 이 화면이 다루는 job은 포그라운드 잠금으로 표시해 백그라운드 워커가 같은 job을
  // 동시에 올리지 않게 한다. 오래 머무는 경우를 위해 주기적으로 갱신한다.
  const lockedPendingCatchId = capture?.pendingCatchId ?? null;
  const lockUserId = session?.user.id ?? null;
  useEffect(() => {
    if (!lockedPendingCatchId || !lockUserId) return;
    void lockPendingCatch(lockUserId, lockedPendingCatchId, "foreground");
    const refresh = setInterval(() => {
      void lockPendingCatch(lockUserId, lockedPendingCatchId, "foreground");
    }, 5 * 60_000);
    return () => {
      clearInterval(refresh);
      void unlockPendingCatch(lockUserId, lockedPendingCatchId, "foreground");
    };
  }, [lockUserId, lockedPendingCatchId]);

  // 화면을 떠날 때 분석이 진행 중이면 결과를 버리고, job은 백그라운드가 이어받도록
  // pending_analysis로 되돌린다.
  useEffect(
    () => () => {
      analysisGeneration.current += 1;
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      const inFlight = inFlightAnalysis.current;
      if (inFlight) {
        inFlightAnalysis.current = null;
        void updatePendingCatch(inFlight.userId, inFlight.pendingCatchId, {
          status: "pending_analysis",
          nextRetryAt: null,
        });
      }
    },
    [],
  );

  const retryRecognition = async () => {
    if (!capture || isRecognizing) return;
    await analyzeCapture(capture);
  };

  const retakePhoto = () => {
    // 진행 중인 분석은 무효화한다. 결과가 와도 새 사진에 붙지 않는다.
    analysisGeneration.current += 1;
    inFlightAnalysis.current = null;
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = null;
    setRecognitionSlow(false);
    if (capture && session?.user.id) {
      void removePendingCatch(session.user.id, capture.pendingCatchId);
    }
    setCapture(null);
    setSelectedFish(null);
    setCustomSpeciesName(null);
    setCompletion(null);
    setRecognitionCandidates([]);
    setRecognitionNote(null);
    setRecognitionAnalysis(null);
    setNeedsRetake(false);
    setCatalogVisible(false);
  };

  const pickLibraryPhoto = async () => {
    if (fishesLoading) {
      await alert({
        eyebrow: "FIELD GUIDE · LOADING",
        title: "도감을 준비하고 있습니다",
        message: "도감 60종을 불러온 뒤 다시 시도해 주세요.",
      });
      return;
    }

    try {
      const previousCapture = capture;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        exif: true,
        quality: 1,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        throw new Error("판별에 필요한 이미지 데이터를 읽지 못했습니다.");
      }
      const optimized = await optimizeUserPhoto({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        includeBase64: true,
      });
      if (
        !optimized.base64 ||
        optimized.base64.length > MAX_RECOGNITION_BASE64_LENGTH
      ) {
        throw new Error("사진이 너무 큽니다. 10MB 이하의 JPG 또는 PNG를 선택해 주세요.");
      }
      const metadata = await extractLibraryPhotoMetadata(asset);
      void trackAnalyticsEvent("photo_captured", {
        source: "photo_library",
        has_position:
          metadata.latitude != null && metadata.longitude != null,
        has_capture_time: Boolean(metadata.capturedAt),
      });

      await preserveAndPrepareCapture({
        uri: optimized.uri,
        width: optimized.width,
        height: optimized.height,
        base64: optimized.base64,
        mimeType: optimized.mimeType,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        capturedAt: metadata.capturedAt,
        locationAccuracyM: null,
        locationCapturedAt: null,
        source: "photo_library",
        tripId: tripId ?? null,
        tripName: tripName ?? null,
      });
      if (previousCapture && session?.user.id) {
        await removePendingCatch(
          session.user.id,
          previousCapture.pendingCatchId,
        );
      }
    } catch (error) {
      await alert({
        eyebrow: "PHOTO · ERROR",
        title: "사진 불러오기 실패",
        message: error instanceof Error ? error.message : "다른 사진으로 다시 시도해 주세요.",
      });
    }
  };

  const handleRequestCameraPermission = async () => {
    if (isRequestingCameraPermission) return;

    setIsRequestingCameraPermission(true);
    void trackAnalyticsEvent("permission_prompted", {
      permission_kind: "camera",
    });
    try {
      const nextPermission = await requestCameraPermission();
      lastCameraPermission.current = nextPermission;
      void trackAnalyticsEvent("permission_result", {
        permission_kind: "camera",
        granted: nextPermission.granted,
        can_ask_again: nextPermission.canAskAgain,
      });
      if (!nextPermission.granted) {
        setIsRequestingCameraPermission(false);
      }
    } catch {
      setIsRequestingCameraPermission(false);
      void alert({
        eyebrow: "CAMERA · PERMISSION",
        title: "권한 요청 실패",
        message: "카메라 권한을 다시 요청해 주세요.",
      });
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      let locationPermission = await Location.getForegroundPermissionsAsync();
      if (!locationPermission.granted && locationPermission.canAskAgain) {
        const wantsLocation = await confirm({
          eyebrow: "FIELD CATCH · LOCATION",
          title: "촬영 위치를 인증할까요?",
          message: "위치를 허용하면 조과를 지도와 도감 해금에 반영합니다. 위치 없이도 사진 분석과 조과 기록은 계속할 수 있습니다.",
          cancelLabel: "위치 없이 계속",
          confirmLabel: "위치 허용",
        });
        void trackAnalyticsEvent("location_choice_selected", {
          choice: wantsLocation ? "request_permission" : "without_position",
        });
        if (wantsLocation) {
          void trackAnalyticsEvent("permission_prompted", {
            permission_kind: "foreground_position",
          });
          locationPermission =
            await Location.requestForegroundPermissionsAsync();
          void trackAnalyticsEvent("permission_result", {
            permission_kind: "foreground_position",
            granted: locationPermission.granted,
            can_ask_again: locationPermission.canAskAgain,
          });
        }
      } else {
        void trackAnalyticsEvent("location_choice_selected", {
          choice: locationPermission.granted
            ? "previously_granted"
            : "previously_denied",
        });
      }

      const capturedAt = new Date().toISOString();
      const [photo, position] = await Promise.all([
        cameraRef.current.takePictureAsync({ quality: 0.9 }),
        locationPermission.granted
          ? Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (!photo?.uri) {
        throw new Error("AI 판정을 위한 사진 데이터를 만들지 못했습니다.");
      }
      const optimized = await optimizeUserPhoto({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        includeBase64: true,
      });
      if (
        !optimized.base64 ||
        optimized.base64.length > MAX_RECOGNITION_BASE64_LENGTH
      ) {
        throw new Error("사진을 전송 가능한 크기로 최적화하지 못했습니다.");
      }

      const nextCapture: Omit<
        Capture,
        "pendingCatchId" | "clientRequestId"
      > = {
        uri: optimized.uri,
        width: optimized.width,
        height: optimized.height,
        base64: optimized.base64,
        mimeType: optimized.mimeType,
        latitude: position?.coords.latitude ?? null,
        longitude: position?.coords.longitude ?? null,
        capturedAt,
        locationAccuracyM: position?.coords.accuracy ?? null,
        locationCapturedAt: position
          ? new Date(position.timestamp).toISOString()
          : null,
        source: "camera",
        tripId: tripId ?? null,
        tripName: tripName ?? null,
      };
      void trackAnalyticsEvent("photo_captured", {
        source: "camera",
        has_position: Boolean(position),
      });
      await preserveAndPrepareCapture(nextCapture);
    } catch (error) {
      await alert({
        eyebrow: "CAMERA · ERROR",
        title: "촬영 실패",
        message: error instanceof Error ? error.message : "다시 시도해 주세요.",
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const parseOptionalSize = () => {
    const result = parseSizeInput(size);
    setSizeError(result.error);
    return result;
  };

  const save = async () => {
    if (
      !capture ||
      (!selectedFish && !customSpeciesName) ||
      isSaving
    ) return;
    const sizeResult = parseOptionalSize();
    if (!sizeResult.isValid) return;

    const selectedCandidate = recognitionCandidates.find(
      (candidate) => candidate.fishId === selectedFish?.id,
    );
    const userId = session?.user.id;
    if (!userId) {
      await alert({
        eyebrow: "FIELD CATCH · LOGIN",
        title: "로그인이 필요합니다",
        message: "조과를 저장하려면 다시 로그인해 주세요.",
      });
      return;
    }
    const currentPending = await getPendingCatch(
      userId,
      capture.pendingCatchId,
    );
    await updatePendingCatch(userId, capture.pendingCatchId, {
      selectedFishId: selectedFish?.id ?? null,
      customSpeciesName,
      candidateFishIds: recognitionCandidates.map(
        (candidate) => candidate.fishId,
      ),
      candidates: recognitionCandidates,
      sizeCm: sizeResult.sizeCm ?? null,
      memo: memo.trim() || null,
      status: "pending_upload",
      attemptCount: (currentPending?.attemptCount ?? 0) + 1,
      lastError: null,
      nextRetryAt: null,
    });
    await updatePendingCatch(userId, capture.pendingCatchId, {
      status: "uploading",
    });
    const result = await createCatch({
      tripId: capture.tripId ?? undefined,
      fishId: selectedFish?.id,
      customSpeciesName: customSpeciesName ?? undefined,
      imageUri: capture.uri,
      mimeType: capture.mimeType,
      imageWidth: capture.width,
      imageHeight: capture.height,
      latitude: capture.latitude ?? undefined,
      longitude: capture.longitude ?? undefined,
      capturedAt: capture.capturedAt ?? undefined,
      locationAccuracyM: capture.locationAccuracyM ?? undefined,
      locationCapturedAt: capture.locationCapturedAt ?? undefined,
      captureMethod:
        capture.source === "photo_library"
          ? "photo_library"
          : "live_camera",
      sizeCm: sizeResult.sizeCm,
      memo,
      candidateFishIds: recognitionCandidates.map(
        (candidate) => candidate.fishId,
      ),
      idMethod: selectedFish
        ? selectedCandidate
          ? "closed_set_candidates"
          : "fallback_catalog"
        : undefined,
      clientRequestId:
        saveRequestId.current ?? capture.clientRequestId,
    });
    if (result.error) {
      await updatePendingCatch(userId, capture.pendingCatchId, {
        status: "failed_retryable",
        lastError: result.error.message,
        nextRetryAt: new Date(Date.now() + 15_000).toISOString(),
      });
      await alert({
        eyebrow: "FIELD CATCH · SAVE ERROR",
        title: "저장하지 못했습니다",
        message: result.error.message,
      });
      return;
    }
    await removePendingCatch(userId, capture.pendingCatchId);
    if (selectedCandidate && selectedFish) {
      void trackAnalyticsEvent("ai_candidate_confirmed", {
        candidate_rank:
          recognitionCandidates.findIndex(
            (candidate) => candidate.fishId === selectedFish.id,
          ) + 1,
        candidate_count: recognitionCandidates.length,
      });
    } else {
      void trackAnalyticsEvent("manual_species_confirmed", {
        had_ai_candidates: recognitionCandidates.length > 0,
        outside_catalog: Boolean(customSpeciesName),
      });
    }
    setCompletion({
      fish: selectedFish,
      customSpeciesName,
      catchId: result.catchId,
      isFirstDiscovery: result.isFirstDiscovery,
      isDevelopmentTest: false,
      isFileUpload: capture.source === "photo_library",
      discoveredCount: result.discoveredCount,
      verificationStatus: result.verificationStatus,
      verificationReason: result.verificationReason,
      sizeCm: sizeResult.sizeCm,
    });
  };

  // 출조 중 기록이면 완료 후 그 출조 상세로 돌아간다. 기록 화면은 fullScreenModal이라
  // replace로 닫는다.
  const completionTripId = capture?.tripId ?? tripId ?? null;
  const viewCompletionTrip = () => {
    if (!completionTripId) return;
    router.replace({ pathname: "/trips/[id]", params: { id: completionTripId } });
  };

  const viewCompletionRecord = () => {
    router.replace({
      pathname: "/(tabs)/encyclopedia",
      params: {
        segment: "cards",
        ...(visibleCompletion?.catchId
          ? { catchId: visibleCompletion.catchId }
          : {}),
      },
    });
  };

  const viewCompletionEncyclopedia = () => {
    if (!visibleCompletion?.fish) return;
    router.replace({
      pathname: "/fishes/[id]",
      params: { id: visibleCompletion.fish.id },
    });
  };

  const recordAnotherCatch = () => {
    setCompletion(null);
    setCapture(null);
    setSelectedFish(null);
    setCustomSpeciesName(null);
    setRecognitionCandidates([]);
    setRecognitionNote(null);
    setRecognitionAnalysis(null);
    setNeedsRetake(false);
    setRecognitionSlow(false);
    setSize("");
    setMemo("");
    saveRequestId.current = null;
  };

  if (visibleCompletion) {
    return (
      <>
        <CatchCompletionView
        fish={visibleCompletion.fish}
        customSpeciesName={visibleCompletion.customSpeciesName}
        isFirstDiscovery={visibleCompletion.isFirstDiscovery}
        isDevelopmentTest={visibleCompletion.isDevelopmentTest}
        isFileUpload={visibleCompletion.isFileUpload}
        discoveredCount={visibleCompletion.discoveredCount}
        verificationStatus={visibleCompletion.verificationStatus}
        verificationReason={visibleCompletion.verificationReason}
        sizeCm={visibleCompletion.sizeCm}
        onViewRecord={viewCompletionRecord}
        onViewEncyclopedia={viewCompletionEncyclopedia}
        onShare={() => setShareCardVisible(true)}
        onRecordAnother={
          capture?.tripId || tripId ? recordAnotherCatch : undefined
        }
        onGoHome={() => router.replace("/(tabs)")}
        tripName={capture?.tripName ?? tripName ?? null}
        onViewTrip={completionTripId ? viewCompletionTrip : undefined}
        />
        <ShareCatchCardModal
          item={completionShareItem}
          visible={shareCardVisible}
          onClose={() => setShareCardVisible(false)}
          source="completion"
        />
      </>
    );
  }

  if (aiConsent === "loading") {
    return <AiConsentLoadingScreen />;
  }

  if (aiConsent === "pending") {
    return (
      <AiConsentScreen
        onAccept={acceptAiPhotoConsent}
        onContinueWithoutAi={beginManualPhotoFlow}
        onBack={() => router.back()}
      />
    );
  }

  if (!capture && !effectiveCameraPermission?.granted) {
    return (
      <CameraPermissionScreen
        isPermissionLoading={effectiveCameraPermission == null}
        isRequesting={isRequestingCameraPermission}
        onRequestPermission={handleRequestCameraPermission}
        onPickLibrary={pickLibraryPhoto}
        onBack={() => router.back()}
      />
    );
  }

  if (!capture) {
    return (
      <CameraCaptureScreen
        cameraRef={cameraRef}
        tripName={tripName}
        isCapturing={isCapturing}
        onTakePhoto={takePhoto}
        onPickLibrary={pickLibraryPhoto}
        onBack={() => router.back()}
      />
    );
  }

  const selectFish = (fish: Fish) => {
    setSelectedFish(fish);
    setCustomSpeciesName(null);
    setCompletion(null);
  };

  return (
    <CatchReviewScreen
      capture={capture}
      aiEnabled={aiConsent === "accepted"}
      recognition={{
        isRecognizing,
        isSlow: recognitionSlow,
        error: recognitionError,
        needsRetake,
        note: recognitionNote,
        analysis: recognitionAnalysis,
        candidateRows,
      }}
      selectedFish={selectedFish}
      customSpeciesName={customSpeciesName}
      form={{ size, sizeError, memo, isSaving }}
      onBack={() => router.back()}
      onChangePhoto={capture.source === "photo_library" ? pickLibraryPhoto : retakePhoto}
      onSelectFish={selectFish}
      onClearSelection={() => {
        setSelectedFish(null);
        setCustomSpeciesName(null);
        setCompletion(null);
      }}
      onOpenCatalog={() => setCatalogVisible(true)}
      onRetry={retryRecognition}
      onRetake={retakePhoto}
      onSizeChange={(value) => {
        setSize(value);
        if (sizeError) setSizeError(null);
      }}
      onMemoChange={setMemo}
      onSave={save}
      overlay={
        <FishCatalogSheet
          fishes={fishes}
          isLoading={fishesLoading}
          visible={catalogVisible}
          onClose={() => setCatalogVisible(false)}
          onSelect={selectFish}
          onSelectCustom={(name) => {
            setSelectedFish(null);
            setCustomSpeciesName(name);
            setCompletion(null);
          }}
        />
      }
    />
  );
};

// Keep notices inside the native full-screen record route so iOS can present them.
// 딥링크(baited-brothers://record)로 비로그인 진입하면 카메라 대신 로그인으로 보낸다.
export default function RecordRoute() {
  const { session, isLoading } = useAuth();
  if (!__DEV__ && !session) {
    if (isLoading) return null;
    return <Redirect href="/(auth)/login" />;
  }
  return <FieldNoticeProvider><RecordScreen /></FieldNoticeProvider>;
}
