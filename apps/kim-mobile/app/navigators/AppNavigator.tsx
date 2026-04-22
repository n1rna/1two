/**
 * Root navigator. Unauthed → SignIn. Authed → Main (bottom tabs).
 * Replaces Ignite's demo Welcome/Demo flow for the Kim mobile app.
 */
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import Config from "@/config"
import { useAuth } from "@/context/AuthContext"
import { ConversationsScreen } from "@/screens/ConversationsScreen"
import { ErrorBoundary } from "@/screens/ErrorScreen/ErrorBoundary"
import { MealPlanDetailScreen } from "@/screens/MealPlanDetailScreen"
import { RoutineDetailScreen } from "@/screens/RoutineDetailScreen"
import { SignInScreen } from "@/screens/SignInScreen"
import { useAppTheme } from "@/theme/context"

import { MainNavigator } from "./MainNavigator"
import { navigationRef, useBackButtonHandler } from "./navigationUtilities"
import type { AppStackParamList, NavigationProps } from "./navigationTypes"

const exitRoutes = Config.exitRoutes

const Stack = createNativeStackNavigator<AppStackParamList>()

const AppStack = () => {
  const { isAuthenticated } = useAuth()
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
      initialRouteName={isAuthenticated ? "Main" : "SignIn"}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          <Stack.Screen
            name="Conversations"
            component={ConversationsScreen}
            options={{ headerShown: true, title: "Past conversations" }}
          />
          <Stack.Screen
            name="RoutineDetail"
            component={RoutineDetailScreen}
            options={{ headerShown: true, title: "Routine" }}
          />
          <Stack.Screen
            name="MealPlanDetail"
            component={MealPlanDetailScreen}
            options={{ headerShown: true, title: "Meal plan" }}
          />
        </>
      ) : (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      )}
      {/** 🔥 Your screens go here */}
      {/* IGNITE_GENERATOR_ANCHOR_APP_STACK_SCREENS */}
    </Stack.Navigator>
  )
}

export const AppNavigator = (props: NavigationProps) => {
  const { navigationTheme } = useAppTheme()

  useBackButtonHandler((routeName) => exitRoutes.includes(routeName))

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} {...props}>
      <ErrorBoundary catchErrors={Config.catchErrors}>
        <AppStack />
      </ErrorBoundary>
    </NavigationContainer>
  )
}
