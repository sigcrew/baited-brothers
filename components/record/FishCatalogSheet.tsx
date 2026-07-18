import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
};

const SNAP_POINTS = ["76%"];

export const FishCatalogSheet = ({
  fishes,
  isLoading,
  visible,
  onClose,
  onSelect,
}: FishCatalogSheetProps) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    bottomSheetRef.current?.present();
  }, [visible]);

  const filteredFishes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return fishes;
    return fishes.filter((fish) =>
      `${fish.name_ko ?? ""} ${fish.name}`.toLowerCase().includes(keyword),
    );
  }, [fishes, query]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.62}
        pressBehavior="close"
      />
    ),
    [],
  );

  const dismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  if (!visible) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      accessibilityViewIsModal
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={onClose}
      snapPoints={SNAP_POINTS}
      style={styles.sheet}
    >
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
          onPress={dismiss}
          className="h-11 w-11 items-center justify-center"
        >
          <FontAwesome name="times" size={22} color={FIELD_COLORS.ink} />
        </TouchableOpacity>
      </View>

      <View className="px-5 pb-3 pt-4">
        <View className="flex-row items-center border bg-white px-4" style={{ borderColor: FIELD_COLORS.rule }}>
          <FontAwesome name="search" size={16} color={FIELD_COLORS.muted} />
          <BottomSheetTextInput
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

      <BottomSheetFlatList
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
                dismiss();
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
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: FIELD_COLORS.rule,
    height: 4,
    width: 48,
  },
  sheet: {
    alignSelf: "center",
    maxWidth: 520,
    width: "100%",
  },
  sheetBackground: {
    backgroundColor: FIELD_COLORS.foam,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
});
