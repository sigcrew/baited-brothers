import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { TripCoverImage } from "@/src/hooks/useFishingTrips";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type TripCoverActionSheetProps = {
  hasCover: boolean;
  visible: boolean;
  isBusy?: boolean;
  onClose: () => void;
  onRemove?: () => void | Promise<void>;
  onSelect: (image: TripCoverImage) => void | Promise<void>;
};

const toTripCoverImage = (asset: ImagePicker.ImagePickerAsset): TripCoverImage => ({
  uri: asset.uri,
  fileName: asset.fileName,
  mimeType: asset.mimeType,
});

export const TripCoverActionSheet = ({
  hasCover,
  visible,
  isBusy = false,
  onClose,
  onRemove,
  onSelect,
}: TripCoverActionSheetProps) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (!visible) return;
    bottomSheetRef.current?.present();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.58}
        pressBehavior="close"
      />
    ),
    [],
  );

  const dismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const selectFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("카메라 권한 필요", "커버 사진을 촬영하려면 카메라 접근을 허용해 주세요.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    dismiss();
    await onSelect(toTripCoverImage(result.assets[0]));
  };

  const selectFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("사진 권한 필요", "커버를 선택하려면 사진 보관함 접근을 허용해 주세요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    dismiss();
    await onSelect(toTripCoverImage(result.assets[0]));
  };

  const removeCover = async () => {
    if (!onRemove) return;
    dismiss();
    await onRemove();
  };

  if (!visible) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      accessibilityViewIsModal
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing
      enablePanDownToClose
      handleIndicatorStyle={styles.handleIndicator}
      maxDynamicContentSize={420}
      onDismiss={onClose}
      stackBehavior="push"
      style={styles.sheet}
    >
      <BottomSheetView className="px-5 pb-7">
        <View className="flex-row items-center justify-between border-b pb-3" style={{ borderColor: FIELD_COLORS.rule }}>
          <View>
            <Text className="text-[10px] tracking-[1.5px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
              COVER IMAGE
            </Text>
            <Text className="mt-1 text-2xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
              커버 사진 선택
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="커버 사진 선택 닫기" onPress={dismiss} className="h-11 w-11 items-center justify-center">
            <FontAwesome name="times" size={22} color={FIELD_COLORS.ink} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="카메라로 커버 사진 촬영"
          disabled={isBusy}
          onPress={selectFromCamera}
          className="mt-4 flex-row items-center border bg-white px-4 py-4"
          style={{ borderColor: FIELD_COLORS.rule, opacity: isBusy ? 0.5 : 1 }}
        >
          <View className="h-10 w-10 items-center justify-center" style={{ backgroundColor: FIELD_COLORS.locked }}>
            <FontAwesome name="camera" size={18} color={FIELD_COLORS.teal} />
          </View>
          <View className="ml-4 flex-1">
            <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>카메라로 촬영</Text>
            <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>출조지 풍경을 바로 촬영합니다.</Text>
          </View>
          <FontAwesome name="angle-right" size={22} color={FIELD_COLORS.teal} />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="사진 보관함에서 커버 선택"
          disabled={isBusy}
          onPress={selectFromLibrary}
          className="mt-2 flex-row items-center border bg-white px-4 py-4"
          style={{ borderColor: FIELD_COLORS.rule, opacity: isBusy ? 0.5 : 1 }}
        >
          <View className="h-10 w-10 items-center justify-center" style={{ backgroundColor: FIELD_COLORS.locked }}>
            <FontAwesome name="image" size={18} color={FIELD_COLORS.teal} />
          </View>
          <View className="ml-4 flex-1">
            <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>사진 보관함에서 선택</Text>
            <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>저장된 사진을 4:3 비율로 맞춥니다.</Text>
          </View>
          <FontAwesome name="angle-right" size={22} color={FIELD_COLORS.teal} />
        </TouchableOpacity>

        {hasCover && onRemove ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="기본 커버로 되돌리기"
            disabled={isBusy}
            onPress={removeCover}
            className="mt-2 flex-row items-center border px-4 py-4"
            style={{ borderColor: FIELD_COLORS.rule, opacity: isBusy ? 0.5 : 1 }}
          >
            <View className="h-10 w-10 items-center justify-center">
              <FontAwesome name="undo" size={18} color={FIELD_COLORS.red} />
            </View>
            <Text className="ml-4 flex-1" style={{ color: FIELD_COLORS.red, fontFamily: bodyExtraBoldFont }}>
              기본 커버로 되돌리기
            </Text>
          </TouchableOpacity>
        ) : null}
      </BottomSheetView>
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
