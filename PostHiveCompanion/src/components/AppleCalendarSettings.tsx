import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import {
  Calendar,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Clock,
  MapPin,
  Video,
  Import,
  CheckCircle2,
} from 'lucide-react-native';
import {format, isToday, isTomorrow, parseISO} from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {theme} from '../theme';
import {useAppleCalendar} from '../hooks/useAppleCalendar';
import {AppleCalendar as AppleCalendarType, AppleCalendarEvent} from '../lib/AppleCalendarModule';
import {useAuth} from '../hooks/useAuth';
import {createEvent} from '../lib/api';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const IMPORTED_EVENTS_KEY = '@apple_calendar_imported_events';

interface AppleCalendarSettingsProps {
  onClose?: () => void;
}

export function AppleCalendarSettings({onClose}: AppleCalendarSettingsProps) {
  const {currentWorkspace} = useAuth();
  const {
    isEnabled,
    isLoading,
    hasAccess,
    authStatus,
    calendars,
    selectedCalendarIds,
    events,
    requestAccess,
    setEnabled,
    setSelectedCalendars,
    refreshEvents,
  } = useAppleCalendar();

  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [importedEventIds, setImportedEventIds] = useState<Set<string>>(new Set());
  const [importingEventId, setImportingEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'import'>('settings');

  // Load imported event IDs from storage
  useEffect(() => {
    async function loadImported() {
      try {
        const stored = await AsyncStorage.getItem(IMPORTED_EVENTS_KEY);
        if (stored) {
          setImportedEventIds(new Set(JSON.parse(stored)));
        }
      } catch (e) {
        console.error('Error loading imported events:', e);
      }
    }
    loadImported();
  }, []);

  // Save imported event ID
  const markAsImported = useCallback(async (eventId: string) => {
    const newSet = new Set(importedEventIds);
    newSet.add(eventId);
    setImportedEventIds(newSet);
    await AsyncStorage.setItem(IMPORTED_EVENTS_KEY, JSON.stringify([...newSet]));
  }, [importedEventIds]);

  const openAppSettings = () => {
    Linking.openURL('app-settings:');
  };

  const handleToggle = async (value: boolean) => {
    if (value && !hasAccess) {
      const granted = await requestAccess();
      if (!granted) {
        Alert.alert(
          'Calendar Access Required',
          'Please enable calendar access in Settings to import events from Apple Calendar.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Open Settings', onPress: openAppSettings},
          ],
        );
        return;
      }
    }
    await setEnabled(value);
  };

  const handleCalendarToggle = async (calendarId: string, isSelected: boolean) => {
    if (isSelected) {
      await setSelectedCalendars([...selectedCalendarIds, calendarId]);
    } else {
      await setSelectedCalendars(selectedCalendarIds.filter(id => id !== calendarId));
    }
  };

  // Import event to PostHive
  const handleImportEvent = async (event: AppleCalendarEvent) => {
    if (!currentWorkspace?.id) {
      Alert.alert('Error', 'No workspace selected');
      return;
    }

    setImportingEventId(event.id);
    try {
      // Detect meeting link (Google Meet, Zoom, etc.)
      let meetingLink = event.url || null;
      if (!meetingLink) {
        // Check notes/location for meeting links
        const meetRegex = /(https?:\/\/(meet\.google\.com|zoom\.us|teams\.microsoft\.com)[^\s]+)/gi;
        const notesMatch = event.notes?.match(meetRegex);
        const locationMatch = event.location?.match(meetRegex);
        meetingLink = notesMatch?.[0] || locationMatch?.[0] || null;
      }

      await createEvent(currentWorkspace.id, {
        title: event.title,
        description: event.notes || null,
        start_time: event.startDate,
        end_time: event.endDate,
        is_all_day: event.isAllDay,
        location: event.location || null,
        meeting_link: meetingLink,
      });

      await markAsImported(event.id);
      Alert.alert('Success', `"${event.title}" imported to PostHive`);
    } catch (error: any) {
      console.error('Error importing event:', error);
      Alert.alert('Error', error.message || 'Failed to import event');
    } finally {
      setImportingEventId(null);
    }
  };

  // Filter to only show new (non-imported) events
  const newEvents = events.filter(e => !importedEventIds.has(e.id));

  // Group events by date
  const groupedEvents = newEvents.reduce((acc, event) => {
    const dateKey = format(parseISO(event.startDate), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, AppleCalendarEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  const formatEventTime = (startDate: string, endDate: string, isAllDay: boolean) => {
    if (isAllDay) return 'All day';
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
  };

  const renderAuthStatus = () => {
    if (authStatus === 'denied' || authStatus === 'restricted') {
      return (
        <View style={styles.warningBanner}>
          <AlertCircle size={18} color={theme.colors.error} />
          <Text style={styles.warningText}>
            Calendar access is {authStatus}. Please enable it in Settings.
          </Text>
          <TouchableOpacity style={styles.settingsButton} onPress={openAppSettings}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const renderSettingsTab = () => (
    <>
      {/* Enable Toggle */}
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Apple Calendar</Text>
            <Text style={styles.settingDescription}>
              Import events from your iOS calendars to PostHive
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{false: '#333', true: theme.colors.primaryMuted}}
            thumbColor={isEnabled ? theme.colors.primary : '#666'}
          />
        </View>
      </View>

      {isEnabled && hasAccess && (
        <>
          {/* Calendar Selection */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setShowCalendarPicker(!showCalendarPicker)}>
              <View>
                <Text style={styles.sectionTitle}>Calendars to Import From</Text>
                <Text style={styles.sectionDescription}>
                  {selectedCalendarIds.length} calendar{selectedCalendarIds.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
              {showCalendarPicker ? (
                <ChevronDown size={20} color={theme.colors.textMuted} />
              ) : (
                <ChevronRight size={20} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>

            {showCalendarPicker && (
              <View style={styles.calendarList}>
                {isLoading ? (
                  <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
                ) : (
                  calendars.map(calendar => (
                    <TouchableOpacity
                      key={calendar.id}
                      style={styles.calendarItem}
                      onPress={() =>
                        handleCalendarToggle(
                          calendar.id,
                          !selectedCalendarIds.includes(calendar.id),
                        )
                      }>
                      <View style={[styles.calendarColor, {backgroundColor: calendar.color}]} />
                      <View style={styles.calendarInfo}>
                        <Text style={styles.calendarName}>{calendar.title}</Text>
                        <Text style={styles.calendarSource}>
                          {calendar.source}
                          {calendar.isSubscribed && ' • Subscribed'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          selectedCalendarIds.includes(calendar.id) && styles.checkboxSelected,
                        ]}>
                        {selectedCalendarIds.includes(calendar.id) && (
                          <Check size={14} color="#fff" strokeWidth={3} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Refresh */}
          <TouchableOpacity style={styles.refreshButton} onPress={refreshEvents}>
            <RefreshCw size={18} color={theme.colors.primary} />
            <Text style={styles.refreshText}>Refresh Events</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  const renderImportTab = () => (
    <>
      {!isEnabled || !hasAccess ? (
        <View style={styles.emptyState}>
          <Calendar size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Enable Apple Calendar</Text>
          <Text style={styles.emptyDescription}>
            Go to Settings tab and enable Apple Calendar to import events
          </Text>
        </View>
      ) : newEvents.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle2 size={48} color={theme.colors.success} />
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptyDescription}>
            No new events to import. All events from selected calendars have been imported.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={refreshEvents}>
            <RefreshCw size={18} color={theme.colors.primary} />
            <Text style={styles.refreshText}>Check for New Events</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.importHeader}>
            {newEvents.length} new event{newEvents.length !== 1 ? 's' : ''} to import
          </Text>

          {sortedDates.map(dateKey => (
            <View key={dateKey} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{formatDateHeader(dateKey)}</Text>
              
              {groupedEvents[dateKey].map(event => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={[styles.eventColorBar, {backgroundColor: event.calendarColor}]} />
                  
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    
                    <View style={styles.eventMeta}>
                      <Clock size={12} color={theme.colors.textMuted} />
                      <Text style={styles.eventMetaText}>
                        {formatEventTime(event.startDate, event.endDate, event.isAllDay)}
                      </Text>
                    </View>

                    {event.location && (
                      <View style={styles.eventMeta}>
                        <MapPin size={12} color={theme.colors.textMuted} />
                        <Text style={styles.eventMetaText} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </View>
                    )}

                    {(event.url || event.notes?.includes('meet.google.com') || event.notes?.includes('zoom.us')) && (
                      <View style={styles.eventMeta}>
                        <Video size={12} color={theme.colors.primary} />
                        <Text style={[styles.eventMetaText, {color: theme.colors.primary}]}>
                          Has meeting link
                        </Text>
                      </View>
                    )}

                    <Text style={styles.calendarTag}>{event.calendarTitle}</Text>
                  </View>

                  <View style={styles.eventActions}>
                    <TouchableOpacity
                      style={styles.importButton}
                      onPress={() => handleImportEvent(event)}
                      disabled={importingEventId === event.id}>
                      {importingEventId === event.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Import size={16} color="#fff" />
                          <Text style={styles.importButtonText}>Import</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={() => markAsImported(event.id)}>
                      <X size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'import' && styles.tabActive]}
          onPress={() => setActiveTab('import')}>
          <Text style={[styles.tabText, activeTab === 'import' && styles.tabTextActive]}>
            Import Events
          </Text>
          {newEvents.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{newEvents.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
        {renderAuthStatus()}
        {activeTab === 'settings' ? renderSettingsTab() : renderImportTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorBackground,
    padding: 12,
    borderRadius: 0,
    marginBottom: 20,
    gap: 10,
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.error,
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.error,
    borderRadius: 0,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceElevated,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceElevated,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  sectionDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  loader: {
    marginVertical: 20,
  },
  calendarList: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.colors.border,
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  calendarColor: {
    width: 14,
    height: 14,
    borderRadius: 0,
    marginRight: 12,
  },
  calendarInfo: {
    flex: 1,
  },
  calendarName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  calendarSource: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primaryMuted,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginTop: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  // Import tab styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  importHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 12,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    flex: 1,
  },
  calendarTag: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventActions: {
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
