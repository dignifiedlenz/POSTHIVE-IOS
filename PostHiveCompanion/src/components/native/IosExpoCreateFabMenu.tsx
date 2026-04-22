import React, {useMemo} from 'react';
import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {Host, Menu, Button, Divider, Image} from '@expo/ui/swift-ui';
import {buttonStyle, frame} from '@expo/ui/swift-ui/modifiers';
import {requireNativeModule} from 'expo';
import type {CreationMenuAction} from './AppleNativeCreateGlassMenu';

const FAB_SIZE = 52;

let expoUiModulePresent: boolean | undefined;

/** True when the ExpoUI native module is linked (Expo Modules + @expo/ui). */
export function isExpoUIMenuAvailable(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  if (expoUiModulePresent !== undefined) {
    return expoUiModulePresent;
  }
  try {
    requireNativeModule('ExpoUI');
    expoUiModulePresent = true;
  } catch {
    expoUiModulePresent = false;
  }
  return expoUiModulePresent;
}

export type IosExpoCreateFabMenuProps = {
  /** Same square size as the legacy FAB (default 52). */
  size?: number;
  onSelect: (action: CreationMenuAction) => void;
  /** Optional: start hands-free voice (e.g. from menu row). */
  onVoiceCommand?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * iOS: system SwiftUI `Menu` with Liquid Glass trigger via Expo UI — real UIMenu, not a custom overlay.
 */
export function IosExpoCreateFabMenu({
  size = FAB_SIZE,
  onSelect,
  onVoiceCommand,
  style,
}: IosExpoCreateFabMenuProps) {
  // Force the menu trigger to render as a fixed-size circular glass button:
  // - `buttonStyle('glass')` -> Liquid Glass material trigger
  // - `frame({width, height})` -> locks the trigger to a square so the glass
  //   capsule renders as a perfect circle (no "Create" text → no pill stretch).
  const glassMods = useMemo(
    () => [frame({width: size, height: size}), buttonStyle('glass')],
    [size],
  );

  return (
    <View style={[{width: size, height: size}, styles.clip, style]} pointerEvents="box-none">
      <Host matchContents style={{width: size, height: size}}>
        <Menu
          label={<Image systemName="plus" size={22} color="white" />}
          modifiers={glassMods}>
          <Button
            label="Task"
            systemImage="checkmark.circle"
            onPress={() => onSelect('task')}
          />
          <Button label="Event" systemImage="calendar" onPress={() => onSelect('event')} />
          <Button
            label="Project"
            systemImage="folder.badge.plus"
            onPress={() => onSelect('project')}
          />
          <Button
            label="Deliverable"
            systemImage="square.stack.3d.up.fill"
            onPress={() => onSelect('deliverable')}
          />
          {onVoiceCommand ? (
            <>
              <Divider />
              <Button label="Voice command" systemImage="mic" onPress={onVoiceCommand} />
            </>
          ) : null}
        </Menu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
