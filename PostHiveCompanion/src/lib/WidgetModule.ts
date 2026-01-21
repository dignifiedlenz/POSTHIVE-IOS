/**
 * WidgetModule.ts
 * 
 * React Native bridge for updating iOS Home Screen Widgets
 * 
 * Usage:
 * - Call updateUpcomingItems() whenever todos/events change
 * - Call updateLatestDeliverable() when deliverables change  
 * - Call updateActiveTransfer() during file uploads/downloads
 * - Call clearActiveTransfer() when transfer completes
 */

import {NativeModules, Platform} from 'react-native';

const {WidgetModule: NativeWidgetModule} = NativeModules;

// Types matching the widget data models
export interface UpcomingWidgetItem {
  id: string;
  title: string;
  subtitle?: string;
  time?: string; // ISO8601 date string
  type: 'event' | 'todo';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  color?: string; // Hex color for events
}

export interface DeliverableWidgetData {
  id: string;
  name: string;
  projectName?: string;
  thumbnailUrl?: string;
  unreadCommentCount: number;
  currentVersion?: number;
  updatedAt: string; // ISO8601 date string
}

export interface TransferWidgetData {
  id: string;
  fileName: string;
  progress: number; // 0.0 to 1.0
  bytesTransferred: number;
  totalBytes: number;
  isUpload: boolean;
  startedAt: string; // ISO8601 date string
}

export type ActivityType = 'upload' | 'comment' | 'approval' | 'revision' | 'share' | 'mention' | 'download';

export interface ActivityWidgetItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle?: string;
  timestamp: string; // ISO8601 date string
  thumbnailUrl?: string;
  userName?: string;
}

class WidgetModuleClass {
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = Platform.OS === 'ios' && !!NativeWidgetModule;
  }

  /**
   * Update the upcoming events and todos widget
   * Call this whenever your calendar events or todos change
   */
  updateUpcomingItems(items: UpcomingWidgetItem[]): void {
    if (!this.isAvailable) return;

    try {
      // Transform to native format
      const nativeItems = items.map(item => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        time: item.time,
        type: item.type,
        priority: item.priority,
        color: item.color,
      }));

      NativeWidgetModule.updateUpcomingItems(nativeItems);
    } catch (error) {
      console.warn('WidgetModule: Failed to update upcoming items', error);
    }
  }

  /**
   * Update the latest deliverable widget
   * Call this when a new deliverable is uploaded or comments change
   */
  updateLatestDeliverable(deliverable: DeliverableWidgetData | null): void {
    if (!this.isAvailable) return;

    try {
      if (deliverable) {
        // Build dictionary, omitting undefined/null values to avoid NSNull issues
        const deliverableData: Record<string, any> = {
          id: deliverable.id || '',
          name: deliverable.name || '',
          unreadCommentCount: deliverable.unreadCommentCount || 0,
          updatedAt: deliverable.updatedAt || new Date().toISOString(),
        };
        
        // Only add optional fields if they have values (don't pass null/undefined)
        if (deliverable.projectName != null) {
          deliverableData.projectName = deliverable.projectName;
        }
        if (deliverable.thumbnailUrl != null) {
          deliverableData.thumbnailUrl = deliverable.thumbnailUrl;
        }
        if (deliverable.currentVersion != null && deliverable.currentVersion !== undefined) {
          deliverableData.currentVersion = deliverable.currentVersion;
        }
        
        NativeWidgetModule.updateLatestDeliverable(deliverableData);
      } else {
        // Pass empty dictionary instead of null to avoid NSNull conversion error
        NativeWidgetModule.updateLatestDeliverable({});
      }
    } catch (error) {
      console.warn('WidgetModule: Failed to update deliverable', error);
    }
  }

  /**
   * Update the active transfer widget
   * Call this periodically during uploads/downloads to show progress
   */
  updateActiveTransfer(transfer: TransferWidgetData | null): void {
    if (!this.isAvailable) return;

    try {
      if (transfer) {
        NativeWidgetModule.updateActiveTransfer({
          id: transfer.id,
          fileName: transfer.fileName,
          progress: transfer.progress,
          bytesTransferred: transfer.bytesTransferred,
          totalBytes: transfer.totalBytes,
          isUpload: transfer.isUpload,
          startedAt: transfer.startedAt,
        });
      } else {
        // IMPORTANT: never pass `null` to a method bridged as NSDictionary
        // (it becomes NSNull and crashes with "cannot be converted to NSDictionary")
        NativeWidgetModule.updateActiveTransfer({});
      }
    } catch (error) {
      console.warn('WidgetModule: Failed to update transfer', error);
    }
  }

  /**
   * Clear the active transfer (convenience method)
   * Call this when a transfer completes or is cancelled
   */
  clearActiveTransfer(): void {
    if (!this.isAvailable) return;

    try {
      NativeWidgetModule.clearActiveTransfer();
    } catch (error) {
      console.warn('WidgetModule: Failed to clear transfer', error);
    }
  }

  /**
   * Update the activity feed widget
   * Call this when new activities occur (uploads, comments, approvals, etc.)
   */
  updateActivityFeed(activities: ActivityWidgetItem[]): void {
    if (!this.isAvailable) {
      console.log('[WidgetModule] updateActivityFeed: Native module not available');
      return;
    }

    if (!NativeWidgetModule || typeof NativeWidgetModule.updateActivityFeed !== 'function') {
      console.warn('[WidgetModule] updateActivityFeed: Method not available on native module');
      return;
    }

    try {
      const nativeActivities = activities.map(activity => {
        const nativeActivity: Record<string, any> = {
          id: activity.id || '',
          type: activity.type || 'upload',
          title: activity.title || '',
          timestamp: activity.timestamp || new Date().toISOString(),
        };
        
        // Only add optional fields if they have values (don't pass null/undefined)
        if (activity.subtitle != null) {
          nativeActivity.subtitle = activity.subtitle;
        }
        if (activity.thumbnailUrl != null) {
          nativeActivity.thumbnailUrl = activity.thumbnailUrl;
        }
        if (activity.userName != null) {
          nativeActivity.userName = activity.userName;
        }
        
        return nativeActivity;
      });

      NativeWidgetModule.updateActivityFeed(nativeActivities);
    } catch (error) {
      console.warn('WidgetModule: Failed to update activity feed', error);
    }
  }

  /**
   * Force reload all widgets
   * Useful after login/logout or workspace switch
   */
  reloadAllWidgets(): void {
    if (!this.isAvailable) return;

    try {
      NativeWidgetModule.reloadAllWidgets();
    } catch (error) {
      console.warn('WidgetModule: Failed to reload widgets', error);
    }
  }
}

export const WidgetModule = new WidgetModuleClass();

