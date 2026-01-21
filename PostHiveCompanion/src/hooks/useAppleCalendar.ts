import {useState, useEffect, useCallback, useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppleCalendar,
  AppleCalendarEvent,
  AppleCalendar as AppleCalendarType,
  AuthorizationStatus,
  CreateEventInput,
} from '../lib/AppleCalendarModule';
import {CalendarEvent} from '../lib/types';

// Storage keys
const STORAGE_KEYS = {
  ENABLED: '@apple_calendar_enabled',
  SELECTED_CALENDARS: '@apple_calendar_selected',
  DEFAULT_WRITE_CALENDAR: '@apple_calendar_default_write',
};

interface UseAppleCalendarOptions {
  enabled?: boolean;
  startDate?: Date;
  endDate?: Date;
}

interface UseAppleCalendarReturn {
  // Status
  isEnabled: boolean;
  isLoading: boolean;
  hasAccess: boolean;
  authStatus: AuthorizationStatus;
  
  // Calendars
  calendars: AppleCalendarType[];
  selectedCalendarIds: string[];
  defaultWriteCalendarId: string | null;
  
  // Events
  events: AppleCalendarEvent[];
  
  // Actions
  requestAccess: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setSelectedCalendars: (ids: string[]) => Promise<void>;
  setDefaultWriteCalendar: (id: string) => Promise<void>;
  refreshEvents: () => Promise<void>;
  createEvent: (input: Omit<CreateEventInput, 'calendarId'> & {calendarId?: string}) => Promise<string | null>;
  updateEvent: (eventId: string, updates: Partial<Omit<CreateEventInput, 'calendarId'>>) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  
  // Helpers
  convertToCalendarEvent: (event: AppleCalendarEvent) => CalendarEvent;
}

/**
 * Hook to manage Apple Calendar integration
 */
