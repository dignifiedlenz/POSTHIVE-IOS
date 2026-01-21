import React, {useRef, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {LayoutDashboard, Calendar, Folder, User, X} from 'lucide-react-native';
import {theme} from '../theme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(280, SCREEN_WIDTH * 0.75);

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute: string;
}

interface MenuItem {
  label: string;
  route: string;
  icon: React.ComponentType<{size: number; color: string}>;
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    route: 'DashboardTab',
    icon: LayoutDashboard,
  },
  {
    label: 'Calendar',
    route: 'CalendarTab',
    icon: Calendar,
  },
  {
    label: 'Projects',
    route: 'ReviewTab',
    icon: Folder,
  },
  {
    label: 'Profile',
    route: 'ProfileTab',
    icon: User,
  },
];

export function SidebarMenu({isOpen, onClose, currentRoute}: SidebarMenuProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, overlayOpacity]);

  const handleMenuItemPress = (route: string) => {
    navigation.navigate(route as never);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayOpacity,
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{translateX: slideAnim}],
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Menu</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <X size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuItems}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.route;

            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => handleMenuItemPress(item.route)}
                activeOpacity={0.7}>
                <Icon
                  size={24}
                  color={isActive ? theme.colors.textPrimary : theme.colors.textMuted}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    isActive && styles.menuItemTextActive,
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: theme.colors.background,
    zIndex: 9999,
    elevation: 9999,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  menuItems: {
    paddingTop: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  menuItemActive: {
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.textPrimary,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItemTextActive: {
    color: theme.colors.textPrimary,
  },
});

