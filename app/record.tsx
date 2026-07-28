import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFishes, type Fish } from "@/src/hooks/useFishes";
import { useCreateCatch } from "@/src/hooks/useCreateCatch";
import {
  useFishRecognition,
  type FishRecognitionCandidate,
} from "@/src/hooks/useFishRecognition";
import type { CatchVerificationStatus } from "@/src/lib/catchRewards";
import { CatchCompletionView } from "@/components/record/CatchCompletionView";
import { FishCatalogSheet } from "@/components/record/FishCatalogSheet";
import { getField60Illustration } from "@/src/data/field60Illustrations";
import { optimizeUserPhoto } from "@/src/lib/optimizeUserPhoto";
import { extractLibraryPhotoMetadata } from "@/src/lib/photoMetadata";
import { trackAnalyticsEvent } from "@/src/lib/analytics";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, monoFont } from "@/src/theme/fieldJournal";

type Capture = {
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
};

type CompletionResult = {
  fish: Fish;
  catchId: string | null;
  isFirstDiscovery: boolean;
  isDevelopmentTest: boolean;
  isFileUpload: boolean;
  discoveredCount: number;
  verificationStatus: CatchVerificationStatus;
  verificationReason: string | null;
  sizeCm?: number;
};

const MAX_RECOGNITION_BASE64_LENGTH = 13_500_000;
const AI_PHOTO_CONSENT_KEY = "ai-photo-consent-v1";
const PRIVACY_POLICY_URL =
  "https://sigcrew.github.io/baited-brothers/privacy/";

