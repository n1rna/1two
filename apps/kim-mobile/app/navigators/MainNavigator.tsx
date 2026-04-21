import { Ionicons } from "@expo/vector-icons"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"

import { ActionablesScreen } from "@/screens/ActionablesScreen"
import { ChatScreen } from "@/screens/ChatScreen"
import { SettingsScreen } from "@/screens/SettingsScreen"
import { useAppTheme } from "@/theme/context"

import type { MainTabParamList } from "./navigationTypes"

const Tab = createBottomTabNavigator<MainTabParamList>()

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"]

export const MainNavigator = () => {
  const {
    theme: { colors },
  } = useAppTheme()

  const renderIcon =
    (focusedName: IoniconsName, outlineName: IoniconsName) =>
    ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
      <Ionicons name={focused ? focusedName : outlineName} size={size} color={color} />
    )

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: renderIcon("chatbubble-ellipses", "chatbubble-ellipses-outline"),
        }}
      />
      <Tab.Screen
        name="Actionables"
        component={ActionablesScreen}
        options={{
          tabBarIcon: renderIcon("checkbox", "checkbox-outline"),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: renderIcon("settings", "settings-outline"),
        }}
      />
    </Tab.Navigator>
  )
}
