import {
  formatDistanceToNow,
  format,
  isToday,
  isTomorrow,
  isPast,
} from 'date-fns';
import {theme} from '../theme';

/**
 * Capitalizes the first letter of a string
 * @param str - The string to capitalize
 * @returns The string with the first letter capitalized
 */
export function capitalizeFirst(str: string): string {
  if (!str || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatTimeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), {addSuffix: true});
}

export function formatDueDate(date: string): string {
  const d = new Date(date);
  if (isToday(d)) {
    return 'Today';
  }
  if (isTomorrow(d)) {
    return 'Tomorrow';
  }
  return format(d, 'MMM d');
}

export function getDueDateColor(date: string): string {
  const d = new Date(date);
  if (isPast(d) && !isToday(d)) {
    return theme.colors.error;
  }
  if (isToday(d)) {
    return theme.colors.warning;
  }
  return theme.colors.textMuted;
}

export function formatVideoTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return theme.colors.priorityUrgent;
    case 'high':
      return theme.colors.priorityHigh;
    case 'medium':
      return theme.colors.priorityMedium;
    case 'low':
      return theme.colors.priorityLow;
    default:
      return theme.colors.textMuted;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return theme.colors.statusPending;
    case 'in_progress':
      return theme.colors.statusInProgress;
    case 'completed':
      return theme.colors.statusCompleted;
    case 'draft':
      return theme.colors.statusDraft;
    case 'review':
      return theme.colors.statusReview;
    case 'approved':
      return theme.colors.statusApproved;
    case 'final':
      return theme.colors.statusFinal;
    default:
      return theme.colors.textMuted;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ===== THUMBNAIL RESOLUTION =====
// Based on MOBILE_APP_PROJECT_THUMBNAILS.md - priority order for thumbnail sources

// Default Bunny CDN region - can be overridden if detected from URL
const DEFAULT_BUNNY_REGION = 'vz-da54705d-e92';  // Try the library ID format

// Regex to detect Bunny Stream video GUIDs (36 char UUID format)
const BUNNY_GUID_REGEX = /^[0-9a-f-]{36}$/i;

// Try to extract region from a Bunny CDN URL
function extractBunnyRegion(url: string): string | undefined {
  // Pattern: https://vz-{library-id}.b-cdn.net/...
  const vzMatch = url.match(/https?:\/\/(vz-[^.]+)\.b-cdn\.net/i);
  if (vzMatch) return vzMatch[1];
  
  // Pattern: https://{region}.b-cdn.net/...
  const regionMatch = url.match(/https?:\/\/([^.]+)\.b-cdn\.net/i);
  if (regionMatch) return regionMatch[1];
  
  return undefined;
}

// Store detected region for reuse
let detectedBunnyRegion: string | undefined;

/**
 * Extract Bunny GUID from a file URL
 * The URL might BE the GUID, or contain it in the path
 */
export function extractBunnyGuid(fileUrl: string): string | undefined {
  if (!fileUrl) return undefined;
  
  // Check if file_url IS the GUID
  if (BUNNY_GUID_REGEX.test(fileUrl)) {
    console.log('[GUID Extract] file_url IS a GUID:', fileUrl);
    return fileUrl;
  }
  
  // Check if file_url contains a GUID in the path
  // Patterns: 
  // - https://nyc.b-cdn.net/{guid}/play.mp4
  // - https://vz-{id}.b-cdn.net/{guid}/play.mp4
  // - https://iframe.mediadelivery.net/play/{library-id}/{guid}
  
  // Try to find any UUID pattern in the URL
  const uuidMatch = fileUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) {
    console.log('[GUID Extract] Found GUID in URL:', uuidMatch[1], 'from:', fileUrl);
    return uuidMatch[1];
  }
  
  console.log('[GUID Extract] No GUID found in:', fileUrl);
  return undefined;
}

/**
 * Construct a Bunny thumbnail URL from a GUID
 * Optionally pass the source URL to detect the correct region
 */
