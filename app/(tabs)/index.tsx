import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useFishingTrips,
  type FishingTrip,
  type TripCoverImage,
} from "@/src/hooks/useFishingTrips";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useImageContrast } from "@/src/hooks/useImageContrast";
import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodySemiBoldFont,
  dateKoreanFont,
  dateNumberFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const DEFAULT_HERO_IMAGE = require("@/assets/images/design/first-trip-cover-v1.png");

const formatTripDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toLocalInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseLocalInputValue = (value: string): Date | null => {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? "9");
  const minute = Number(match[5] ?? "0");
  const date = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(date.getTime()) ? null : date;
};

const defaultScheduledInput = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(6, 0, 0, 0);
  return toLocalInputValue(date);
};

const pickTripCover = async (): Promise<TripCoverImage | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("사진 권한 필요", "출조 커버를 선택하려면 사진 보관함 접근을 허용해 주세요.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  };
};

const TripRow = ({
  trip,
  showActions,
  onDone,
  onCancel,
  disabled,
}: {
  trip: FishingTrip;
  showActions?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
}) => (
  <View className="mb-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
    <Text className="text-base font-semibold text-gray-900">
      {trip.spot_name}
    </Text>
    <Text className="mt-1 text-sm text-gray-500">
      {formatTripDate(trip.scheduled_at)}
    </Text>
    {trip.memo ? (
      <Text className="mt-2 text-sm text-gray-600">{trip.memo}</Text>
    ) : null}
    {showActions ? (
      <View className="mt-3 flex-row gap-2">
        <TouchableOpacity
          onPress={onDone}
          disabled={disabled}
          className="flex-1 rounded-lg bg-teal-800 py-2.5 active:bg-teal-900"
        >
          <Text className="text-center text-sm font-medium text-white">
            완료
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          disabled={disabled}
          className="flex-1 rounded-lg bg-gray-100 py-2.5 active:bg-gray-200"
        >
          <Text className="text-center text-sm font-medium text-gray-700">
            취소
          </Text>
        </TouchableOpacity>
      </View>
    ) : null}
  </View>
);

