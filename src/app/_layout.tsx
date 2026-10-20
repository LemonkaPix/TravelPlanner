import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { colors } from '@/constants/theme';
import { StoredSettingsProvider } from '@/features/planner/StoredSettingsProvider';

export default function RootLayout() {
  return (
    <StoredSettingsProvider>
      <StatusBar style="dark" />
      <Tabs initialRouteName="index" screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white },
        tabBarHideOnKeyboard: true,
      }}>
        <Tabs.Screen name="index" options={{ title: 'Plan',
          tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 24 }}>↗</Text>,
        }} />
        <Tabs.Screen name="settings" options={{ title: 'Ustawienia',
          tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 24 }}>⚙</Text>,
        }} />
      </Tabs>
    </StoredSettingsProvider>
  );
}
