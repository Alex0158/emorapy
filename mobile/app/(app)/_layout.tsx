import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { palette, typography } from '@/src/ui/theme';

const iconSize = 24;

function TabIcon({ name, color }: { name: SFSymbol; color: string }) {
  const fallbackName: AndroidSymbol = 'circle';
  return (
    <SymbolView
      name={{ ios: name, android: fallbackName, web: fallbackName }}
      size={iconSize}
      tintColor={color}
    />
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.teal,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: typography.caption,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.line,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="case/index"
        options={{
          title: '案件',
          tabBarIcon: ({ color }) => <TabIcon name="doc.text" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: '對話',
          tabBarIcon: ({ color }) => <TabIcon name="bubble.left.and.bubble.right" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat/room"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="chat/invite"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: '個人',
          tabBarIcon: ({ color }) => <TabIcon name="person.crop.circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/interview"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/story"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications/index"
        options={{
          title: '提醒',
          tabBarIcon: ({ color }) => <TabIcon name="bell" color={color} />,
        }}
      />
      <Tabs.Screen
        name="repair/index"
        options={{
          title: '修復',
          tabBarIcon: ({ color }) => <TabIcon name="checklist" color={color} />,
        }}
      />
    </Tabs>
  );
}
