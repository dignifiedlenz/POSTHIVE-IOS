import React, {useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Clock, Send} from 'lucide-react-native';
import {theme} from '../theme';
import {formatVideoTimestamp} from '../lib/utils';
import {AppleNativeGlassIconButton} from './native/AppleNativeGlassIconButton';

/**
 * Flat composer that mirrors the AssistantChatScreen input visually: a faint
 * gradient hairline divider above a plain row containing controls and a TextInput.
 *
 * Used inline at the bottom of the DeliverableReviewScreen so the comment input feels
 * consistent with the assistant chat. The glass-pill variant (`CommentComposerGlassRow`)
 * is still used for the in-video comment popups where it sits over media and benefits
 * from the glass aesthetic.
 */
export type FlatCommentComposerProps = {
  commentText: string;
  onChangeText: (t: string) => void;
  currentVideoTime: number;
  onTimestampPress: () => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  inputStyle?: StyleProp<TextStyle>;
  autoFocus?: boolean;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  textInputProps?: Partial<TextInputProps>;
};

export function FlatCommentComposer({
  commentText,
  onChangeText,
  currentVideoTime,
  onTimestampPress,
  onSubmit,
  isSubmitting,
  inputStyle,
  autoFocus,
  onInputFocus,
  onInputBlur,
  textInputProps,
}: FlatCommentComposerProps) {
  const canSend = !!commentText.trim() && !isSubmitting;

  const submit = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
        start={{x: 0, y: 0.5}}
        end={{x: 1, y: 0.5}}
        style={styles.divider}
        pointerEvents="none"
      />
      <View style={styles.row}>
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
          style={[styles.input, inputStyle]}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    marginHorizontal: 0,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    minHeight: 48,
  },
  timestampWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 36,
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
  input: {
    flex: 1,
    minHeight: 40,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 4,
  },
  sendingWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
