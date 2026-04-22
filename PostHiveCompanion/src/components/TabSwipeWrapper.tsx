import React, {useCallback, useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import {useNavigation} from '@react-navigation/native';

/** Must match `MainTabs` screen order (left → right). */
const MAIN_TAB_ORDER = [
  'Assistant',
  'Home',
  'Deliverables',
  'Projects',
  'Calendar',
] as const;

type MainTabName = (typeof MAIN_TAB_ORDER)[number];

function findMainTabNavigator(nav: {getParent?: () => unknown; getState?: () => unknown} | null): {
  navigate: (name: string) => void;
  getState: () => {index?: number; routes?: {name: string}[]};
} | null {
  let cur: any = nav;
  for (let i = 0; i < 10 && cur; i++) {
    const state = cur.getState?.() as {routes?: {name: string}[]} | undefined;
    const routes = state?.routes;
    if (Array.isArray(routes) && routes.length >= 3) {
      const names = new Set(routes.map(r => r.name));
      if (names.has('Home') && names.has('Deliverables') && names.has('Assistant')) {
        return cur;
      }
    }
    cur = cur.getParent?.();
  }
  return null;
}

const SWIPE_MIN = 72;
const VELOCITY_MIN = 420;

/**
 * Horizontal swipe on main tab roots switches tabs (same as tapping the tab bar).
 * Pan fails early on vertical movement so lists / calendar scroll stay responsive.
 */
export function TabSwipeWrapper({children}: {children: React.ReactNode}) {
  const navigation = useNavigation();

  const switchTab = useCallback(
    (direction: 'next' | 'prev') => {
      const tabNav = findMainTabNavigator(navigation as any);
      if (!tabNav) return;

      const state = tabNav.getState();
      const routes = state.routes ?? [];
      const idx = state.index ?? 0;
      const currentName = routes[idx]?.name as MainTabName | undefined;
      if (!currentName) return;

      const pos = MAIN_TAB_ORDER.indexOf(currentName);
      if (pos < 0) return;

      const delta = direction === 'next' ? 1 : -1;
      const nextPos = pos + delta;
      if (nextPos < 0 || nextPos >= MAIN_TAB_ORDER.length) return;

      tabNav.navigate(MAIN_TAB_ORDER[nextPos]);
    },
    [navigation],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-28, 28])
        .failOffsetY([-22, 22])
        .onEnd(e => {
          'worklet';
          const {translationX, velocityX} = e;
          if (translationX < -SWIPE_MIN || velocityX < -VELOCITY_MIN) {
            runOnJS(switchTab)('next');
          } else if (translationX > SWIPE_MIN || velocityX > VELOCITY_MIN) {
            runOnJS(switchTab)('prev');
          }
        }),
    [switchTab],
  );

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
