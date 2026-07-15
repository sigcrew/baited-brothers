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
  new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
      className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white"
      style={{ width: "48%" }}
    >
      <View className="aspect-[3/4] bg-slate-100">
        {hasPhoto ? (
          <Image
            source={{ uri: item.image_url! }}
            className="h-full w-full"
            resizeMode="cover"
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
      <View className="px-2.5 py-2.5">
        <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
          {title}
        </Text>
        <Text className="mt-0.5 text-[11px] text-slate-400">
          {formatCaughtAt(item.caught_at)}
        </Text>
        {item.size_cm != null && (
          <Text className="mt-1 text-[11px] font-medium text-teal-800">
            {item.size_cm}cm
          </Text>
        )}
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
                className="h-full w-full"
                resizeMode="cover"
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
          paddingHorizontal: 16,
          paddingTop: 16,
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
          <View className="mb-3">
            <Text className="text-xs font-medium text-teal-800">앨범</Text>
            <Text className="mt-0.5 text-base font-semibold text-slate-900">
              {catches.length}장의 조과 카드
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              현장에서 기록한 조과가 여기에 모입니다.
            </Text>
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
