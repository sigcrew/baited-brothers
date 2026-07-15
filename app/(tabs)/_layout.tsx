import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useAuth } from "@/src/contexts/AuthContext";

const TabBarIcon = (props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) => <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;

const TabLayout = () => {
  const colorScheme = useColorScheme();
  const { session } = useAuth();

  if (!__DEV__ && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="encyclopedia"
        options={{
          title: "수집",
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "프로필",
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
