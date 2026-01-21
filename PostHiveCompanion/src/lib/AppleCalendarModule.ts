import {NativeModules, Platform, NativeEventEmitter} from 'react-native';

const {AppleCalendarModule} = NativeModules;

// Event emitter for calendar change notifications
const CalendarEmitter = Platform.OS === 'ios' && AppleCalendarModule
  ? new NativeEventEmitter(AppleCalendarModule)
  : null;

// Debug mode
const DEBUG = false;

const logDebug = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('📆 [AppleCalendar]', ...args);
  }
};

const logError = (...args: unknown[]) => {
  console.error('🔴 [AppleCalendar ERROR]', ...args);
};

// Verify module is available
if (!AppleCalendarModule && Platform.OS === 'ios') {
  console.warn('AppleCalendarModule native module not found. Make sure AppleCalendarModule.swift is added to the Xcode project.');
} else if (Platform.OS === 'ios') {
  logDebug('Native module loaded successfully');
}

// Types
export type AuthorizationStatus = 
  | 'notDetermined'
  | 'restricted'
  | 'denied'
  | 'authorized'
  | 'fullAccess'
  | 'writeOnly'
  | 'unknown';

export interface AppleCalendar {
  id: string;
  title: string;
  color: string;
  type: 'local' | 'calDAV' | 'exchange' | 'subscription' | 'birthday' | 'unknown';
  source: string;
  allowsModifications: boolean;
  isSubscribed: boolean;
  isImmutable: boolean;
}

export interface AppleCalendarEvent {
  id: string;
  title: string;
  notes: string;
  location: string;
  startDate: string;  // ISO string
  endDate: string;    // ISO string
  isAllDay: boolean;
  calendarId: string;
  calendarTitle: string;
  calendarColor: string;
  url: string;
  hasRecurrenceRules: boolean;
  availability: string;
  organizer: string;
}

export interface CreateEventInput {
  calendarId: string;
  title: string;
  notes?: string;
  location?: string;
  startDate: string;  // ISO string
  endDate: string;    // ISO string
  isAllDay?: boolean;
}

export interface UpdateEventInput {
  eventId: string;
  title?: string;
  notes?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isAllDay?: boolean;
}

class AppleCalendarModuleClass {
  /**
   * Get current authorization status
   */
  async getAuthorizationStatus(): Promise<AuthorizationStatus> {
    if (Platform.OS !== 'ios') {
      return 'notDetermined';
    }
    
    if (!AppleCalendarModule) {
      logError('Native module not found');
      return 'notDetermined';
    }
    
    try {
      return await AppleCalendarModule.getAuthorizationStatus();
    } catch (error) {
      logError('Error getting authorization status:', error);
      return 'notDetermined';
    }
  }

  /**
   * Request calendar access
   */
  async requestAccess(): Promise<boolean> {
    logDebug('Requesting calendar access...');
    
    if (Platform.OS !== 'ios') {
      return false;
    }
    
    if (!AppleCalendarModule) {
      logError('Native module not found');
      return false;
    }
    
    try {
      const granted = await AppleCalendarModule.requestAccess();
      logDebug('Access granted:', granted);
      return granted;
    } catch (error) {
      logError('Error requesting access:', error);
      return false;
    }
  }

  /**
   * Check if we have calendar access (authorized or fullAccess)
   */
  async hasAccess(): Promise<boolean> {
    const status = await this.getAuthorizationStatus();
    return status === 'authorized' || status === 'fullAccess';
  }

  /**
   * Get all available calendars
   */
  async getCalendars(): Promise<AppleCalendar[]> {
    logDebug('Getting calendars...');
    
    if (Platform.OS !== 'ios') {
      return [];
    }
    
    if (!AppleCalendarModule) {
      logError('Native module not found');
      return [];
    }
    
    try {
      const calendars = await AppleCalendarModule.getCalendars();
      logDebug('Found', calendars.length, 'calendars');
      return calendars;
    } catch (error) {
      logError('Error getting calendars:', error);
      return [];
    }
  }

  /**
   * Get the default calendar ID for new events
   */
  async getDefaultCalendarId(): Promise<string | null> {
    if (Platform.OS !== 'ios' || !AppleCalendarModule) {
      return null;
    }
    
    try {
      return await AppleCalendarModule.getDefaultCalendarId();
    } catch (error) {
      logError('Error getting default calendar:', error);
      return null;
    }
  }

  /**
   * Get events from specified calendars within date range
   */
  async getEvents(
    calendarIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<AppleCalendarEvent[]> {
    logDebug('Getting events from', calendarIds.length || 'all', 'calendars');
    logDebug('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    if (Platform.OS !== 'ios') {
      return [];
    }
    
    if (!AppleCalendarModule) {
      logError('Native module not found');
      return [];
    }
    
    try {
      const events = await AppleCalendarModule.getEvents(
        calendarIds,
        startDate.toISOString(),
        endDate.toISOString(),
      );
      logDebug('Found', events.length, 'events');
      return events;
    } catch (error) {
      logError('Error getting events:', error);
      return [];
    }
  }

  /**
   * Create a new event in the specified calendar
   */
  async createEvent(input: CreateEventInput): Promise<{id: string; title: string} | null> {
    logDebug('Creating event:', input.title);
    
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Calendar is only available on iOS');
    }
    
    if (!AppleCalendarModule) {
      throw new Error('AppleCalendarModule not available');
    }
    
    try {
      const result = await AppleCalendarModule.createEvent(
        input.calendarId,
        input.title,
        input.notes || null,
        input.location || null,
        input.startDate,
        input.endDate,
        input.isAllDay || false,
      );
      logDebug('✅ Event created:', result.id);
      return result;
    } catch (error) {
      logError('Failed to create event:', error);
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(input: UpdateEventInput): Promise<boolean> {
    logDebug('Updating event:', input.eventId);
    
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Calendar is only available on iOS');
    }
    
    if (!AppleCalendarModule) {
      throw new Error('AppleCalendarModule not available');
    }
    
    try {
      const result = await AppleCalendarModule.updateEvent(
        input.eventId,
        input.title || null,
        input.notes || null,
        input.location || null,
        input.startDate || null,
        input.endDate || null,
        input.isAllDay !== undefined ? input.isAllDay : null,
      );
      logDebug('✅ Event updated');
      return result;
    } catch (error) {
      logError('Failed to update event:', error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    logDebug('Deleting event:', eventId);
    
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Calendar is only available on iOS');
    }
    
    if (!AppleCalendarModule) {
      throw new Error('AppleCalendarModule not available');
    }
    
    try {
      const result = await AppleCalendarModule.deleteEvent(eventId);
      logDebug('✅ Event deleted');
      return result;
    } catch (error) {
      logError('Failed to delete event:', error);
      throw error;
    }
  }

  /**
   * Subscribe to calendar change events
   */
  onCalendarChanged(callback: () => void): () => void {
    if (!CalendarEmitter) {
      console.warn('Calendar event emitter not available');
      return () => {};
    }
    
    logDebug('Subscribing to calendar changes');
    const subscription = CalendarEmitter.addListener('onCalendarChanged', callback);
    return () => {
      logDebug('Unsubscribing from calendar changes');
      subscription.remove();
    };
  }
}

export const AppleCalendar = new AppleCalendarModuleClass();

