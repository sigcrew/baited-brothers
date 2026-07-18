import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserCatch } from "@/src/hooks/useUserCatches";
import { CatchArchiveCard } from "@/components/collection/CatchArchiveCard";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type CardsPanelProps = {
  insetsBottom: number;
  catches: UserCatch[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoggedIn: boolean;
  onRefresh: () => void;
  onLoginPress?: () => void;
  requestedCatchId?: string;
  onRequestedCatchOpened?: () => void;
};

const CatchCardTile = ({
  item,
  onPress,
}: {
  item: UserCatch;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.84}
    accessibilityRole="button"
    accessibilityLabel={`${item.fish?.name_ko ?? item.fish?.name ?? "어종"} 조과 카드 열기`}
    className="mb-5"
    style={{ width: "48%" }}
  >
    <CatchArchiveCard item={item} variant="compact" />
  </TouchableOpacity>
);

const CatchDetailModal = ({
  item,
  visible,
  onClose,
}: {
  item: UserCatch | null;
  visible: boolean;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 items-center justify-center px-4"
        style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="카드 상세 닫기"
          onPress={onClose}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(5, 28, 35, 0.68)",
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 430,
            maxHeight: Math.min(windowHeight - insets.top - insets.bottom - 24, 860),
            backgroundColor: FIELD_COLORS.foam,
          }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ width: "100%" }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="조과 카드 닫기"
              onPress={onClose}
            >
              <CatchArchiveCard item={item} variant="detail" />
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const CardsPanel = ({
  insetsBottom,
  catches,
  isLoading,
  isRefreshing,
  isLoggedIn,
  onRefresh,
  onLoginPress,
  requestedCatchId,
  onRequestedCatchOpened,
}: CardsPanelProps) => {
  const [selected, setSelected] = useState<UserCatch | null>(null);
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest">(
    "newest",
  );
  const sortedCatches = useMemo(
    () =>
      [...catches].sort((left, right) =>
        sortDirection === "newest"
          ? right.caught_at.localeCompare(left.caught_at)
          : left.caught_at.localeCompare(right.caught_at),
      ),
    [catches, sortDirection],
  );

  useEffect(() => {
    if (!requestedCatchId) return;

    const requestedCatch = catches.find((item) => item.id === requestedCatchId);
    if (!requestedCatch) return;

    setSelected(requestedCatch);
    onRequestedCatchOpened?.();
  }, [catches, onRequestedCatchOpened, requestedCatchId]);

  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-lg font-semibold text-slate-900">조과 카드</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
          로그인하면 인증한 조과가 앨범으로 쌓입니다.
        </Text>
        {onLoginPress ? (
          <TouchableOpacity
            onPress={onLoginPress}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3"
          >
            <Text className="font-medium text-white">로그인</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={sortedCatches}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 0,
          paddingBottom: insetsBottom + 28,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#0f766e"
          />
        }
        ListHeaderComponent={
          <View className="mb-5 border-b py-5" style={{ borderColor: FIELD_COLORS.rule }}>
            <View className="flex-row items-center justify-between"><Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>나의 조과 카드 <Text style={{ color: FIELD_COLORS.orange }}>{String(catches.length).padStart(2, "0")}</Text></Text><TouchableOpacity
              onPress={() =>
                setSortDirection((current) =>
                  current === "newest" ? "oldest" : "newest",
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`카드 정렬, 현재 ${sortDirection === "newest" ? "최신순" : "오래된순"}`}
              className="flex-row items-center py-2"
            ><Text className="mr-2" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>정렬</Text><FontAwesome name="sliders" size={18} color={FIELD_COLORS.teal} /></TouchableOpacity></View>
            <Text className="mt-5 text-[12px] tracking-[1.5px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>CATCH ARCHIVE 2026</Text>
          </View>
        }
        ListEmptyComponent={
          <View className="mt-6 items-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12">
            <Text className="font-semibold text-slate-900">아직 카드가 없어요</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
              기록하기로 첫 조과를 남기면{"\n"}앨범에 카드가 생깁니다.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CatchCardTile item={item} onPress={() => setSelected(item)} />
        )}
      />
      <CatchDetailModal
        item={selected}
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </>
  );
};