export function constructBunnyThumbnail(guid: string, sourceUrl?: string): string {
  let region = detectedBunnyRegion;
  
  // Try to detect region from source URL
  if (sourceUrl) {
    const detected = extractBunnyRegion(sourceUrl);
    if (detected) {
      region = detected;
      detectedBunnyRegion = detected; // Cache for future use
      console.log('[Bunny Thumbnail] Detected region:', region, 'from:', sourceUrl);
    }
  }
  
  // Use detected region or default
  const finalRegion = region || DEFAULT_BUNNY_REGION;
  const thumbUrl = `https://${finalRegion}.b-cdn.net/${guid}/thumbnail.jpg`;
  console.log('[Bunny Thumbnail] Constructed:', thumbUrl);
  return thumbUrl;
}

export interface ThumbnailSources {
  deliverable_thumbnail_url?: string;
  deliverable_thumbnail?: string;
  asset_bunny_thumbnail_url?: string;
  asset_bunny_stream_video_id?: string;
  asset_bunny_hls_url?: string;
  asset_provider?: string;
  version_thumbnail_url?: string;
  version_file_url?: string;  // NEW: Can extract GUID from this
  asset_bunny_cdn_url?: string;
  asset_r2_url?: string;
  asset_file_url?: string;
  deliverable_type?: string;
}

export function resolveThumbnail(sources: ThumbnailSources): string | undefined {
  // Priority 1: Custom ET thumbnail (deliverable.thumbnail) - highest priority
  if (sources.deliverable_thumbnail) {
    return sources.deliverable_thumbnail;
  }
  // Priority 2: Resolved deliverable thumbnail URL (from database function)
  if (sources.deliverable_thumbnail_url) {
    return sources.deliverable_thumbnail_url;
  }
  
  // Priority 3: Bunny Stream thumbnail from asset
  if (sources.asset_bunny_thumbnail_url) {
    return sources.asset_bunny_thumbnail_url;
  }
  
  // Priority 4: Construct from Bunny video ID (from asset) for legacy Bunny assets only
  if (sources.asset_bunny_stream_video_id && sources.asset_provider !== 'cloudflare' && !sources.asset_bunny_hls_url?.includes('videodelivery.net')) {
    return constructBunnyThumbnail(sources.asset_bunny_stream_video_id, sources.version_file_url);
  }
  
  // Priority 5: Extract GUID from version.file_url and construct thumbnail
  if (sources.version_file_url) {
    const guid = extractBunnyGuid(sources.version_file_url);
    if (guid) {
      return constructBunnyThumbnail(guid, sources.version_file_url);
    }
  }
  
  // Priority 6: Version thumbnail (direct)
  if (sources.version_thumbnail_url) {
    return sources.version_thumbnail_url;
  }
  
  // Priority 7-8: CDN/Storage fallbacks
  if (sources.asset_bunny_cdn_url) {
    return sources.asset_bunny_cdn_url;
  }
  if (sources.asset_r2_url) {
    return sources.asset_r2_url;
  }
  
  // Priority 9: For images, use the file itself
  if (sources.deliverable_type === 'image' && sources.asset_file_url) {
    return sources.asset_file_url;
  }
  
  return undefined;
}

// ===== PLAYBACK URL RESOLUTION =====

export interface PlaybackSources {
  bunny_hls_url?: string;
  bunny_cdn_url?: string;
  storage_url?: string;
  r2_url?: string;
  file_url?: string;
  processing_status?: string;
}

export function resolvePlaybackUrl(sources: PlaybackSources): string | undefined {
  // Only use HLS if processing is complete
  if (sources.processing_status === 'ready' && sources.bunny_hls_url) {
    return sources.bunny_hls_url;
  }
  
  // CDN URL for direct playback
  if (sources.bunny_cdn_url) return sources.bunny_cdn_url;
  if (sources.storage_url) return sources.storage_url;
  if (sources.r2_url) return sources.r2_url;
  if (sources.file_url) return sources.file_url;
  
  return undefined;
}

// ===== VERSION NUMBER DISPLAY =====

export function formatVersionNumber(versionNumber: number): string {
  if (versionNumber >= 100) return 'FINAL';
  return `V${versionNumber}`;
}

