import {useEffect, useRef, useCallback} from 'react';
import {LiveActivity, LiveActivityEvent} from '../lib/LiveActivityModule';
import {CalendarEvent} from '../lib/types';

// Debug mode - set to false for production
const DEBUG = false;
const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('📅 [useEventLiveActivity]', ...args);
  }
};

// Constants
const MINUTES_BEFORE_EVENT = 30; // Show activity 30 min before
const CHECK_INTERVAL_MS = 60000; // Check every 60 seconds (was 30, reduce load)

interface UseEventLiveActivityOptions {
  events: CalendarEvent[];
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface ActiveEventActivity {
  eventId: string;
  isUpcoming: boolean;
  startTime: Date;
  endTime: Date;
}

/**
 * Hook to manage Live Activities for calendar events
 * 
 * Automatically shows Live Activity 30 minutes before an event,
 * transitions to "in progress" when event starts,
 * and ends when the event is over.
 */
export function useEventLiveActivity({
  events,
  enabled = true,
  onError,
}: UseEventLiveActivityOptions) {
  const isAvailableRef = useRef<boolean | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeEventRef = useRef<ActiveEventActivity | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Check availability on mount
  useEffect(() => {
    log('Hook mounted, checking availability...');
    LiveActivity.isAvailable().then(available => {
      isAvailableRef.current = available;
      log('Availability result:', available);
    });
  }, []);

  // Get calendar color - default to blue if not available
  const getEventColor = useCallback((event: CalendarEvent): string => {
    return event.calendar_color || '#3B82F6';
  }, []);

  // Start Live Activity for an event
  const startEventActivity = useCallback(
    async (event: CalendarEvent, isUpcoming: boolean) => {
      log('Starting event activity:', event.title, 'isUpcoming:', isUpcoming);
      
      if (!isAvailableRef.current) {
        log('⚠️ Live Activities not available');
        return;
      }

      try {
        const startTime = new Date(event.start_time);
        const endTime = new Date(event.end_time);
        
        const activityEvent: LiveActivityEvent = {
          id: event.id,
          title: event.title,
          location: event.location || undefined,
          calendarColor: getEventColor(event),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isUpcoming,
        };

        await LiveActivity.startEventActivity(activityEvent);
        
        activeEventRef.current = {
          eventId: event.id,
          isUpcoming,
          startTime,
          endTime,
        };
        
        log('✅ Event activity started');
      } catch (error) {
        log('❌ Failed to start event activity:', error);
        onError?.(error as Error);
      }
    },
    [getEventColor, onError],
  );

  // Update Live Activity
  const updateEventActivity = useCallback(
    async (eventId: string, isUpcoming: boolean, targetTime: Date) => {
      if (!isAvailableRef.current) return;

      try {
        const now = Date.now();
        const remainingSeconds = Math.max(0, Math.floor((targetTime.getTime() - now) / 1000));
        await LiveActivity.updateEventActivity(eventId, remainingSeconds, isUpcoming);
      } catch (error) {
        // Silent fail for updates
      }
    },
    [],
  );

  // End Live Activity
  const endEventActivity = useCallback(
    async (eventId: string) => {
      log('Ending event activity:', eventId);
      
      if (!isAvailableRef.current) return;

      try {
        await LiveActivity.endEventActivity(eventId);
        if (activeEventRef.current?.eventId === eventId) {
          activeEventRef.current = null;
        }
        log('✅ Event activity ended');
      } catch (error) {
        log('❌ Failed to end event activity:', error);
        onError?.(error as Error);
      }
    },
    [onError],
  );

  // Find the next relevant event (within 30 min or currently happening)
  const findRelevantEvent = useCallback((): { event: CalendarEvent; isUpcoming: boolean } | null => {
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + MINUTES_BEFORE_EVENT * 60 * 1000);
    const currentEvents = eventsRef.current;

    // Sort events by start time
    const sortedEvents = [...currentEvents].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    for (const event of sortedEvents) {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);

      // Check if event is currently happening
      if (now >= startTime && now < endTime) {
        return { event, isUpcoming: false };
      }

      // Check if event starts within the threshold (30 min)
      if (startTime > now && startTime <= thresholdTime) {
        return { event, isUpcoming: true };
      }
    }

    return null;
  }, []); // No deps - uses ref

  // Main check function - runs periodically
  const checkAndManageActivity = useCallback(async () => {
    if (!enabled || !isAvailableRef.current) return;

    log('Checking for relevant events...');
    const relevantEvent = findRelevantEvent();
    const currentActive = activeEventRef.current;

    // No relevant event - end any active activity
    if (!relevantEvent) {
      if (currentActive) {
        log('No relevant event, ending current activity');
        await endEventActivity(currentActive.eventId);
      }
      return;
    }

    const { event, isUpcoming } = relevantEvent;

    // Different event - switch activities
    if (currentActive && currentActive.eventId !== event.id) {
      log('Different event, switching activities');
      await endEventActivity(currentActive.eventId);
      await startEventActivity(event, isUpcoming);
      return;
    }

    // Same event but status changed (upcoming -> in progress)
    if (currentActive && currentActive.eventId === event.id && currentActive.isUpcoming !== isUpcoming) {
      log('Event status changed, updating activity');
      activeEventRef.current = {
        ...currentActive,
        isUpcoming,
      };
      const targetTime = isUpcoming ? new Date(event.start_time) : new Date(event.end_time);
      await updateEventActivity(event.id, isUpcoming, targetTime);
      return;
    }

    // No active event - start new one
    if (!currentActive) {
      log('Starting new event activity');
      await startEventActivity(event, isUpcoming);
    }
  }, [enabled, findRelevantEvent, endEventActivity, startEventActivity, updateEventActivity]);

  // Set up periodic check - only depends on enabled
  useEffect(() => {
    if (!enabled) return;

    // Initial check with delay to avoid mount spam
    const initialTimeout = setTimeout(() => {
      checkAndManageActivity();
    }, 1000);

    // Set up interval for periodic checks
    checkIntervalRef.current = setInterval(() => {
      checkAndManageActivity();
    }, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [enabled]); // Only re-run when enabled changes, not when checkAndManageActivity changes

  // Set up second-by-second updates - only when there's an active event
  useEffect(() => {
    if (!enabled) return;

    // Only set up if Live Activities are available
    if (!isAvailableRef.current) return;

    // Check if we have an active event by doing initial check
    const setupUpdateInterval = () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      if (activeEventRef.current) {
        updateIntervalRef.current = setInterval(() => {
          const active = activeEventRef.current;
          if (active) {
            const targetTime = active.isUpcoming ? active.startTime : active.endTime;
            updateEventActivity(active.eventId, active.isUpcoming, targetTime);
          } else {
            // No active event, clear interval
            if (updateIntervalRef.current) {
              clearInterval(updateIntervalRef.current);
              updateIntervalRef.current = null;
            }
          }
        }, 1000);
      }
    };

    // Set up after a short delay
    const timeout = setTimeout(setupUpdateInterval, 2000);

    return () => {
      clearTimeout(timeout);
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [enabled]); // Only depends on enabled

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeEventRef.current) {
        endEventActivity(activeEventRef.current.eventId).catch(() => {});
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []); // Empty deps - only on unmount

  return {
    startEventActivity,
    endEventActivity,
    isAvailable: isAvailableRef.current ?? false,
  };
}