export function useAppleCalendar({
  enabled: enabledProp,
  startDate,
  endDate,
}: UseAppleCalendarOptions = {}): UseAppleCalendarReturn {
  // State
  const [isEnabled, setIsEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthorizationStatus>('notDetermined');
  const [calendars, setCalendars] = useState<AppleCalendarType[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIdsState] = useState<string[]>([]);
  const [defaultWriteCalendarId, setDefaultWriteCalendarIdState] = useState<string | null>(null);
  const [events, setEvents] = useState<AppleCalendarEvent[]>([]);

  // Load settings from storage
  useEffect(() => {
    async function loadSettings() {
      try {
        const [enabledStr, selectedStr, defaultWriteStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ENABLED),
          AsyncStorage.getItem(STORAGE_KEYS.SELECTED_CALENDARS),
          AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_WRITE_CALENDAR),
        ]);

        if (enabledStr !== null) {
          setIsEnabledState(enabledStr === 'true');
        }
        if (selectedStr !== null) {
          setSelectedCalendarIdsState(JSON.parse(selectedStr));
        }
        if (defaultWriteStr !== null) {
          setDefaultWriteCalendarIdState(defaultWriteStr);
        }
      } catch (error) {
        console.error('Error loading Apple Calendar settings:', error);
      }
    }

    loadSettings();
  }, []);

  // Check authorization status
  useEffect(() => {
    async function checkAuth() {
      const status = await AppleCalendar.getAuthorizationStatus();
      setAuthStatus(status);
      setHasAccess(status === 'authorized' || status === 'fullAccess');
    }

    checkAuth();
  }, []);

  // Track if we've initialized calendars to avoid infinite loops
  const hasInitializedCalendars = useRef(false);

  // Load calendars when enabled and has access
  useEffect(() => {
    async function loadCalendars() {
      if (!isEnabled || !hasAccess) {
        setCalendars([]);
        hasInitializedCalendars.current = false;
        return;
      }

      const cals = await AppleCalendar.getCalendars();
      setCalendars(cals);

      // Only set defaults once on initial load
      if (!hasInitializedCalendars.current && cals.length > 0) {
        hasInitializedCalendars.current = true;
        
        // If no calendars selected, select all writable calendars by default
        const storedSelected = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_CALENDARS);
        if (!storedSelected || JSON.parse(storedSelected).length === 0) {
          const writableIds = cals
            .filter(c => c.allowsModifications && !c.isSubscribed)
            .map(c => c.id);
          setSelectedCalendarIdsState(writableIds);
          await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_CALENDARS, JSON.stringify(writableIds));
        }

        // Set default write calendar if not set
        const storedDefault = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_WRITE_CALENDAR);
        if (!storedDefault) {
          const defaultId = await AppleCalendar.getDefaultCalendarId();
          if (defaultId) {
            setDefaultWriteCalendarIdState(defaultId);
            await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_WRITE_CALENDAR, defaultId);
          }
        }
      }
    }

    loadCalendars();
  }, [isEnabled, hasAccess]);

  // Store selectedCalendarIds in a ref for stable callback
  const selectedCalendarIdsRef = useRef(selectedCalendarIds);
  selectedCalendarIdsRef.current = selectedCalendarIds;

  // Store dates in refs for stable callback - compare by timestamp
  const startDateRef = useRef(startDate);
  const endDateRef = useRef(endDate);
  startDateRef.current = startDate;
  endDateRef.current = endDate;

  // Fetch events
  const refreshEvents = useCallback(async () => {
    const calIds = selectedCalendarIdsRef.current;
    
    if (!isEnabled || !hasAccess || calIds.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Default to today ± 30 days if no dates provided
      const start = startDateRef.current || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDateRef.current || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const fetchedEvents = await AppleCalendar.getEvents(calIds, start, end);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Error fetching Apple Calendar events:', error);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, hasAccess]);

  // Fetch events when dependencies change - use timestamps for date comparison
  const startTimestamp = startDate?.getTime();
  const endTimestamp = endDate?.getTime();

  useEffect(() => {
    if (isEnabled && hasAccess && selectedCalendarIds.length > 0) {
      refreshEvents();
    }
  }, [isEnabled, hasAccess, selectedCalendarIds.length, startTimestamp, endTimestamp, refreshEvents]);

  // Subscribe to calendar changes - debounce to avoid rapid refreshes
  useEffect(() => {
    if (!isEnabled || !hasAccess) return;

    let debounceTimeout: NodeJS.Timeout | null = null;

    const unsubscribe = AppleCalendar.onCalendarChanged(() => {
      // Debounce calendar change events
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        refreshEvents();
      }, 1000);
    });

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      unsubscribe();
    };
  }, [isEnabled, hasAccess, refreshEvents]);

  // Request access
  const requestAccess = useCallback(async (): Promise<boolean> => {
    const granted = await AppleCalendar.requestAccess();
    if (granted) {
      setHasAccess(true);
      setAuthStatus('fullAccess');
      setIsEnabledState(true);
      await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, 'true');
    }
    return granted;
  }, []);

  // Set enabled
  const setEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    setIsEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, enabled.toString());
    
    if (enabled && !hasAccess) {
      await requestAccess();
    }
  }, [hasAccess, requestAccess]);

  // Set selected calendars
  const setSelectedCalendars = useCallback(async (ids: string[]): Promise<void> => {
    setSelectedCalendarIdsState(ids);
    await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_CALENDARS, JSON.stringify(ids));
  }, []);

  // Set default write calendar
  const setDefaultWriteCalendar = useCallback(async (id: string): Promise<void> => {
    setDefaultWriteCalendarIdState(id);
    await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_WRITE_CALENDAR, id);
  }, []);

  // Create event
  const createEvent = useCallback(async (
    input: Omit<CreateEventInput, 'calendarId'> & {calendarId?: string}
  ): Promise<string | null> => {
    const calendarId = input.calendarId || defaultWriteCalendarId;
    if (!calendarId) {
      throw new Error('No calendar selected for creating events');
    }

    const result = await AppleCalendar.createEvent({
      ...input,
      calendarId,
    });

    if (result) {
      await refreshEvents();
      return result.id;
    }
    return null;
  }, [defaultWriteCalendarId, refreshEvents]);

  // Update event
  const updateEvent = useCallback(async (
    eventId: string,
    updates: Partial<Omit<CreateEventInput, 'calendarId'>>
  ): Promise<boolean> => {
    const success = await AppleCalendar.updateEvent({
      eventId,
      ...updates,
    });

    if (success) {
      await refreshEvents();
    }
    return success;
  }, [refreshEvents]);

  // Delete event
  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    const success = await AppleCalendar.deleteEvent(eventId);
    if (success) {
      await refreshEvents();
    }
    return success;
  }, [refreshEvents]);

  // Convert Apple Calendar event to PostHive CalendarEvent format
  const convertToCalendarEvent = useCallback((event: AppleCalendarEvent): CalendarEvent => {
    return {
      id: `apple_${event.id}`,
      workspace_id: '', // Apple Calendar events don't belong to a workspace
      source_type: 'posthive', // Mark as posthive but we'll display differently
      title: event.title,
      description: event.notes || null,
      start_time: event.startDate,
      end_time: event.endDate,
      is_all_day: event.isAllDay,
      location: event.location || null,
      meeting_link: event.url || null,
      calendar_name: event.calendarTitle || null,
      calendar_color: event.calendarColor || null,
      created_by: null,
      project_id: null,
    };
  }, []);

  return {
    isEnabled: enabledProp !== undefined ? enabledProp : isEnabled,
    isLoading,
    hasAccess,
    authStatus,
    calendars,
    selectedCalendarIds,
    defaultWriteCalendarId,
    events,
    requestAccess,
    setEnabled,
    setSelectedCalendars,
    setDefaultWriteCalendar,
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    convertToCalendarEvent,
  };
}

