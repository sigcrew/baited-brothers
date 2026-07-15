import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Image,
} from "react-native";
import type { UserCatch } from "@/src/hooks/useUserCatches";
import { FishThumb } from "@/components/collection/FishThumb";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

type CardsPanelProps = {
  insetsBottom: number;
  catches: UserCatch[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoggedIn: boolean;
  onRefresh: () => void;
  onLoginPress?: () => void;
};

const formatCaughtAt = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");

const CatchCardTile = ({
  item,
  onPress,
}: {
  item: UserCatch;
  onPress: () => void;
}) => {
  const title = item.fish?.name_ko ?? item.fish?.name ?? "어종";
  const hasPhoto = Boolean(item.image_url);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="mb-5 overflow-hidden rounded-lg border bg-white"
      style={{ width: "48%", borderColor: FIELD_COLORS.rule }}
    >
      <View className="aspect-square bg-slate-100">
        {hasPhoto ? (
          <Image
            source={{ uri: item.image_url! }}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <FishThumb
              imageUrl={item.fish?.image_url}
              unlocked
              size={72}
            />
          </View>
        )}
      </View>
      <View className="px-3 py-3">
        <View className="flex-row items-center justify-between"><Text className="text-xl font-black" style={{ color: FIELD_COLORS.ink }} numberOfLines={1}>
          {title}
        </Text><Text className="text-[10px]" style={{ color: FIELD_COLORS.ink }}>현장 인증</Text></View>
        {item.size_cm != null && (
          <Text className="mt-2 text-2xl font-black" style={{ color: FIELD_COLORS.teal }}>
            {item.size_cm}<Text className="text-sm"> cm</Text>
          </Text>
        )}
        <Text className="mt-2 text-[11px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>{formatCaughtAt(item.caught_at)} · {item.location_name ?? "현장 기록"}</Text>
        <Text className="mt-2 text-[10px]" style={{ color: "#9CB0B3", fontFamily: monoFont }}>CAT-{item.id.slice(0, 8).toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );
};

const CatchDetailModal = ({
  item,
  visible,
  onClose,
}: {
  item: UserCatch | null;
  visible: boolean;
  onClose: () => void;
}) => {
  if (!item) return null;
  const title = item.fish?.name_ko ?? item.fish?.name ?? "어종";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-slate-950/50 px-4"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm overflow-hidden rounded-2xl bg-white"
        >
          <View className="aspect-[4/5] bg-slate-100">
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                resizeMode="cover"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <FishThumb
                  imageUrl={item.fish?.image_url}
                  unlocked
                  size={120}
                />
              </View>
            )}
          </View>
          <View className="p-5">
            <Text className="text-xl font-bold text-slate-900">{title}</Text>
            <Text className="mt-1 text-sm text-slate-500">
              {formatCaughtAt(item.caught_at)}
            </Text>
            {item.size_cm != null && (
              <Text className="mt-3 text-sm text-slate-700">
                크기 {item.size_cm}cm
              </Text>
            )}
            {item.location_name ? (
              <Text className="mt-1 text-sm text-slate-700">
                {item.location_name}
              </Text>
            ) : null}
            {item.memo ? (
              <Text className="mt-3 text-sm leading-5 text-slate-600">
                {item.memo}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="mx-4 mb-4 rounded-xl bg-slate-900 py-3.5"
          >
            <Text className="text-center font-medium text-white">닫기</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
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
}: CardsPanelProps) => {
  const [selected, setSelected] = useState<UserCatch | null>(null);

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
        data={catches}
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
            <View className="flex-row items-center justify-between"><Text className="text-xl font-black" style={{ color: FIELD_COLORS.ink }}>나의 조과 카드 <Text style={{ color: FIELD_COLORS.teal }}>{catches.length}</Text></Text><View className="flex-row items-center"><Text className="mr-2 font-semibold" style={{ color: FIELD_COLORS.teal }}>정렬</Text><FontAwesome name="sliders" size={18} color={FIELD_COLORS.teal} /></View></View>
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
