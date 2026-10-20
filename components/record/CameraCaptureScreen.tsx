import type { RefObject } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CameraView } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CameraCaptureScreenProps = {
  cameraRef: RefObject<CameraView | null>;
  tripName?: string;
  isCapturing: boolean;
  onTakePhoto: () => void;
  onPickLibrary: () => void;
  onBack: () => void;
};

/** 전체 화면 카메라. 셔터와 보관함 선택만 담당하고 결과 처리는 부모가 한다. */
export const CameraCaptureScreen = ({
  cameraRef,
  tripName,
  isCapturing,
  onTakePhoto,
  onPickLibrary,
  onBack,
}: CameraCaptureScreenProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="picture" />
      <View className="absolute left-0 right-0 top-0 flex-row justify-between px-5" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} className="rounded-lg bg-black/50 px-4 py-2">
          <Text className="font-medium text-white">닫기</Text>
        </TouchableOpacity>
        <View className="rounded-lg bg-black/50 px-3 py-2">
          <Text className="text-sm text-white">{tripName ? `${tripName} · 현장 기록` : "사진 기록 · GPS 선택"}</Text>
        </View>
      </View>
      <View className="absolute bottom-0 left-0 right-0 items-center bg-black/40 pb-8 pt-5" style={{ paddingBottom: insets.bottom + 24 }}>
        <Text className="mb-4 text-sm text-white">물고기 전체가 잘 보이게 촬영해 주세요</Text>
        <TouchableOpacity
          accessibilityLabel="사진 보관함에서 물고기 사진 선택"
          accessibilityRole="button"
          onPress={onPickLibrary}
          className="mb-4 border border-white/60 bg-black/40 px-5 py-3"
        >
          <Text className="font-semibold text-white">사진 보관함에서 선택</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="사진 촬영"
          accessibilityRole="button"
          disabled={isCapturing}
          onPress={onTakePhoto}
          className="h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/30"
        >
          {isCapturing ? <ActivityIndicator color="#fff" /> : <View className="h-16 w-16 rounded-full bg-white" />}
        </TouchableOpacity>
      </View>
    </View>
  );
};
