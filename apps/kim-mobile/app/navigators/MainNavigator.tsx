import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"

import { ActionablesScreen } from "@/screens/ActionablesScreen"
import { ChatScreen } from "@/screens/ChatScreen"
import { SettingsScreen } from "@/screens/SettingsScreen"
import { useAppTheme } from "@/theme/context"

import type { MainTabParamList } from "./navigationTypes"

const Tab = createBottomTabNavigator<MainTabParamList>()

export const MainNavigator = () => {
  const {
    theme: { colors },
  } = useAppTheme()

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
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Actionables" component={ActionablesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}
