import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, type DimensionValue } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { StoredSettingsProvider } from '@/features/planner/StoredSettingsProvider';
import { StoredPlanProvider } from '@/features/planner/useStoredPlan';

export default function RootLayout() {
  return (
    <StoredSettingsProvider>
      <StoredPlanProvider>
        <StatusBar style="light" />
        <Tabs screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.surface },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.onSurfaceVariant,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarHideOnKeyboard: true,
        }}>
          <Tabs.Screen name="index" options={{
            title: 'Plan',
            tabBarIcon: ({ color }) => <MaterialIcons name="route" size={24} color={color} />,
          }} />
          <Tabs.Screen name="editor" options={{
            title: 'Edytor',
            tabBarIcon: ({ color }) => <MaterialIcons name="edit-calendar" size={24} color={color} />,
          }} />
          <Tabs.Screen name="settings" options={{
            title: 'Ustawienia',
            tabBarIcon: ({ color }) => <MaterialIcons name="tune" size={24} color={color} />,
          }} />
        </Tabs>
      </StoredPlanProvider>
    </StoredSettingsProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(13, 19, 32, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 71, 84, 0.35)',
    minHeight: 64,
    height: Platform.OS === 'web'
      ? 'calc(64px + env(safe-area-inset-bottom, 0px))' as DimensionValue
      : undefined,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'web'
      ? 'calc(6px + env(safe-area-inset-bottom, 0px))' as DimensionValue
      : 6,
    paddingLeft: Platform.OS === 'web'
      ? 'env(safe-area-inset-left, 0px)' as DimensionValue
      : undefined,
    paddingRight: Platform.OS === 'web'
      ? 'env(safe-area-inset-right, 0px)' as DimensionValue
      : undefined,
  },
  tabLabel: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
