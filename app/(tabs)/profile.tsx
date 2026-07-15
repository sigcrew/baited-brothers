import { Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/contexts/AuthContext";

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut } = useAuth();

  const email = session?.user?.email;
  const displayName =
    session?.user?.user_metadata?.display_name ??
    session?.user?.user_metadata?.full_name ??
    null;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const handleGoLogin = () => {
    router.push("/(auth)/login");
  };

  return (
    <View
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      <View className="border-b border-gray-200 bg-white px-4 pb-4 pt-2">
        <Text className="text-2xl font-bold text-gray-900">프로필</Text>
      </View>

      <View className="px-4 pt-6">
        <View className="rounded-xl border border-gray-200 bg-white px-4 py-5">
          <Text className="text-xs font-medium text-gray-400">계정</Text>
          {session ? (
            <>
              {displayName && (
                <Text className="mt-2 text-lg font-semibold text-gray-900">
                  {displayName}
                </Text>
              )}
              <Text
                className={`text-base text-gray-700 ${displayName ? "mt-1" : "mt-2"}`}
              >
                {email ?? "이메일 없음"}
              </Text>
            </>
          ) : (
            <Text className="mt-2 text-base text-gray-600">
              {__DEV__
                ? "개발 모드 · 로그인되지 않았습니다."
                : "로그인이 필요합니다."}
            </Text>
          )}
        </View>

        <View className="mt-4">
          {session ? (
            <TouchableOpacity
              onPress={handleSignOut}
              className="rounded-xl bg-gray-900 py-3.5 active:bg-gray-800"
            >
              <Text className="text-center font-medium text-white">
                로그아웃
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleGoLogin}
              className="rounded-xl bg-gray-900 py-3.5 active:bg-gray-800"
            >
              <Text className="text-center font-medium text-white">로그인</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default ProfileScreen;
