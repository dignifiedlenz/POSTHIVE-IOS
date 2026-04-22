import React from 'react';
import {View, StyleSheet, TouchableOpacity} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {theme} from '../theme';

interface LandscapeMenuButtonProps {
  onPress: () => void;
}

export function LandscapeMenuButton({onPress}: LandscapeMenuButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          top: insets.top + 12,
        },
      ]}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <View style={styles.icon}>
          <View style={styles.barLong} />
          <View style={styles.barShort} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  icon: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 5,
  },
  barLong: {
    width: 18,
    height: 2,
    backgroundColor: theme.colors.textPrimary,
  },
  barShort: {
    width: 12,
    height: 2,
    backgroundColor: theme.colors.textPrimary,
  },
});












