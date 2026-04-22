import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  requireNativeComponent,
  type HostComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {theme} from '../../theme';

const NATIVE_VIEW_NAME = 'AppleNativeCreateGlassMenu';

export type CreationMenuAction = 'task' | 'event' | 'project' | 'deliverable';

type NativeProps = {
  visible?: boolean;
  collapsable?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  onDismiss?: (e: {nativeEvent: Record<string, unknown>}) => void;
  onSelect?: (e: {nativeEvent: {action?: string}}) => void;
  style?: StyleProp<ViewStyle>;
};

const ROWS: {action: CreationMenuAction; title: string; subtitle: string}[] = [
  {action: 'task', title: 'Task', subtitle: 'To-do item'},
  {action: 'event', title: 'Event', subtitle: 'Milestone or meeting'},
  {action: 'project', title: 'Project', subtitle: 'New creative project'},
  {action: 'deliverable', title: 'Deliverable', subtitle: 'Content for review'},
];

type GlobalWithCreateMenuHost = typeof globalThis & {
  __PostHiveAppleNativeCreateGlassMenu?: HostComponent<NativeProps>;
};

/**
 * `requireNativeComponent` registers globally by name; calling it again (e.g. after Fast Refresh
 * or when the module re-evaluates) throws. Persist the host on globalThis so we only register once.
 */
function getIosNativeHost(): HostComponent<NativeProps> | null {
  const g = globalThis as GlobalWithCreateMenuHost;
  const existing = g.__PostHiveAppleNativeCreateGlassMenu;
  if (existing != null) {
    return existing;
  }
  if (Platform.OS !== 'ios' || UIManager.getViewManagerConfig(NATIVE_VIEW_NAME) == null) {
    return null;
  }
  const Comp = requireNativeComponent<NativeProps>(NATIVE_VIEW_NAME);
  g.__PostHiveAppleNativeCreateGlassMenu = Comp;
  return Comp;
}

export function isAppleNativeCreateGlassMenuAvailable(): boolean {
  return Platform.OS === 'ios' && getIosNativeHost() != null;
}

export type AppleNativeCreateGlassMenuProps = {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (action: CreationMenuAction) => void;
  style?: StyleProp<ViewStyle>;
};

export function AppleNativeCreateGlassMenu({
  visible,
  onDismiss,
  onSelect,
  style,
}: AppleNativeCreateGlassMenuProps) {
  const NativeHost = Platform.OS === 'ios' ? getIosNativeHost() : null;

  const pick = (action: CreationMenuAction) => {
    onSelect(action);
  };

  if (NativeHost) {
    return (
      <NativeHost
        collapsable={false}
        visible={visible}
        // RN hit-testing can still target this view when the native UIView disables touches;
        // keep JS layer from eating presses when the menu is dismissed.
        pointerEvents={visible ? 'auto' : 'none'}
        onDismiss={onDismiss ? () => onDismiss() : undefined}
        onSelect={
          onSelect
            ? e => {
                const a = e.nativeEvent?.action;
                if (a === 'task' || a === 'event' || a === 'project' || a === 'deliverable') {
                  onSelect(a);
                }
              }
            : undefined
        }
        style={style}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          {ROWS.map((row, i) => (
            <React.Fragment key={row.action}>
              <Pressable
                style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => pick(row.action)}
                accessibilityRole="button"
                accessibilityLabel={`Create ${row.title}`}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              {i < ROWS.length - 1 ? <View style={styles.divider} /> : null}
            </React.Fragment>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sheet: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceHover,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.divider,
    marginLeft: 18,
  },
});