const askToAttachLocation = () =>
  new Promise<boolean>((resolve) => {
    let resolved = false;
    const finish = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    Alert.alert(
      "촬영 위치를 인증할까요?",
      "위치를 허용하면 조과를 지도와 도감 해금에 반영합니다. 위치 없이도 사진 분석과 조과 기록은 계속할 수 있습니다.",
      [
        {
          text: "위치 없이 계속",
          style: "cancel",
          onPress: () => finish(false),
        },
        {
          text: "위치 허용",
          onPress: () => finish(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => finish(false),
      },
    );
  });

const RecordScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tripId?: string;
    tripName?: string;
    completionPreview?: string;
  }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;
  const tripName = typeof params.tripName === "string" ? params.tripName : undefined;
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const saveRequestId = useRef<string | null>(null);
  const flowTracked = useRef(false);
  const cameraOpenedTracked = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const lastCameraPermission = useRef(cameraPermission);
  if (cameraPermission) {
    lastCameraPermission.current = cameraPermission;
  }
  const effectiveCameraPermission =
    cameraPermission ?? lastCameraPermission.current;
  const [capture, setCapture] = useState<Capture | null>(null);
  const [selectedFish, setSelectedFish] = useState<Fish | null>(null);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [size, setSize] = useState("");
  const [memo, setMemo] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRequestingCameraPermission, setIsRequestingCameraPermission] =
    useState(false);
  const [recognitionCandidates, setRecognitionCandidates] = useState<
    FishRecognitionCandidate[]
  >([]);
  const [recognitionNote, setRecognitionNote] = useState<string | null>(null);
  const [needsRetake, setNeedsRetake] = useState(false);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [aiConsent, setAiConsent] = useState<
    "loading" | "pending" | "accepted"
  >("loading");
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

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(AI_PHOTO_CONSENT_KEY)
      .then((value) => {
        if (active) setAiConsent(value === "accepted" ? "accepted" : "pending");
      })
      .catch(() => {
        if (active) setAiConsent("pending");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (aiConsent !== "accepted" || flowTracked.current) return;
    flowTracked.current = true;
    void trackAnalyticsEvent("catch_flow_started", {
      has_trip: Boolean(tripId),
    });
  }, [aiConsent, tripId]);

  useEffect(() => {
    if (
      aiConsent !== "accepted" ||
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
      await AsyncStorage.setItem(AI_PHOTO_CONSENT_KEY, "accepted");
    } catch {
      // 현재 사용 흐름에서는 동의를 유지하고 다음 실행에서 다시 안내합니다.
    }
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
    saveRequestId.current = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    setCapture(nextCapture);
    setSelectedFish(null);
    setCompletion(null);
    setRecognitionCandidates([]);
    setRecognitionNote(null);
    setNeedsRetake(false);
    setCatalogVisible(false);

    const result = await recognize({
      imageBase64: nextCapture.base64,
      mimeType: nextCapture.mimeType,
      fishes,
    });
    setRecognitionCandidates(result.candidates);
    setRecognitionNote(result.note);
    setNeedsRetake(result.needsRetake);
    void trackAnalyticsEvent("analysis_result_viewed", {
      candidate_count: result.candidates.length,
      needs_retake: result.needsRetake,
      has_error: Boolean(result.error),
    });
  };

  const retryRecognition = async () => {
    if (!capture || isRecognizing) return;
    await analyzeCapture(capture);
  };

  const retakePhoto = () => {
    setCapture(null);
    setSelectedFish(null);
    setCompletion(null);
    setRecognitionCandidates([]);
    setRecognitionNote(null);
    setNeedsRetake(false);
    setCatalogVisible(false);
  };

  const pickLibraryPhoto = async () => {
    if (isRecognizing) return;
    if (fishesLoading) {
      Alert.alert("도감 준비 중", "도감 60종을 불러온 뒤 다시 시도해 주세요.");
      return;
    }

    try {
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

      await analyzeCapture({
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
      });
    } catch (error) {
      Alert.alert(
        "사진 불러오기 실패",
        error instanceof Error ? error.message : "다른 사진으로 다시 시도해 주세요.",
      );
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
      Alert.alert("권한 요청 실패", "카메라 권한을 다시 요청해 주세요.");
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      let locationPermission = await Location.getForegroundPermissionsAsync();
      if (!locationPermission.granted && locationPermission.canAskAgain) {
        const wantsLocation = await askToAttachLocation();
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

      const nextCapture: Capture = {
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
      };
      void trackAnalyticsEvent("photo_captured", {
        source: "camera",
        has_position: Boolean(position),
      });
      await analyzeCapture(nextCapture);
    } catch (error) {
      Alert.alert("촬영 실패", error instanceof Error ? error.message : "다시 시도해 주세요.");
    } finally {
      setIsCapturing(false);
    }
  };

  const parseOptionalSize = () => {
    if (!size.trim()) return { isValid: true, sizeCm: undefined };
    const parsedSize = Number(size);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      Alert.alert("크기 확인", "크기는 0보다 큰 숫자로 입력해 주세요.");
      return { isValid: false, sizeCm: undefined };
    }
    return { isValid: true, sizeCm: parsedSize };
  };

  const save = async () => {
    if (!capture || !selectedFish || isSaving) return;
    const sizeResult = parseOptionalSize();
    if (!sizeResult.isValid) return;

    const selectedCandidate = recognitionCandidates.find(
      (candidate) => candidate.fishId === selectedFish.id,
    );
    const result = await createCatch({
      tripId,
      fishId: selectedFish.id,
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
      idMethod: selectedCandidate
        ? "closed_set_candidates"
        : "fallback_catalog",
      clientRequestId:
        saveRequestId.current ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    });
    if (result.error) {
      Alert.alert("저장 실패", result.error.message);
      return;
    }
    if (selectedCandidate) {
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
      });
    }
    setCompletion({
      fish: selectedFish,
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

  const viewCompletionRecord = () => {
    if (tripId && !visibleCompletion?.isDevelopmentTest) {
      router.replace({ pathname: "/trips/[id]", params: { id: tripId } });
      return;
    }
    router.replace("/(tabs)/journal");
  };

  const viewCompletionEncyclopedia = () => {
    if (!visibleCompletion) return;
    router.replace({
      pathname: "/fishes/[id]",
      params: { id: visibleCompletion.fish.id },
    });
  };

  if (visibleCompletion) {
    return (
      <CatchCompletionView
        fish={visibleCompletion.fish}
        isFirstDiscovery={visibleCompletion.isFirstDiscovery}
        isDevelopmentTest={visibleCompletion.isDevelopmentTest}
        isFileUpload={visibleCompletion.isFileUpload}
        discoveredCount={visibleCompletion.discoveredCount}
        verificationStatus={visibleCompletion.verificationStatus}
        verificationReason={visibleCompletion.verificationReason}
        sizeCm={visibleCompletion.sizeCm}
        onViewRecord={viewCompletionRecord}
        onViewEncyclopedia={viewCompletionEncyclopedia}
        onGoHome={() => router.replace("/(tabs)")}
      />
    );
  }

  if (aiConsent === "loading") {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <ActivityIndicator color={FIELD_COLORS.teal} />
        <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          사진 처리 동의 상태를 확인하고 있어요
        </Text>
      </View>
    );
  }

  if (aiConsent === "pending") {
    return (
      <View
        className="flex-1 justify-center px-7"
        style={{
          backgroundColor: FIELD_COLORS.foam,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Text
          className="text-[10px] tracking-[1.5px]"
          style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
        >
          AI PHOTO ANALYSIS
        </Text>
        <Text
          className="mt-4 text-[32px] leading-[42px]"
          style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
        >
          사진 판별 전{`\n`}확인이 필요해요
        </Text>
        <Text
          className="mt-5 text-[15px] leading-7"
          style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}
        >
          촬영한 물고기 사진은 어종 후보 추천을 위해 Supabase 보안 함수를
          거쳐 Anthropic으로 전송됩니다. 위치 정보는 AI에 전송하지 않으며,
          사진은 어종을 확정해 기록할 때만 앱 저장소에 보관됩니다.
        </Text>
        <View
          className="mt-6 border-l-4 bg-white px-4 py-4"
          style={{ borderLeftColor: FIELD_COLORS.orange }}
        >
          <Text
            className="text-sm leading-6"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
          >
            AI 결과는 참고용이며 최종 어종은 사용자가 직접 선택합니다.
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={acceptAiPhotoConsent}
          className="mt-7 items-center py-4"
          style={{ backgroundColor: FIELD_COLORS.teal }}
        >
          <Text className="text-base text-white" style={{ fontFamily: bodyExtraBoldFont }}>
            동의하고 카메라 열기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          className="mt-4 items-center py-2"
        >
          <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
            개인정보 처리방침 보기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-2 items-center py-2">
          <Text style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
            동의하지 않고 돌아가기
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!effectiveCameraPermission?.granted) {
    const isPermissionLoading = effectiveCameraPermission == null;
    const isPermissionBusy =
      isPermissionLoading || isRequestingCameraPermission;

    return (
      <View className="flex-1 items-center justify-center bg-slate-950 px-8">
        <Text className="text-xl font-bold text-white">
          카메라 권한이 필요해요
        </Text>
        <Text className="mt-3 text-center text-slate-300">
          카메라를 허용하면 현장 인증 촬영을 할 수 있습니다. 사진 보관함
          기록은 카메라 권한 없이도 이용할 수 있습니다.
        </Text>
        {isPermissionBusy ? (
          <View className="mt-6 flex-row items-center rounded-xl bg-white px-6 py-3">
            <ActivityIndicator color="#0f172a" />
            <Text className="ml-3 font-semibold text-slate-900">
              {isPermissionLoading ? "권한 상태 확인 중" : "권한 요청 중"}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleRequestCameraPermission}
            className="mt-6 rounded-xl bg-white px-6 py-3"
          >
            <Text className="font-semibold text-slate-900">권한 허용</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          accessibilityLabel="사진 보관함에서 물고기 사진 선택"
          accessibilityRole="button"
          onPress={pickLibraryPhoto}
          className="mt-4 border border-white/50 px-6 py-3"
        >
          <Text className="font-semibold text-white">
            사진 보관함에서 선택
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 py-2">
          <Text className="text-slate-400">돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!capture) {
    return (
      <View className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="picture" />
        <View className="absolute left-0 right-0 top-0 flex-row justify-between px-5" style={{ paddingTop: insets.top + 12 }}>
          <TouchableOpacity onPress={() => router.back()} className="rounded-lg bg-black/50 px-4 py-2">
            <Text className="font-medium text-white">닫기</Text>
          </TouchableOpacity>
          <View className="rounded-lg bg-black/50 px-3 py-2"><Text className="text-sm text-white">{tripName ? `${tripName} · 현장 기록` : "사진 기록 · GPS 선택"}</Text></View>
        </View>
        <View className="absolute bottom-0 left-0 right-0 items-center bg-black/40 pb-8 pt-5" style={{ paddingBottom: insets.bottom + 24 }}>
          <Text className="mb-4 text-sm text-white">물고기 전체가 잘 보이게 촬영해 주세요</Text>
          <TouchableOpacity
            accessibilityLabel="사진 보관함에서 물고기 사진 선택"
            accessibilityRole="button"
            onPress={pickLibraryPhoto}
            className="mb-4 border border-white/60 bg-black/40 px-5 py-3"
          >
            <Text className="font-semibold text-white">
              사진 보관함에서 선택
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="사진 촬영"
            disabled={isCapturing}
            onPress={takePhoto}
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/30"
          >
            {isCapturing ? <ActivityIndicator color="#fff" /> : <View className="h-16 w-16 rounded-full bg-white" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-[#F4F7F8]">
      <View
        className="flex-row items-center justify-between border-b bg-white px-4 pb-3"
        style={{ paddingTop: insets.top + 10, borderBottomColor: FIELD_COLORS.rule }}
      >
        <TouchableOpacity onPress={() => router.back()} className="w-14 py-2">
          <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
            취소
          </Text>
        </TouchableOpacity>
        <Text
          className="text-lg"
          style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
        >
          조과 확인
        </Text>
        <View className="w-14" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
            <Image source={{ uri: capture.uri }} className="h-56 w-full rounded-xl bg-slate-200" resizeMode="cover" />
            <View className="mt-3 flex-row justify-between">
              <Text className="text-xs text-teal-800">
                {capture.source === "photo_library"
                  ? capture.latitude != null &&
                    capture.longitude != null &&
                    capture.capturedAt
                    ? "사진 위치 확인됨 · 인증 조과 심사 대상"
                    : "사진 위치 없음 · 일반 기록으로 저장"
                  : capture.latitude != null && capture.longitude != null
                    ? "GPS 확보 완료 · 서버 인증 예정"
                    : "위치 미인증 · 지도와 도감 해금에서 제외"}
              </Text>
              <TouchableOpacity
                onPress={
                  capture.source === "photo_library"
                    ? pickLibraryPhoto
                    : () => {
                        setCapture(null);
                        setSelectedFish(null);
                        setCompletion(null);
                      }
                }
              >
                <Text className="text-sm font-medium text-slate-600">
                  {capture.source === "photo_library"
                    ? "다른 사진"
                    : "다시 찍기"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              className="mt-6 text-[24px]"
              style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
            >
              어종을 확정해 주세요
            </Text>
            <Text
              className="mt-1 text-sm leading-6"
              style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
            >
              AI가 도감 60종 안에서 후보를 찾습니다. 추천 결과는 참고용이며
              최종 선택은 직접 확인해 주세요.
            </Text>
            <View
              className="mt-4 border-l-4 bg-white px-4 py-3"
              style={{ borderLeftColor: FIELD_COLORS.orange }}
            >
              <Text
                className="text-xs leading-5"
                style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
              >
                AI가 어종을 자동으로 확정하거나 기록하지 않습니다. 후보 또는
                도감 검색에서 어종을 선택한 뒤 직접 기록해 주세요.
              </Text>
            </View>
            {selectedFish ? (
              <View
                className="mt-4 border p-4"
                style={{ borderColor: FIELD_COLORS.teal, backgroundColor: "#EAF4F1" }}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text
                      className="text-xl"
                      style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
                    >
                      {selectedFish.name_ko ?? selectedFish.name}
                    </Text>
                    <Text
                      className="mt-1 text-[10px] uppercase tracking-[1px]"
                      style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
                    >
                      {selectedFish.name}
                    </Text>
                  </View>
                  <Text
                    className="text-[10px] tracking-[1px]"
                    style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
                  >
                    사용자 확인
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedFish(null);
                    setCompletion(null);
                  }}
                  className="mt-4 self-start border-b pb-1"
                  style={{ borderBottomColor: FIELD_COLORS.teal }}
                >
                  <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                    다른 어종 선택
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {isRecognizing ? (
                  <View
                    className="mt-5 flex-row items-center border px-4 py-5"
                    style={{ borderColor: FIELD_COLORS.rule, backgroundColor: "#fff" }}
                  >
                    <ActivityIndicator color={FIELD_COLORS.teal} />
                    <View className="ml-4 flex-1">
                      <Text
                        style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
                      >
                        사진의 특징을 비교하고 있어요
                      </Text>
                      <Text
                        className="mt-1 text-xs"
                        style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
                      >
                        체형·지느러미·무늬를 도감 60종과 대조합니다.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {!isRecognizing && candidateRows.length > 0 ? (
                  <View className="mt-5">
                    <View className="flex-row items-end justify-between">
                      <Text
                        className="text-lg"
                        style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
                      >
                        AI 어종 후보 추천
                      </Text>
                      <Text
                        className="text-[9px] tracking-[1px]"
                        style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
                      >
                        TOP {candidateRows.length}
                      </Text>
                    </View>
                    {candidateRows.map(({ candidate, fish }, index) => {
                      const illustration = getField60Illustration(
                        fish.catalog_sort_order,
                        "color",
                      );
                      return (
                        <TouchableOpacity
                          key={fish.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${index + 1}순위 후보, ${fish.name_ko ?? fish.name}`}
                          onPress={() => {
                            setSelectedFish(fish);
                            setCompletion(null);
                          }}
                          className="mt-3 flex-row border bg-white p-3"
                          style={{ borderColor: index === 0 ? FIELD_COLORS.teal : FIELD_COLORS.rule }}
                        >
                          <View
                            className="h-20 w-24 items-center justify-center overflow-hidden"
                            style={{ backgroundColor: FIELD_COLORS.locked }}
                          >
                            {illustration ? (
                              <Image
                                source={illustration}
                                className="h-full w-full"
                                resizeMode="contain"
                              />
                            ) : null}
                          </View>
                          <View className="min-w-0 flex-1 pl-4">
                            <View className="flex-row items-center justify-between">
                              <Text
                                className="text-lg"
                                style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
                              >
                                {fish.name_ko ?? fish.name}
                              </Text>
                              <Text
                                className="text-sm"
                                style={{ color: FIELD_COLORS.orange, fontFamily: bodyExtraBoldFont }}
                              >
                                {index + 1}순위
                              </Text>
                            </View>
                            <Text
                              numberOfLines={1}
                              className="mt-1 text-[9px] uppercase tracking-[0.8px]"
                              style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
                            >
                              {fish.name}
                            </Text>
                            <Text
                              numberOfLines={2}
                              className="mt-2 text-xs leading-5"
                              style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
                            >
                              {candidate.reason}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {recognitionNote ? (
                      <Text
                        className="mt-3 text-xs leading-5"
                        style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
                      >
                        {recognitionNote}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {!isRecognizing && (recognitionError || needsRetake) ? (
                  <View
                    className="mt-5 border-l-4 bg-white px-4 py-4"
                    style={{ borderLeftColor: FIELD_COLORS.orange }}
                  >
                    <Text
                      style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
                    >
                      {recognitionError
                        ? "AI 추천을 불러오지 못했어요"
                        : "사진에서 식별 특징이 충분하지 않아요"}
                    </Text>
                    <Text
                      className="mt-1 text-xs leading-5"
                      style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
                    >
                      다시 촬영하거나 아래 도감 검색에서 직접 선택할 수 있습니다.
                    </Text>
                    <View className="mt-4 flex-row">
                      {recognitionError ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="AI 어종 후보 추천 다시 시도"
                          disabled={isRecognizing}
                          onPress={retryRecognition}
                          className="mr-3 border px-4 py-2"
                          style={{ borderColor: FIELD_COLORS.teal }}
                        >
                          <Text
                            style={{
                              color: FIELD_COLORS.teal,
                              fontFamily: bodyExtraBoldFont,
                            }}
                          >
                            다시 시도
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="사진 다시 촬영"
                        onPress={retakePhoto}
                        className="border px-4 py-2"
                        style={{ borderColor: FIELD_COLORS.rule }}
                      >
                        <Text
                          style={{
                            color: FIELD_COLORS.ink,
                            fontFamily: bodyExtraBoldFont,
                          }}
                        >
                          다시 촬영
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {!isRecognizing ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      candidateRows.length > 0
                        ? "추천 후보에 없는 어종을 도감에서 직접 검색"
                        : "도감에서 직접 어종 찾기"
                    }
                    onPress={() => setCatalogVisible(true)}
                    className="mt-5 items-center border py-3"
                    style={{ borderColor: FIELD_COLORS.rule }}
                  >
                    <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                      {candidateRows.length > 0
                        ? "후보에 없어요 · 직접 검색"
                        : "도감에서 직접 찾기"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
            {selectedFish ? (
              <View className="mt-5">
                {capture.source === "photo_library" ? (
                  <View
                    className="mb-5 border-l-4 bg-white px-4 py-4"
                    style={{ borderLeftColor: FIELD_COLORS.orange }}
                  >
                    <Text
                      style={{
                        color: FIELD_COLORS.ink,
                        fontFamily: bodyExtraBoldFont,
                      }}
                    >
                      사진 위치 기반 인증
                    </Text>
                    <Text
                      className="mt-1 text-xs leading-5"
                      style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
                    >
                      사진의 촬영 위치가 연안으로 확인되면 도감·배지·개인
                      최대어에 반영됩니다. 위치가 없거나 확인할 수 없으면
                      일반 기록으로 저장되며 랭킹에는 반영되지 않습니다.
                    </Text>
                  </View>
                ) : null}
                <Text className="text-sm font-medium text-slate-700">
                  크기(cm, 선택)
                </Text>
                <TextInput
                  value={size}
                  onChangeText={setSize}
                  keyboardType="decimal-pad"
                  placeholder="예: 32.5"
                  className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
                />
                <Text className="mt-4 text-sm font-medium text-slate-700">
                  메모(선택)
                </Text>
                <TextInput
                  value={memo}
                  onChangeText={setMemo}
                  multiline
                  placeholder="채비, 물때, 기억할 점"
                  className="mt-2 min-h-[88px] rounded-xl border border-slate-200 bg-white px-4 py-3"
                />
                <TouchableOpacity
                  disabled={isSaving}
                  onPress={save}
                  className="mt-6 rounded-xl bg-slate-900 py-4"
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-center font-semibold text-white">
                      사용자 확인 후 이 어종으로 기록
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
      </ScrollView>
      <FishCatalogSheet
        fishes={fishes}
        isLoading={fishesLoading}
        visible={catalogVisible}
        onClose={() => setCatalogVisible(false)}
        onSelect={(fish) => {
          setSelectedFish(fish);
          setCompletion(null);
        }}
      />
    </KeyboardAvoidingView>
  );
};

export default RecordScreen;
