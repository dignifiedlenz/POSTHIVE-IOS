import React from 'react';
import {View, Text, Image, StyleSheet, ViewStyle} from 'react-native';
import {theme} from '../../theme';
import {getInitials} from '../../lib/utils';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
}

export function Avatar({name, imageUrl, size = 'md', style}: AvatarProps) {
  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return 28;
      case 'md':
        return 36;
      case 'lg':
        return 48;
      case 'xl':
        return 64;
      default:
        return 36;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return theme.typography.fontSize.xs;
      case 'md':
        return theme.typography.fontSize.sm;
      case 'lg':
        return theme.typography.fontSize.md;
      case 'xl':
        return theme.typography.fontSize.lg;
      default:
        return theme.typography.fontSize.sm;
    }
  };

  const dimension = getDimensions();
  const initials = getInitials(name);

  if (imageUrl) {
    return (
      <Image
        source={{uri: imageUrl}}
        style={[
          styles.image,
          {width: dimension, height: dimension, borderRadius: dimension / 2},
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        },
        style,
      ]}>
      <Text style={[styles.initials, {fontSize: getFontSize()}]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: theme.colors.surfaceElevated,
  },
  placeholder: {
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
});












