import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getField60Illustration } from "@/src/data/field60Illustrations";
import type { Fish } from "@/src/hooks/useFishes";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type FishCatalogSheetProps = {
  fishes: Fish[];
  isLoading: boolean;
  visible: boolean;
  onClose: () => void;
  onSelect: (fish: Fish) => void;
  onSelectCustom?: (name: string) => void;
};

export const FishCatalogSheet = ({
  fishes,
  isLoading,
  visible,
  onClose,
  onSelect,
  onSelectCustom,
}: FishCatalogSheetProps) => {
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  const filteredFishes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return fishes;
    return fishes.filter((fish) =>
      `${fish.name_ko ?? ""} ${fish.name}`.toLowerCase().includes(keyword),
    );
  }, [fishes, query]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="어종 검색 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={styles.keyboardAvoidingView}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.handleIndicator} />
            <View className="flex-row items-center justify-between border-b px-5 pb-3" style={{ borderColor: FIELD_COLORS.rule }}>
              <View>
                <Text className="text-[11px] tracking-[1.6px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                  FIELD 60 · SPECIES SEARCH
                </Text>
                <Text className="mt-1 text-2xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  도감에서 직접 찾기
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="어종 검색 닫기"
                onPress={onClose}
                className="h-11 w-11 items-center justify-center"
              >
                <FontAwesome name="times" size={22} color={FIELD_COLORS.ink} />
              </TouchableOpacity>
            </View>

            <View className="px-5 pb-3 pt-4">
              <View className="flex-row items-center border bg-white px-4" style={{ borderColor: FIELD_COLORS.rule }}>
                <FontAwesome name="search" size={16} color={FIELD_COLORS.muted} />
                <TextInput
                  accessibilityLabel="어종 이름 검색"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="한글명 또는 학명 검색"
                  placeholderTextColor={FIELD_COLORS.muted}
                  autoFocus
                  className="ml-3 h-12 flex-1 text-base"
                  style={{
                    color: FIELD_COLORS.ink,
                    flex: 1,
                    fontFamily: bodyFont,
                    fontSize: 16,
                    height: 48,
                    marginLeft: 12,
                  }}
                />
              </View>
              <Text className="mt-2 text-[10px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                {isLoading ? "LOADING FIELD GUIDE" : `${filteredFishes.length} / ${fishes.length} SPECIES`}
              </Text>
            </View>

            <FlatList
              data={filteredFishes}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
              renderItem={({ item }) => {
                const illustration = getField60Illustration(
                  item.catalog_sort_order,
                  "color",
                );
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name_ko ?? item.name} 선택`}
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className="mb-2 flex-row items-center border bg-white p-3"
                    style={{ borderColor: FIELD_COLORS.rule }}
                  >
                    <View className="h-16 w-20 items-center justify-center" style={{ backgroundColor: FIELD_COLORS.locked }}>
                      {illustration ? (
                        <Image
                          source={illustration}
                          resizeMode="contain"
                          style={{ width: "92%", height: "92%" }}
                        />
                      ) : (
                        <FontAwesome name="image" size={20} color={FIELD_COLORS.muted} />
                      )}
                    </View>
                    <View className="min-w-0 flex-1 pl-4">
                      <Text className="text-lg" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                        {item.name_ko ?? item.name}
                      </Text>
                      <Text numberOfLines={1} className="mt-1 text-[9px] uppercase tracking-[0.9px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}>
                        {item.name}
                      </Text>
                    </View>
                    <FontAwesome name="angle-right" size={24} color={FIELD_COLORS.teal} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View className="items-center border-y py-12" style={{ borderColor: FIELD_COLORS.rule }}>
                  <FontAwesome name="search" size={24} color={FIELD_COLORS.muted} />
                  <Text className="mt-4" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                    검색 결과가 없습니다
                  </Text>
                  <Text className="mt-2 text-sm" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                    다른 이름이나 학명으로 찾아보세요.
                  </Text>
                </View>
              }
              ListFooterComponent={
                onSelectCustom && query.trim() ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${query.trim()}을 도감 밖 어종으로 기록`}
                    onPress={() => {
                      onSelectCustom(query.trim());
                      onClose();
                    }}
                    className="mt-3 border-l-4 bg-white px-4 py-4"
                    style={{ borderLeftColor: FIELD_COLORS.orange }}
                  >
                    <Text
                      style={{
                        color: FIELD_COLORS.ink,
                        fontFamily: bodyExtraBoldFont,
                      }}
                    >
                      ‘{query.trim()}’ 도감 밖 어종으로 기록
                    </Text>
                    <Text
                      className="mt-1 text-xs leading-5"
                      style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
                    >
                      일반 조과 카드에는 남지만 도감 해금과 랭킹에는
                      반영되지 않습니다.
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  handleIndicator: {
    alignSelf: "center",
    backgroundColor: FIELD_COLORS.rule,
    borderRadius: 2,
    height: 4,
    marginBottom: 12,
    marginTop: 10,
    width: 48,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    alignSelf: "center",
    backgroundColor: FIELD_COLORS.foam,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "76%",
    maxWidth: 520,
    overflow: "hidden",
    width: "100%",
  },
});
