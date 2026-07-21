import { useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchiveRule } from "@/components/design/ArchiveRule";
import { TripFormModal } from "@/components/trips/TripFormModal";
import { CatchEditModal } from "@/components/catches/CatchEditModal";
import {
  useFishingTrips,
  type FishingTrip,
  type UpdateTripInput,
} from "@/src/hooks/useFishingTrips";
import { useUserCatches, type UserCatch } from "@/src/hooks/useUserCatches";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  dateKoreanFont,
  dateNumberFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const DEFAULT_COVER = require("@/assets/images/design/first-trip-cover-v1.png");

const STATUS_LABEL: Record<FishingTrip["status"], string> = {
  planned: "출조 예정",
  done: "출조 완료",
  canceled: "출조 취소",
};

const actionColor = (status: FishingTrip["status"]) => {
  if (status === "planned") return FIELD_COLORS.orange;
  if (status === "canceled") return FIELD_COLORS.red;
  return FIELD_COLORS.teal;
};

const TripDetailScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const tripId = typeof params.id === "string" ? params.id : "";
  const [editVisible, setEditVisible] = useState(false);
  const [editingCatch, setEditingCatch] = useState<UserCatch | null>(null);
  const [isSavingCatch, setIsSavingCatch] = useState(false);
  const {
    trips,
    isLoading,
    isRefreshing,
    isSaving,
    refetch,
    updateTrip,
    markDone,
    cancelTrip,
    deleteTrip,
  } = useFishingTrips();
  const {
    catches,
    isLoading: catchesLoading,
    isRefreshing: catchesRefreshing,
    refetch: refetchCatches,
    updateCatch,
    deleteCatch,
  } = useUserCatches(tripId || undefined);
  const trip = trips.find((item) => item.id === tripId);

  const refresh = async () => {
    await Promise.all([refetch(), refetchCatches()]);
  };

  const confirmAction = (
    title: string,
    message: string,
    confirmText: string,
    action: () => Promise<{ error: Error | null }>,
    onSuccess?: () => void,
    destructive = false
  ) => {
    const runAction = async () => {
      const { error } = await action();
      if (error) Alert.alert("오류", error.message);
      else onSuccess?.();
    };

    if (Platform.OS === "web") {
      if (globalThis.confirm(`${title}\n\n${message}`)) void runAction();
      return;
    }

    Alert.alert(title, message, [
      { text: "아니오", style: "cancel" },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: runAction,
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={FIELD_COLORS.teal} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <Stack.Screen options={{ headerShown: false }} />
        <FontAwesome name="file-text-o" size={32} color={FIELD_COLORS.muted} />
        <Text className="mt-5 text-[26px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
          일지를 찾지 못했습니다
        </Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/journal")} className="mt-6 px-6 py-3" style={{ backgroundColor: FIELD_COLORS.teal }}>
          <Text className="text-white" style={{ fontFamily: bodyExtraBoldFont }}>일지 목록으로</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const date = new Date(trip.scheduled_at);
  const month = String(date.getMonth() + 1);
  const day = String(date.getDate());
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(date);
  const fullDate = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const accent = actionColor(trip.status);
  const coverSource = trip.cover_image_url ? { uri: trip.cover_image_url } : DEFAULT_COVER;

  const submitEdit = async (input: UpdateTripInput) => {
    const { error } = await updateTrip(trip.id, input);
    return error;
  };

  const saveCatchEdit = async (
    item: UserCatch,
    input: { sizeCm: number | null; memo: string | null },
  ) => {
    setIsSavingCatch(true);
    const { error } = await updateCatch(item.id, input);
    setIsSavingCatch(false);
    if (!error) setEditingCatch(null);
    return error;
  };

  const confirmCatchDelete = (item: UserCatch) =>
    confirmAction(
      "조과 삭제",
      `${item.fish?.name_ko ?? item.fish?.name ?? "이 조과"} 기록과 사진을 삭제할까요?`,
      "삭제",
      () => deleteCatch(item),
      undefined,
      true,
    );

  const goRecord = () =>
    router.push({
      pathname: "/record",
      params: { tripId: trip.id, tripName: trip.spot_name },
    });

  return (
    <View className="flex-1" style={{ backgroundColor: FIELD_COLORS.foam }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || catchesRefreshing}
            onRefresh={refresh}
            tintColor={FIELD_COLORS.teal}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <ImageBackground source={coverSource} resizeMode="cover" style={{ height: 360, width: "100%" }}>
          <View className="flex-row items-center justify-between px-5" style={{ paddingTop: insets.top + 12 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="일지 목록으로 돌아가기"
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center bg-black/55"
            >
              <FontAwesome name="long-arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`상태: ${STATUS_LABEL[trip.status]}`}
              className="items-end"
            >
              <Text
                className="text-[9px] tracking-[1.6px] text-white"
                style={{
                  fontFamily: monoFont,
                  textShadowColor: "rgba(0,0,0,0.75)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                STATUS
              </Text>
              <View className="mt-1 flex-row items-center">
                <Text
                  className="text-xs"
                  style={{
                    color: accent,
                    fontFamily: bodyExtraBoldFont,
                  }}
                >
                  {STATUS_LABEL[trip.status]}
                </Text>
              </View>
            </View>
          </View>
          <View className="absolute bottom-0 left-0 right-0 flex-row items-end justify-between bg-black/50 px-5 py-4">
            <Text className="text-[11px] tracking-[1.5px] text-white" style={{ fontFamily: monoFont }}>
              FIELD NOTE · {date.getFullYear()}.{String(date.getMonth() + 1).padStart(2, "0")}.{String(date.getDate()).padStart(2, "0")}
            </Text>
            <Text className="text-xs text-white" style={{ fontFamily: bodySemiBoldFont }}>
              {trip.cover_image_url ? "나의 커버" : "기본 커버"}
            </Text>
          </View>
        </ImageBackground>

        <View className="bg-white px-5 pb-6 pt-5">
          <View className="min-h-[80px] flex-row items-end">
            <Text style={{ color: FIELD_COLORS.ink, fontFamily: dateNumberFont, fontSize: 66, lineHeight: 80, overflow: "visible", paddingTop: 3 }}>{month}</Text>
            <Text style={{ color: FIELD_COLORS.ink, fontFamily: dateKoreanFont, fontSize: 29, lineHeight: 49 }}>월 </Text>
            <Text style={{ color: FIELD_COLORS.ink, fontFamily: dateNumberFont, fontSize: 66, lineHeight: 80, overflow: "visible", paddingTop: 3 }}>{day}</Text>
            <Text style={{ color: FIELD_COLORS.ink, fontFamily: dateKoreanFont, fontSize: 29, lineHeight: 49 }}>일, </Text>
            <Text style={{ color: FIELD_COLORS.ink, fontFamily: dateKoreanFont, fontSize: 34, lineHeight: 52 }}>{weekday}</Text>
          </View>
          <Text className="mt-2 text-[30px] leading-[40px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
            {trip.spot_name}
          </Text>
          <Text className="mt-3 text-xs tracking-[0.6px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
            {fullDate}
          </Text>
          <View className="mt-5">
            <ArchiveRule ticks />
          </View>
          <Text className="mt-5 text-sm leading-6" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
            {trip.memo || "이 출조에 남겨둔 메모가 없습니다."}
          </Text>
        </View>

        <View className="px-5 pt-6">
          <View className="flex-row items-end justify-between">
            <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>출조 관리</Text>
            <Text className="text-[10px] tracking-[1.3px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>MANAGE NOTE</Text>
          </View>
          <View className="mt-3 flex-row border-y" style={{ borderColor: FIELD_COLORS.rule }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="출조 수정" onPress={() => setEditVisible(true)} disabled={isSaving} className="flex-1 items-center border-r py-4" style={{ borderColor: FIELD_COLORS.rule }}>
              <FontAwesome name="pencil" size={18} color={FIELD_COLORS.ink} />
              <Text className="mt-2 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>수정</Text>
            </TouchableOpacity>
            {trip.status === "planned" ? (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="출조 완료"
                  onPress={() => confirmAction("출조 완료", `${trip.spot_name} 출조를 완료할까요?`, "완료", () => markDone(trip.id))}
                  disabled={isSaving}
                  className="flex-1 items-center border-r py-4"
                  style={{ borderColor: FIELD_COLORS.rule }}
                >
                  <FontAwesome name="check" size={18} color={FIELD_COLORS.teal} />
                  <Text className="mt-2 text-sm" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>완료</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="출조 취소"
                  onPress={() => confirmAction("출조 취소", `${trip.spot_name} 출조를 취소할까요?`, "취소하기", () => cancelTrip(trip.id), undefined, true)}
                  disabled={isSaving}
                  className="flex-1 items-center border-r py-4"
                  style={{ borderColor: FIELD_COLORS.rule }}
                >
                  <FontAwesome name="ban" size={18} color={FIELD_COLORS.red} />
                  <Text className="mt-2 text-sm" style={{ color: FIELD_COLORS.red, fontFamily: bodySemiBoldFont }}>취소</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="출조 삭제"
              onPress={() => confirmAction("출조 삭제", `${trip.spot_name} 일지를 삭제할까요? 연결된 조과 기록은 보존됩니다.`, "삭제", () => deleteTrip(trip.id), () => router.replace("/(tabs)/journal"), true)}
              disabled={isSaving}
              className="flex-1 items-center py-4"
            >
              <FontAwesome name="trash-o" size={18} color={FIELD_COLORS.muted} />
              <Text className="mt-2 text-sm" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>삭제</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${trip.spot_name} 현장 조과 기록`}
            onPress={goRecord}
            className="mt-6 flex-row items-center px-5 py-5"
            style={{ backgroundColor: FIELD_COLORS.teal }}
          >
            <FontAwesome name="camera" size={24} color="#fff" />
            <Text className="ml-4 flex-1 text-lg text-white" style={{ fontFamily: bodyExtraBoldFont }}>이 출조에 조과 기록하기</Text>
            <FontAwesome name="long-arrow-right" size={24} color="#fff" />
          </TouchableOpacity>

          <View className="mt-8 flex-row items-end justify-between">
            <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>현장 기록</Text>
            <Text className="text-[10px] tracking-[1.3px]" style={{ color: accent, fontFamily: monoFont }}>CATCHES {catches.length}</Text>
          </View>
          <View className="mt-3 border-t" style={{ borderColor: FIELD_COLORS.rule }}>
            {catchesLoading ? (
              <View className="h-36 items-center justify-center"><ActivityIndicator color={FIELD_COLORS.teal} /></View>
            ) : catches.length ? (
              catches.map((item, index) => {
                const caughtDate = new Date(item.caught_at);
                return (
                  <View
                    key={item.id}
                    className="border-b py-4"
                    style={{ borderColor: FIELD_COLORS.rule }}
                  >
                    <View className="flex-row">
                      {item.thumbnail_url ?? item.image_url ? (
                        <Image
                          source={{ uri: item.thumbnail_url ?? item.image_url! }}
                          resizeMode="cover"
                          style={{ width: 112, height: 112 }}
                        />
                      ) : (
                        <View
                          className="h-28 w-28 items-center justify-center"
                          style={{ backgroundColor: FIELD_COLORS.locked }}
                        >
                          <FontAwesome
                            name="image"
                            size={24}
                            color={FIELD_COLORS.muted}
                          />
                        </View>
                      )}
                      <View className="min-w-0 flex-1 justify-center pl-4">
                        <Text
                          className="text-[11px] tracking-[1px]"
                          style={{
                            color: FIELD_COLORS.muted,
                            fontFamily: monoFont,
                          }}
                        >
                          #{String(index + 1).padStart(2, "0")} ·{" "}
                          {caughtDate.toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                        <Text
                          className="mt-2 text-xl"
                          style={{
                            color: FIELD_COLORS.ink,
                            fontFamily: bodyExtraBoldFont,
                          }}
                        >
                          {item.fish?.name_ko ??
                            item.fish?.name ??
                            "어종 미확인"}
                        </Text>
                        <Text
                          className="mt-2 text-sm"
                          style={{
                            color: FIELD_COLORS.ink,
                            fontFamily: bodyFont,
                          }}
                        >
                          {item.size_cm
                            ? `${item.size_cm} cm`
                            : "크기 미기록"}
                        </Text>
                      </View>
                    </View>

                    {item.memo ? (
                      <View
                        className="mt-4 border-t pt-3"
                        style={{ borderColor: FIELD_COLORS.rule }}
                      >
                        <Text
                          className="text-[10px] tracking-[1.2px]"
                          style={{
                            color: FIELD_COLORS.teal,
                            fontFamily: monoFont,
                          }}
                        >
                          FIELD NOTE
                        </Text>
                        <Text
                          className="mt-2 text-sm leading-5"
                          style={{
                            color: FIELD_COLORS.muted,
                            fontFamily: bodyFont,
                          }}
                        >
                          {item.memo}
                        </Text>
                      </View>
                    ) : null}
                    <View className="mt-3 flex-row justify-end">
                      <TouchableOpacity
                        onPress={() => setEditingCatch(item)}
                        className="px-3 py-2"
                      >
                        <Text
                          className="text-xs"
                          style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}
                        >
                          수정
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmCatchDelete(item)}
                        className="ml-2 px-3 py-2"
                      >
                        <Text
                          className="text-xs"
                          style={{ color: FIELD_COLORS.red, fontFamily: bodySemiBoldFont }}
                        >
                          삭제
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View className="items-center border-b px-6 py-12" style={{ borderColor: FIELD_COLORS.rule }}>
                <FontAwesome name="camera" size={28} color={FIELD_COLORS.muted} />
                <Text className="mt-4 text-lg" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>아직 현장 기록이 없습니다</Text>
                <Text className="mt-2 text-center text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                  이 출조에서 잡은 물고기를 촬영하면{`\n`}사진과 조과가 시간순으로 쌓입니다.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <TripFormModal
        visible={editVisible}
        trip={trip}
        isSaving={isSaving}
        onClose={() => setEditVisible(false)}
        onSubmit={submitEdit}
      />
      <CatchEditModal
        item={editingCatch}
        isSaving={isSavingCatch}
        onClose={() => setEditingCatch(null)}
        onSave={saveCatchEdit}
      />
    </View>
  );
};

export default TripDetailScreen;
