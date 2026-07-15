import { useState } from "react";
import {
  View,
  Text,
  FlatList,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useFishingTrips,
  type FishingTrip,
} from "@/src/hooks/useFishingTrips";

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
  }) => Promise<Error | null>;
  isSaving: boolean;
}) => {
  const [spotName, setSpotName] = useState("");
  const [scheduledInput, setScheduledInput] = useState(defaultScheduledInput);
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setSpotName("");
    setScheduledInput(defaultScheduledInput());
    setMemo("");
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
    plannedTrips,
    recentDoneTrips,
    isLoading,
    isRefreshing,
    isSaving,
    error,
    isLoggedIn,
    refetch,
    createTrip,
    markDone,
    cancelTrip,
  } = useFishingTrips();

  const handleCreate = async (input: {
    spotName: string;
    scheduledAt: Date;
    memo?: string;
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

  if (!isLoggedIn) {
    return (
      <View
        className="flex-1 items-center justify-center bg-gray-50 px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-2xl font-bold text-gray-900">출조 일정</Text>
        <Text className="mt-3 text-center text-gray-600">
          로그인하면 낚시터 일정을 계획하고, 다녀온 뒤 완료할 수 있어요.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          className="mt-6 rounded-xl bg-gray-900 px-6 py-3 active:bg-gray-800"
        >
          <Text className="font-medium text-white">로그인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="border-b border-gray-200 bg-white px-4 pb-4 pt-2">
        <Text className="text-sm text-teal-800">낚시당한 녀석들</Text>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">출조 일정</Text>
          <TouchableOpacity
            onPress={() => setAddVisible(true)}
            className="rounded-lg bg-gray-900 px-3 py-2 active:bg-gray-800"
          >
            <Text className="text-sm font-medium text-white">추가</Text>
          </TouchableOpacity>
        </View>
        <Text className="mt-1 text-sm text-gray-500">
          계획해 두고, 다녀오면 완료하세요.
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-gray-600">
            일정을 불러오지 못했습니다.{"\n"}
            (DB 마이그레이션이 적용됐는지 확인해 주세요.)
          </Text>
          <Text className="mt-2 text-center text-xs text-gray-400">
            {error.message}
          </Text>
          <TouchableOpacity
            onPress={refetch}
            className="mt-4 rounded-lg bg-gray-200 px-4 py-2"
          >
            <Text className="font-medium text-gray-700">다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={plannedTrips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: insets.bottom + 32,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refetch} />
          }
          ListHeaderComponent={
            <Text className="mb-3 text-sm font-semibold text-gray-700">
              다가오는 일정
            </Text>
          }
          ListEmptyComponent={
            <View className="mb-6 items-center rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10">
              <Text className="font-medium text-gray-900">예정된 출조가 없어요</Text>
              <Text className="mt-2 text-center text-sm text-gray-500">
                낚시터와 날짜를 추가해 두세요.
              </Text>
              <TouchableOpacity
                onPress={() => setAddVisible(true)}
                className="mt-4 rounded-lg bg-gray-900 px-4 py-2.5"
              >
                <Text className="text-sm font-medium text-white">
                  첫 일정 추가
                </Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TripRow
              trip={item}
              showActions
              disabled={isSaving}
              onDone={() => handleDone(item)}
              onCancel={() => handleCancel(item)}
            />
          )}
          ListFooterComponent={
            recentDoneTrips.length > 0 ? (
              <View className="mt-4">
                <Text className="mb-3 text-sm font-semibold text-gray-700">
                  최근 완료
                </Text>
                {recentDoneTrips.map((trip) => (
                  <TripRow key={trip.id} trip={trip} />
                ))}
              </View>
            ) : null
          }
        />
      )}

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
