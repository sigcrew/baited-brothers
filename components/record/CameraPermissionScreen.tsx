import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type CameraPermissionScreenProps = {
  /** 권한 상태를 아직 모르는 첫 렌더. */
  isPermissionLoading: boolean;
  isRequesting: boolean;
  onRequestPermission: () => void;
  onPickLibrary: () => void;
  onBack: () => void;
};

/** 카메라 권한이 없을 때. 보관함 기록은 권한 없이도 이어갈 수 있다. */
export const CameraPermissionScreen = ({
  isPermissionLoading,
  isRequesting,
  onRequestPermission,
  onPickLibrary,
  onBack,
}: CameraPermissionScreenProps) => {
  const isBusy = isPermissionLoading || isRequesting;
  return (
    <View className="flex-1 items-center justify-center bg-slate-950 px-8">
      <Text className="text-xl font-bold text-white">카메라 권한이 필요해요</Text>
      <Text className="mt-3 text-center text-slate-300">
        카메라를 허용하면 현장 인증 촬영을 할 수 있습니다. 사진 보관함
        기록은 카메라 권한 없이도 이용할 수 있습니다.
      </Text>
      {isBusy ? (
        <View className="mt-6 flex-row items-center rounded-xl bg-white px-6 py-3">
          <ActivityIndicator color="#0f172a" />
          <Text className="ml-3 font-semibold text-slate-900">
            {isPermissionLoading ? "권한 상태 확인 중" : "권한 요청 중"}
          </Text>
        </View>
      ) : (
        <TouchableOpacity accessibilityRole="button" onPress={onRequestPermission} className="mt-6 rounded-xl bg-white px-6 py-3">
          <Text className="font-semibold text-slate-900">권한 허용</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        accessibilityLabel="사진 보관함에서 물고기 사진 선택"
        accessibilityRole="button"
        onPress={onPickLibrary}
        className="mt-4 border border-white/50 px-6 py-3"
      >
        <Text className="font-semibold text-white">사진 보관함에서 선택</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} className="mt-4 py-2">
        <Text className="text-slate-400">돌아가기</Text>
      </TouchableOpacity>
    </View>
  );
};
