import { ComponentProps } from "react"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import {
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

// Authed-state bottom tabs.
export type MainTabParamList = {
  Chat: { prefill?: string } | undefined
  Actionables: undefined
  Routines: undefined
  Meals: undefined
  Settings: undefined
}

// Root stack: SignIn when unauthed, Main (tabs) when authed.
// Conversations is pushed on top of Main when the user wants to browse
// past chats from the Chat tab header.
export type AppStackParamList = {
  SignIn: undefined
  Main: NavigatorScreenParams<MainTabParamList>
  Conversations: undefined
  RoutineDetail: { id: string }
  MealPlanDetail: { id: string }
  // 🔥 Your screens go here
  // IGNITE_GENERATOR_ANCHOR_APP_STACK_PARAM_LIST
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

export interface NavigationProps
  extends Partial<ComponentProps<typeof NavigationContainer<AppStackParamList>>> {}
