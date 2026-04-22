import { Ionicons } from "@expo/vector-icons"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"

import { ActionablesScreen } from "@/screens/ActionablesScreen"
import { ChatScreen } from "@/screens/ChatScreen"
import { RoutinesScreen } from "@/screens/RoutinesScreen"
import { SettingsScreen } from "@/screens/SettingsScreen"
import { useAppTheme } from "@/theme/context"

import type { MainTabParamList } from "./navigationTypes"

const Tab = createBottomTabNavigator<MainTabParamList>()

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"]

interface TabIconProps {
  focused: boolean
  color: string
  size: number
}

function makeTabIcon(focusedName: IoniconsName, outlineName: IoniconsName) {
  const TabIcon = ({ focused, color, size }: TabIconProps) => (
    <Ionicons name={focused ? focusedName : outlineName} size={size} color={color} />
  )
  TabIcon.displayName = `TabIcon(${String(focusedName)})`
  return TabIcon
}

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
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: makeTabIcon("chatbubble-ellipses", "chatbubble-ellipses-outline"),
        }}
      />
      <Tab.Screen
        name="Actionables"
        component={ActionablesScreen}
        options={{
          tabBarIcon: makeTabIcon("checkbox", "checkbox-outline"),
        }}
      />
      <Tab.Screen
        name="Routines"
        component={RoutinesScreen}
        options={{
          tabBarIcon: makeTabIcon("repeat", "repeat-outline"),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: makeTabIcon("settings", "settings-outline"),
        }}
      />
    </Tab.Navigator>
  )
}
