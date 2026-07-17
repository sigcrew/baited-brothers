import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFishes, type Fish } from "@/src/hooks/useFishes";
import { useCreateCatch } from "@/src/hooks/useCreateCatch";
import {
  useFishRecognition,
  type FishRecognitionCandidate,
} from "@/src/hooks/useFishRecognition";
import { getField60Illustration } from "@/src/data/field60Illustrations";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, monoFont } from "@/src/theme/fieldJournal";

type Capture = {
  uri: string;
  base64: string;
  mimeType: "image/jpeg";
  latitude: number;
  longitude: number;
  locationCapturedAt: string;
};

const RecordScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string; tripName?: string }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;
  const tripName = typeof params.tripName === "string" ? params.tripName : undefined;
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [selectedFish, setSelectedFish] = useState<Fish | null>(null);
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("");
  const [memo, setMemo] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [recognitionCandidates, setRecognitionCandidates] = useState<
    FishRecognitionCandidate[]
  >([]);
  const [recognitionNote, setRecognitionNote] = useState<string | null>(null);
  const [needsRetake, setNeedsRetake] = useState(false);
  const [showCatalogSearch, setShowCatalogSearch] = useState(false);
  const { fishes, isLoading: fishesLoading } = useFishes(null, "core");
  const { createCatch, isSaving } = useCreateCatch();
  const {
    recognize,
    isRecognizing,
    error: recognitionError,
  } = useFishRecognition();

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

  const filteredFishes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return fishes;
    return fishes.filter((fish) =>
      `${fish.name_ko ?? ""} ${fish.name}`.toLowerCase().includes(keyword)
    );
  }, [fishes, query]);

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
      };
      setCapture(nextCapture);
      setSelectedFish(null);
      setRecognitionCandidates([]);
      setRecognitionNote(null);
      setNeedsRetake(false);
      setShowCatalogSearch(false);

      const result = await recognize({
        imageBase64: nextCapture.base64,
        mimeType: nextCapture.mimeType,
        fishes,
      });
      setRecognitionCandidates(result.candidates);
      setRecognitionNote(result.note);
      setNeedsRetake(result.needsRetake);
      if (result.error || result.candidates.length === 0) {
        setShowCatalogSearch(true);
      }
    } catch (error) {
      Alert.alert("촬영 실패", error instanceof Error ? error.message : "다시 시도해 주세요.");
    } finally {
      setIsCapturing(false);
    }
  };

  const save = async () => {
    if (!capture || !selectedFish) return;
    const parsedSize = size.trim() ? Number(size) : undefined;
    if (parsedSize !== undefined && (!Number.isFinite(parsedSize) || parsedSize <= 0)) {
      Alert.alert("크기 확인", "크기는 0보다 큰 숫자로 입력해 주세요.");
      return;
    }

    const selectedCandidate = recognitionCandidates.find(
      (candidate) => candidate.fishId === selectedFish.id,
    );
    const { error } = await createCatch({
      tripId,
      fishId: selectedFish.id,
      imageUri: capture.uri,
      latitude: capture.latitude,
      longitude: capture.longitude,
      locationCapturedAt: capture.locationCapturedAt,
      sizeCm: parsedSize,
      memo,
      candidateFishIds: recognitionCandidates.map(
        (candidate) => candidate.fishId,
      ),
      idMethod: selectedCandidate
        ? "closed_set_candidates"
        : "fallback_catalog",
      verificationReason: selectedCandidate
        ? `AI 후보 추천 후 사용자 확정 · 신뢰도 ${Math.round(selectedCandidate.confidence * 100)}%`
        : "사용자가 도감에서 직접 어종을 확정함",
    });
    if (error) {
      Alert.alert("저장 실패", error.message);
      return;
    }
    const goAfterSave = () => tripId
      ? router.replace({ pathname: "/trips/[id]", params: { id: tripId } })
      : router.replace("/(tabs)/encyclopedia");

    if (Platform.OS === "web") {
      globalThis.alert(`${selectedFish.name_ko ?? selectedFish.name}을(를) 수집했습니다.`);
      goAfterSave();
    } else {
      Alert.alert("도감 해금", `${selectedFish.name_ko ?? selectedFish.name}을(를) 수집했습니다.`, [
        { text: "확인", onPress: goAfterSave },
      ]);
    }
  };

  if (!cameraPermission) return <View className="flex-1 bg-black" />;
  if (!cameraPermission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950 px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-xl font-bold text-white">카메라 권한이 필요해요</Text>
        <Text className="mt-3 text-center text-slate-300">현장에서 직접 촬영한 사진만 도감에 등록할 수 있습니다.</Text>
        <TouchableOpacity onPress={requestCameraPermission} className="mt-6 rounded-xl bg-white px-6 py-3">
          <Text className="font-semibold text-slate-900">권한 허용</Text>
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
        <Stack.Screen options={{ headerShown: false }} />
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="picture" />
        <View className="absolute left-0 right-0 top-0 flex-row justify-between px-5" style={{ paddingTop: insets.top + 12 }}>
          <TouchableOpacity onPress={() => router.back()} className="rounded-lg bg-black/50 px-4 py-2">
            <Text className="font-medium text-white">닫기</Text>
          </TouchableOpacity>
          <View className="rounded-lg bg-black/50 px-3 py-2"><Text className="text-sm text-white">{tripName ? `${tripName} · 현장 기록` : "사진 + GPS 인증"}</Text></View>
        </View>
        <View className="absolute bottom-0 left-0 right-0 items-center bg-black/40 pb-8 pt-5" style={{ paddingBottom: insets.bottom + 24 }}>
          <Text className="mb-4 text-sm text-white">물고기 전체가 잘 보이게 촬영해 주세요</Text>
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
      <Stack.Screen options={{ title: "조과 확인", headerBackTitle: "취소" }} />
      <FlatList
        data={selectedFish || !showCatalogSearch ? [] : filteredFishes}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          <>
            <Image source={{ uri: capture.uri }} className="h-56 w-full rounded-xl bg-slate-200" resizeMode="cover" />
            <View className="mt-3 flex-row justify-between">
              <Text className="text-xs text-teal-800">GPS 확보 완료 · 현장 촬영</Text>
              <TouchableOpacity onPress={() => { setCapture(null); setSelectedFish(null); }}><Text className="text-sm font-medium text-slate-600">다시 찍기</Text></TouchableOpacity>
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
                  onPress={() => setSelectedFish(null)}
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
                          onPress={() => setSelectedFish(fish)}
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
                    onPress={() => setShowCatalogSearch((visible) => !visible)}
                    className="mt-5 items-center border py-3"
                    style={{ borderColor: FIELD_COLORS.rule }}
                  >
                    <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                      {showCatalogSearch ? "도감 검색 닫기" : "도감에서 직접 찾기"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {showCatalogSearch ? (
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="어종 이름 검색"
                    className="mt-3 border bg-white px-4 py-3 text-base"
                    style={{ borderColor: FIELD_COLORS.rule, color: FIELD_COLORS.ink }}
                  />
                ) : null}
              </>
            )}
            {selectedFish ? (
              <View className="mt-5">
                <Text className="text-sm font-medium text-slate-700">크기(cm, 선택)</Text>
                <TextInput value={size} onChangeText={setSize} keyboardType="decimal-pad" placeholder="예: 32.5" className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3" />
                <Text className="mt-4 text-sm font-medium text-slate-700">메모(선택)</Text>
                <TextInput value={memo} onChangeText={setMemo} multiline placeholder="채비, 물때, 기억할 점" className="mt-2 min-h-[88px] rounded-xl border border-slate-200 bg-white px-4 py-3" />
                <TouchableOpacity disabled={isSaving} onPress={save} className="mt-6 rounded-xl bg-slate-900 py-4">
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text className="text-center font-semibold text-white">이 어종으로 저장</Text>}
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedFish(item)} className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Text className="font-semibold text-slate-900">{item.name_ko ?? item.name}</Text>
            {item.name_ko ? <Text className="mt-0.5 text-xs text-slate-400">{item.name}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          showCatalogSearch && !fishesLoading && !selectedFish ? (
            <Text className="py-8 text-center text-slate-500">
              검색 결과가 없습니다.
            </Text>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
};

export default RecordScreen;