const AddTripModal = ({
  visible,
  onClose,
  onSubmit,
  isSaving,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: {
    spotName: string;
    scheduledAt: Date;
    memo?: string;
    coverImage?: TripCoverImage;
  }) => Promise<Error | null>;
  isSaving: boolean;
}) => {
  const [spotName, setSpotName] = useState("");
  const [scheduledInput, setScheduledInput] = useState(defaultScheduledInput);
  const [memo, setMemo] = useState("");
  const [coverImage, setCoverImage] = useState<TripCoverImage | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setSpotName("");
    setScheduledInput(defaultScheduledInput());
    setMemo("");
    setCoverImage(null);
    setFormError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const scheduledAt = parseLocalInputValue(scheduledInput);
    if (!spotName.trim()) {
      setFormError("낚시터 이름을 입력해 주세요.");
      return;
    }
    if (!scheduledAt) {
      setFormError("날짜는 YYYY-MM-DD 또는 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.");
      return;
    }

    const error = await onSubmit({
      spotName,
      scheduledAt,
      memo,
      coverImage: coverImage ?? undefined,
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Pressable
          onPress={handleClose}
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="rounded-t-2xl bg-white px-4 pb-8 pt-5"
          >
            <Text className="text-xl font-bold text-gray-900">일정 추가</Text>
            <Text className="mt-1 text-sm text-gray-500">
              출조 전에 낚시터와 날짜를 남겨 두세요.
            </Text>

            <Text className="mt-5 text-xs font-medium text-gray-400">
              낚시터
            </Text>
            <TextInput
              value={spotName}
              onChangeText={setSpotName}
              placeholder="예: 대천항 방파제"
              placeholderTextColor="#9ca3af"
              className="mt-1 rounded-lg border border-gray-200 px-3 py-3 text-base text-gray-900"
            />

            <Text className="mt-4 text-xs font-medium text-gray-400">
              일시 (YYYY-MM-DD HH:mm)
            </Text>
            <TextInput
              value={scheduledInput}
              onChangeText={setScheduledInput}
              placeholder="2026-07-16 06:00"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              className="mt-1 rounded-lg border border-gray-200 px-3 py-3 text-base text-gray-900"
            />

            <Text className="mt-4 text-xs font-medium text-gray-400">
              메모 (선택)
            </Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="물때, 동행, 목표 어종 등"
              placeholderTextColor="#9ca3af"
              multiline
              className="mt-1 min-h-[72px] rounded-lg border border-gray-200 px-3 py-3 text-base text-gray-900"
            />

            <Text className="mt-4 text-xs font-medium text-gray-400">
              홈 커버 사진 (선택)
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const image = await pickTripCover();
                if (image) setCoverImage(image);
              }}
              className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            >
              {coverImage ? (
                <View>
                  <Image source={{ uri: coverImage.uri }} className="h-36 w-full" resizeMode="cover" />
                  <View className="absolute bottom-3 right-3 rounded bg-black/60 px-3 py-2">
                    <Text className="text-xs font-semibold text-white">사진 다시 선택</Text>
                  </View>
                </View>
              ) : (
                <View className="h-24 flex-row items-center justify-center">
                  <FontAwesome name="image" size={20} color={FIELD_COLORS.teal} />
                  <Text className="ml-2 text-sm" style={{ color: FIELD_COLORS.teal }}>사진 선택</Text>
                </View>
              )}
            </TouchableOpacity>

            {formError ? (
              <Text className="mt-3 text-sm text-red-600">{formError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSaving}
              className="mt-5 rounded-xl bg-gray-900 py-3.5 active:bg-gray-800"
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-center font-medium text-white">저장</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [addVisible, setAddVisible] = useState(false);
  const {
    trips,
    plannedTrips,
    recentDoneTrips,
    isLoading,
    isRefreshing,
    isSaving,
    error,
    isLoggedIn,
    refetch,
    createTrip,
    updateTripCover,
    markDone,
    cancelTrip,
  } = useFishingTrips();
  const { catches } = useUserCatches();

  const handleCreate = async (input: {
    spotName: string;
    scheduledAt: Date;
    memo?: string;
    coverImage?: TripCoverImage;
  }) => {
    const { error: createError } = await createTrip(input);
    return createError;
  };

  const handleDone = (trip: FishingTrip) => {
    Alert.alert("출조 완료", `${trip.spot_name} 일정을 완료할까요?`, [
      { text: "아니오", style: "cancel" },
      {
        text: "완료",
        onPress: async () => {
          const { error: doneError } = await markDone(trip.id);
          if (doneError) Alert.alert("오류", doneError.message);
        },
      },
    ]);
  };

  const handleCancel = (trip: FishingTrip) => {
    Alert.alert("일정 취소", `${trip.spot_name} 일정을 취소할까요?`, [
      { text: "아니오", style: "cancel" },
      {
        text: "취소하기",
        style: "destructive",
        onPress: async () => {
          const { error: cancelError } = await cancelTrip(trip.id);
          if (cancelError) Alert.alert("오류", cancelError.message);
        },
      },
    ]);
  };

  const nextTrip = plannedTrips[0];
  const latestDoneTrip = recentDoneTrips[0];
  const hasTripHistory = Boolean(latestDoneTrip);
  const heroSource = nextTrip?.cover_image_url
    ? { uri: nextTrip.cover_image_url }
    : latestDoneTrip?.cover_image_url
      ? { uri: latestDoneTrip.cover_image_url }
      : DEFAULT_HERO_IMAGE;
  const isDarkHero = useImageContrast(heroSource);
  const heroTextColor = isDarkHero ? FIELD_COLORS.paper : FIELD_COLORS.ink;
  const heroRuleColor = isDarkHero ? "rgba(255,255,255,0.72)" : FIELD_COLORS.rule;
  const nextDate = nextTrip ? new Date(nextTrip.scheduled_at) : null;
  const dateMonth = nextDate ? String(nextDate.getMonth() + 1) : "";
  const dateDay = nextDate ? String(nextDate.getDate()) : "";
  const dateWeekday = nextDate
    ? new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(nextDate)
    : "";
  const daysAway = nextDate
    ? Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 86400000))
    : 0;
  const handleRecord = () => isLoggedIn ? router.push("/record") : router.push("/(auth)/login");
  const handleAddTrip = () => isLoggedIn ? setAddVisible(true) : router.push("/(auth)/login");
  const handleChangeCover = async () => {
    if (!nextTrip || isSaving) return;
    const image = await pickTripCover();
    if (!image) return;

    const { error: coverError } = await updateTripCover(nextTrip.id, image);
    if (coverError) Alert.alert("사진 변경 실패", coverError.message);
  };

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }}>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={FIELD_COLORS.teal} />} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <ImageBackground
          source={heroSource}
          resizeMode="cover"
          style={{ width: "100%", height: 650 }}
        >
          <ArchiveTabHeader
            title="낚시당한 녀석들"
            backgroundColor="transparent"
            foregroundColor={heroTextColor}
            ruleColor={heroRuleColor}
            leadingSlot={(
              <View
                accessibilityRole="image"
                accessibilityLabel="낚시당한 녀석들 앱 아이콘"
                style={{ width: 34, height: 44, overflow: "hidden" }}
              >
                <Image
                  source={require("@/assets/images/card-app-icon-transparent.png")}
                  resizeMode="contain"
                  style={{
                    position: "absolute",
                    width: 72,
                    height: 72,
                    left: -19,
                    top: -20,
                  }}
                />
              </View>
            )}
            rightSlot={(
              <Text
                accessibilityLabel={`누적 일지 ${trips.length}개`}
                className="text-[10px] tracking-[1.5px]"
                style={{ color: heroTextColor, fontFamily: monoFont }}
              >
                FIELD LOG {String(trips.length).padStart(3, "0")}
              </Text>
            )}
          />
          <View className="px-7 pt-10">
            {isLoading ? (
              <View className="h-28 items-start justify-center">
                <ActivityIndicator color={heroTextColor} />
              </View>
            ) : nextTrip ? (
              <>
                <View className="h-[84px] flex-row items-end">
                  <Text style={{ color: heroTextColor, fontFamily: dateNumberFont, fontSize: 82, lineHeight: 84 }}>{dateMonth}</Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateKoreanFont, fontSize: 39, lineHeight: 57 }}>월 </Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateNumberFont, fontSize: 82, lineHeight: 84 }}>{dateDay}</Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateKoreanFont, fontSize: 39, lineHeight: 57 }}>일, </Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateKoreanFont, fontSize: 47, lineHeight: 61 }}>{dateWeekday}</Text>
                </View>
                <Text className="mt-1 text-[25px] leading-[34px]" style={{ color: heroTextColor, fontFamily: displayFont }}>다음 출조는 {nextTrip.spot_name}입니다.</Text>
                <Text className="mt-4 text-[15px] tracking-[1.6px]" style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}>새벽 5:30 · 우럭 목표</Text>
              </>
            ) : hasTripHistory ? (
              <View className="pt-3">
                <Text
                  className="max-w-[580px] text-[44px] leading-[54px] tracking-[-1.5px]"
                  style={{ color: heroTextColor, fontFamily: displayFont }}
                >
                  다음 출조를 계획해볼까요
                </Text>
                <Text
                  className="mt-4 text-lg tracking-[-0.3px]"
                  style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}
                >
                  지난 기록을 이어 새로운 일지를 시작해보세요
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="새 출조 추가하기"
                  accessibilityHint="낚시터와 출조 날짜를 입력하는 화면을 엽니다"
                  onPress={handleAddTrip}
                  className="mt-6 w-full max-w-[280px] flex-row items-center px-5 py-4"
                  style={{ backgroundColor: FIELD_COLORS.teal }}
                >
                  <FontAwesome name="calendar-plus-o" size={21} color="#fff" />
                  <Text
                    className="ml-3 flex-1 text-[17px] text-white"
                    style={{ fontFamily: bodyExtraBoldFont }}
                  >
                    새 출조 추가하기
                  </Text>
                  <FontAwesome name="long-arrow-right" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="pt-3">
                <Text className="max-w-[580px] text-[44px] leading-[54px] tracking-[-1.5px]" style={{ color: heroTextColor, fontFamily: displayFont }}>첫 출조를 기다리는 중</Text>
                <Text className="mt-4 text-lg tracking-[-0.3px]" style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}>어디로 떠날지 기록해보세요</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="첫 출조 추가하기"
                  accessibilityHint="낚시터와 출조 날짜를 입력하는 화면을 엽니다"
                  onPress={handleAddTrip}
                  className="mt-6 w-full max-w-[280px] flex-row items-center px-5 py-4"
                  style={{ backgroundColor: FIELD_COLORS.teal }}
                >
                  <FontAwesome name="calendar-plus-o" size={21} color="#fff" />
                  <Text className="ml-3 flex-1 text-[17px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>첫 출조 추가하기</Text>
                  <FontAwesome name="long-arrow-right" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {nextTrip && isLoggedIn ? (
            <TouchableOpacity
              accessibilityLabel="출조 커버 사진 변경"
              onPress={handleChangeCover}
              disabled={isSaving}
              className="absolute bottom-4 right-4 flex-row items-center bg-black/55 px-3 py-2"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome name="camera" size={14} color="#fff" />
              )}
              <Text className="ml-2 text-xs font-semibold text-white">커버 변경</Text>
            </TouchableOpacity>
          ) : null}
        </ImageBackground>
        <View className="bg-white px-4 py-4">
          <TouchableOpacity
            onPress={handleRecord}
            className="flex-row items-center px-5 py-5"
            style={{ backgroundColor: FIELD_COLORS.teal }}
          >
            <FontAwesome name="camera" size={26} color="white" />
            <Text className="ml-4 flex-1 text-xl text-white" style={{ fontFamily: bodyExtraBoldFont }}>현장에서 기록하기</Text>
            <FontAwesome name="long-arrow-right" size={28} color="white" />
          </TouchableOpacity>
        </View>
        <View className="mt-3 bg-white px-4 py-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>다가오는 출조</Text>
            {nextTrip ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="출조 일지 전체 보기" onPress={() => router.push("/(tabs)/journal")}>
                <Text className="text-[11px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>ALL LOGS →</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {isLoading ? (
            <View className="mt-3 h-24 items-center justify-center border-y" style={{ borderColor: FIELD_COLORS.rule }}>
              <ActivityIndicator color={FIELD_COLORS.teal} />
            </View>
          ) : nextTrip ? (
            <View className="mt-3 flex-row items-center border-y py-4" style={{ borderColor: FIELD_COLORS.rule }}><FontAwesome name="map-signs" size={25} color={FIELD_COLORS.teal} /><View className="ml-4 flex-1"><Text className="text-lg" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>{nextTrip.spot_name}</Text><Text className="mt-1 text-[11px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>{formatTripDate(nextTrip.scheduled_at)} · 우럭 목표</Text></View><View className="flex-row items-center" accessible accessibilityLabel={`D-${daysAway}`}><Text style={{ color: FIELD_COLORS.orange, fontFamily: dateNumberFont, fontSize: 48, lineHeight: 54 }}>D</Text><View style={{ width: 14, height: 4, marginHorizontal: 5, backgroundColor: FIELD_COLORS.orange }} /><Text style={{ color: FIELD_COLORS.orange, fontFamily: dateNumberFont, fontSize: 48, lineHeight: 54 }}>{daysAway}</Text></View></View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={hasTripHistory ? "새 출조 추가" : "첫 출조 추가"}
              accessibilityHint="낚시터와 출조 날짜를 입력하는 화면을 엽니다"
              onPress={handleAddTrip}
              className="mt-3 flex-row items-center px-5 py-6"
              style={{ backgroundColor: FIELD_COLORS.teal }}
            >
              <FontAwesome name="calendar-plus-o" size={24} color="#fff" />
              <Text className="ml-4 flex-1 text-[22px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>
                {hasTripHistory ? "새 출조 추가하기" : "첫 출조 추가하기"}
              </Text>
              <FontAwesome name="long-arrow-right" size={25} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <View className="mt-3 bg-white px-4 py-6">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-xl"
              style={{
                color: FIELD_COLORS.ink,
                fontFamily: bodyExtraBoldFont,
              }}
            >
              최근 조과
            </Text>
            <Text
              className="text-[11px] tracking-[1.2px]"
              style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
            >
              LATEST CATCH
            </Text>
          </View>
          <View
            className="mt-3 flex-row border-t pt-3"
            style={{ borderColor: FIELD_COLORS.rule }}
          >
            {catches.length ? (
              catches.slice(0, 3).map((item, index) => (
                <View
                  key={item.id}
                  className="flex-1 overflow-hidden border"
                  style={{
                    marginRight: index < Math.min(catches.length, 3) - 1 ? 8 : 0,
                    borderColor: FIELD_COLORS.rule,
                  }}
                >
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      resizeMode="cover"
                      style={{ width: "100%", height: 96 }}
                    />
                  ) : (
                    <View
                      className="h-24 items-center justify-center"
                      style={{ backgroundColor: FIELD_COLORS.locked }}
                    >
                      <FontAwesome
                        name="image"
                        size={24}
                        color={FIELD_COLORS.muted}
                      />
                    </View>
                  )}
                  <View className="bg-white p-2">
                    <Text
                      numberOfLines={1}
                      style={{
                        color: FIELD_COLORS.ink,
                        fontFamily: bodyExtraBoldFont,
                      }}
                    >
                      {item.fish?.name_ko ?? "어종"}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View
                className="flex-1 items-center justify-center border"
                style={{
                  minHeight: 126,
                  borderColor: FIELD_COLORS.rule,
                  backgroundColor: FIELD_COLORS.locked,
                }}
              >
                <FontAwesome
                  name="camera"
                  size={22}
                  color={FIELD_COLORS.muted}
                />
                <Text
                  className="mt-2 text-xs font-semibold"
                  style={{ color: FIELD_COLORS.muted }}
                >
                  첫 조과를 기록하세요
                </Text>
              </View>
            )}
          </View>
          {error ? <Text className="mt-4 text-xs" style={{ color: FIELD_COLORS.orange }}>{error.message}</Text> : null}
        </View>
      </ScrollView>

      <AddTripModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSubmit={handleCreate}
        isSaving={isSaving}
      />
    </View>
  );
};

export default HomeScreen;
