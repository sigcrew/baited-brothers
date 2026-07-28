import { Redirect } from "expo-router";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchiveTabIcon } from "@/components/navigation/ArchiveTabIcon";
import { useAuth } from "@/src/contexts/AuthContext";
import { FIELD_COLORS, bodySemiBoldFont } from "@/src/theme/fieldJournal";

const TabLayout = () => {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 84 + insets.bottom;
  const tabBarPaddingBottom = 8 + insets.bottom;

  if (!__DEV__ && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: FIELD_COLORS.teal,
        tabBarInactiveTintColor: "#4B5D61",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: FIELD_COLORS.paper,
          borderTopColor: FIELD_COLORS.rule,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarPaddingBottom,
        },
        tabBarIconStyle: { marginTop: 1, marginBottom: 6 },
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 16,
          fontFamily: bodySemiBoldFont,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, focused }) => <ArchiveTabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "일지",
          tabBarIcon: ({ color, focused }) => <ArchiveTabIcon name="journal" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "지도",
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "rgba(255, 255, 255, 0.94)",
            borderTopColor: FIELD_COLORS.rule,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: tabBarPaddingBottom,
          },
          tabBarIcon: ({ color, focused }) => <ArchiveTabIcon name="map" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="encyclopedia"
        options={{
          title: "수집",
          tabBarIcon: ({ color, focused }) => <ArchiveTabIcon name="collection" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "프로필",
          tabBarIcon: ({ color, focused }) => <ArchiveTabIcon name="profile" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
