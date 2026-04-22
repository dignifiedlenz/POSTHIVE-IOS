import React, {useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
} from 'react-native';
import {Clock, Send} from 'lucide-react-native';
import {theme} from '../theme';
import {formatVideoTimestamp} from '../lib/utils';
import {GlassComposerBar} from './GlassComposerBar';
import {AppleNativeGlassIconButton} from './native/AppleNativeGlassIconButton';

export type CommentComposerGlassRowProps = {
  commentText: string;
  onChangeText: (t: string) => void;
  currentVideoTime: number;
  onTimestampPress: () => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  inputStyle: StyleProp<TextStyle>;
  borderRadius?: number;
  autoFocus?: boolean;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  textInputProps?: Partial<TextInputProps>;
};

export function CommentComposerGlassRow({
  commentText,
  onChangeText,
  currentVideoTime,
  onTimestampPress,
  onSubmit,
  isSubmitting,
  inputStyle,
  borderRadius = 20,
  autoFocus,
  onInputFocus,
  onInputBlur,
  textInputProps,
}: CommentComposerGlassRowProps) {
  const canSend = !!commentText.trim() && !isSubmitting;

  const submit = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  return (
    <GlassComposerBar borderRadius={borderRadius} contentStyle={styles.glassContent}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Insert current timestamp"
        hitSlop={8}
        onPress={onTimestampPress}
        style={({pressed}) => [styles.timestampWrap, pressed && styles.timestampPressed]}>
        <Clock size={14} color="rgba(255, 255, 255, 0.7)" />
        <Text style={styles.timestampText}>{formatVideoTimestamp(currentVideoTime)}</Text>
      </Pressable>
      <TextInput
        style={[styles.inputBase, inputStyle]}
        placeholder="Leave feedback..."
        placeholderTextColor={theme.colors.textMuted}
        value={commentText}
        onChangeText={onChangeText}
        multiline
        maxLength={1000}
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        autoFocus={autoFocus}
        {...textInputProps}
        onFocus={e => {
          onInputFocus?.();
          textInputProps?.onFocus?.(e);
        }}
        onBlur={e => {
          onInputBlur?.();
          textInputProps?.onBlur?.(e);
        }}
      />
      {isSubmitting ? (
        <View style={styles.sendingWrap} accessibilityLabel="Sending comment">
          <ActivityIndicator size="small" color={theme.colors.textPrimary} />
        </View>
      ) : (
        <AppleNativeGlassIconButton
          systemImage="paperplane.fill"
          prominent
          enabled={canSend}
          onPress={submit}
          accessibilityLabel="Send comment"
          fallbackIcon={Send}
          fallbackIconColor={
            canSend ? theme.colors.textPrimary : theme.colors.textMuted
          }
        />
      )}
    </GlassComposerBar>
  );
}

const styles = StyleSheet.create({
  glassContent: {
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 6,
  },
  timestampWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 44,
    gap: 4,
  },
  timestampPressed: {
    opacity: 0.85,
    transform: [{scale: 0.96}],
  },
  timestampText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.5,
  },
  inputBase: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    maxHeight: 100,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 4,
    textAlignVertical: 'center',
  },
  sendingWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
