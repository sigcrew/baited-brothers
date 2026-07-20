import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { CatchCompletionView } from "@/components/record/CatchCompletionView";
import { FishCatalogSheet } from "@/components/record/FishCatalogSheet";
import { getField60Illustration } from "@/src/data/field60Illustrations";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, monoFont } from "@/src/theme/fieldJournal";

type Capture = {
  uri: string;
  base64: string;
  mimeType: "image/jpeg" | "image/png";
  latitude: number | null;
  longitude: number | null;
  locationCapturedAt: string | null;
  source: "camera" | "dev_upload";
};

type CompletionResult = {
  fish: Fish;
  catchId: string | null;
  isFirstDiscovery: boolean;
  isDevelopmentTest: boolean;
  isFileUpload: boolean;
  discoveredCount: number;
  sizeCm?: number;
};

const DEV_FILE_TEST_ENABLED = __DEV__;
const MAX_RECOGNITION_BASE64_LENGTH = 13_500_000;

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
  const { fishes, isLoading: fishesLoading } = useFishes(null, "core");
  const { createCatch, isSaving } = useCreateCatch();
  const {
    recognize,
    isRecognizing,
    error: recognitionError,
  } = useFishRecognition();
  const completionPreviewMode =
    DEV_FILE_TEST_ENABLED &&
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
          sizeCm: completionPreviewMode === "existing" ? 32.5 : undefined,
        }
      : null);

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
    if (result.error || result.candidates.length === 0) {
      setCatalogVisible(true);
    }
  };

  const pickDevPhoto = async () => {
    if (!DEV_FILE_TEST_ENABLED || isRecognizing) return;
    if (fishesLoading) {
      Alert.alert("도감 준비 중", "도감 60종을 불러온 뒤 다시 시도해 주세요.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        base64: true,
        quality: 0.75,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri || !asset.base64) {
        throw new Error("판별에 필요한 이미지 데이터를 읽지 못했습니다.");
      }
      if (asset.base64.length > MAX_RECOGNITION_BASE64_LENGTH) {
        throw new Error("사진이 너무 큽니다. 10MB 이하의 JPG 또는 PNG를 선택해 주세요.");
      }

      await analyzeCapture({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType === "image/png" ? "image/png" : "image/jpeg",
        latitude: null,
        longitude: null,
        locationCapturedAt: null,
        source: "dev_upload",
      });
    } catch (error) {
      Alert.alert(
        "파일 판별 실패",
        error instanceof Error ? error.message : "다른 사진으로 다시 시도해 주세요.",
      );
    }
  };

  const handleRequestCameraPermission = async () => {
    if (isRequestingCameraPermission) return;

    setIsRequestingCameraPermission(true);
    try {
      const nextPermission = await requestCameraPermission();
      lastCameraPermission.current = nextPermission;
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
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (!locationPermission.granted) {
        Alert.alert("위치 권한 필요", "도감 해금에는 촬영 순간의 위치가 필요합니다.");
        return;
      }

      const [photo, position] = await Promise.all([
        cameraRef.current.takePictureAsync({ quality: 0.65, base64: true }),
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      ]);
      if (!photo?.uri || !photo.base64) {
        throw new Error("AI 판정을 위한 사진 데이터를 만들지 못했습니다.");
      }

      const nextCapture: Capture = {
        uri: photo.uri,
        base64: photo.base64,
        mimeType: "image/jpeg",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        locationCapturedAt: new Date(position.timestamp).toISOString(),
        source: "camera",
      };
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
      latitude: capture.latitude ?? undefined,
      longitude: capture.longitude ?? undefined,
      locationCapturedAt: capture.locationCapturedAt ?? undefined,
      captureMethod:
        capture.source === "dev_upload"
          ? "development_upload"
          : "live_camera",
      sizeCm: sizeResult.sizeCm,
      memo,
      candidateFishIds: recognitionCandidates.map(
        (candidate) => candidate.fishId,
      ),
      idMethod: selectedCandidate
        ? "closed_set_candidates"
        : "fallback_catalog",
      verificationReason: selectedCandidate
        ? `${capture.source === "dev_upload" ? "개발용 파일 업로드 · " : ""}AI 후보 추천 후 사용자 확정 · 신뢰도 ${Math.round(selectedCandidate.confidence * 100)}%`
        : `${capture.source === "dev_upload" ? "개발용 파일 업로드 · " : ""}사용자가 도감에서 직접 어종을 확정함`,
      clientRequestId:
        saveRequestId.current ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    });
    if (result.error) {
      Alert.alert("저장 실패", result.error.message);
      return;
    }
    setCompletion({
      fish: selectedFish,
      catchId: result.catchId,
      isFirstDiscovery: result.isFirstDiscovery,
      isDevelopmentTest: false,
      isFileUpload: capture.source === "dev_upload",
      discoveredCount: result.discoveredCount,
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
        sizeCm={visibleCompletion.sizeCm}
        onViewRecord={viewCompletionRecord}
        onViewEncyclopedia={viewCompletionEncyclopedia}
        onGoHome={() => router.replace("/(tabs)")}
      />
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
          현장에서 직접 촬영한 사진만 도감에 등록할 수 있습니다.
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
          <View className="rounded-lg bg-black/50 px-3 py-2"><Text className="text-sm text-white">{tripName ? `${tripName} · 현장 기록` : "사진 + GPS 인증"}</Text></View>
        </View>
        <View className="absolute bottom-0 left-0 right-0 items-center bg-black/40 pb-8 pt-5" style={{ paddingBottom: insets.bottom + 24 }}>
          <Text className="mb-4 text-sm text-white">물고기 전체가 잘 보이게 촬영해 주세요</Text>
          {DEV_FILE_TEST_ENABLED ? (
            <TouchableOpacity
              onPress={pickDevPhoto}
              className="mb-4 border border-white/60 bg-black/40 px-5 py-3"
            >
              <Text className="font-semibold text-white">개발용 사진 파일 판별</Text>
            </TouchableOpacity>
          ) : null}
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
            <Image source={{ uri: capture.uri }} className="h-56 w-full rounded-xl bg-slate-200" resizeMode="cover" />
            <View className="mt-3 flex-row justify-between">
              <Text className="text-xs text-teal-800">
                {capture.source === "dev_upload"
                  ? "DEV ONLY · 파일 업로드 · 실제 저장"
                  : "GPS 확보 완료 · 현장 촬영"}
              </Text>
              <TouchableOpacity
                onPress={
                  capture.source === "dev_upload"
                    ? pickDevPhoto
                    : () => {
                        setCapture(null);
                        setSelectedFish(null);
                        setCompletion(null);
                      }
                }
              >
                <Text className="text-sm font-medium text-slate-600">
                  {capture.source === "dev_upload" ? "다른 파일" : "다시 찍기"}
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
                        AI 추천 후보
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
                          accessibilityLabel={`${fish.name_ko ?? fish.name}, AI 신뢰도 ${Math.round(candidate.confidence * 100)}퍼센트`}
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
                                {Math.round(candidate.confidence * 100)}%
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
                  </View>
                ) : null}

                {!isRecognizing ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="도감에서 직접 어종 찾기"
                    onPress={() => setCatalogVisible(true)}
                    className="mt-5 items-center border py-3"
                    style={{ borderColor: FIELD_COLORS.rule }}
                  >
                    <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                      도감에서 직접 찾기
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
            {selectedFish ? (
              <View className="mt-5">
                {capture.source === "dev_upload" ? (
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
                      개발용 파일 기록
                    </Text>
                    <Text
                      className="mt-1 text-xs leading-5"
                      style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
                    >
                      선택한 사진은 실제 조과로 저장되고 도감 발견 상태에
                      반영됩니다. 위치 정보는 저장되지 않습니다.
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
                      이 어종으로 기록
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
