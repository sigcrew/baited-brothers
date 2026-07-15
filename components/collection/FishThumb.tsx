import { Image, Text, View } from "react-native";

type FishThumbProps = {
  imageUrl?: string | null;
  unlocked: boolean;
  size?: number;
};

/** 해금: 사진 또는 단정한 플레이스홀더 / 미해금: 실루엣 */
export const FishThumb = ({
  imageUrl,
  unlocked,
  size = 72,
}: FishThumbProps) => {
  if (unlocked && imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size }}
        className="bg-slate-100"
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size }}
      className={`items-center justify-center ${
        unlocked ? "bg-teal-50" : "bg-slate-200"
      }`}
    >
      <View
        className={`h-10 w-14 rounded-full ${
          unlocked ? "bg-teal-700/30" : "bg-slate-400/50"
        }`}
      />
      <View
        className={`mt-1 h-2 w-8 rounded-full ${
          unlocked ? "bg-teal-700/20" : "bg-slate-400/40"
        }`}
      />
      {!unlocked && (
        <Text className="absolute bottom-1 text-[10px] font-medium text-slate-500">
          ?
        </Text>
      )}
    </View>
  );
};
