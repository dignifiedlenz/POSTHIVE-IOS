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

/** Workspace editor role: no org-wide notification center / feed. */
export function canAccessWorkspaceNotifications(
  role: string | null | undefined,
): boolean {
  return role !== 'editor';
}

export function isWorkspaceViewer(role: string | null | undefined): boolean {
  return role === 'viewer';
}

export function isWorkspaceEditor(role: string | null | undefined): boolean {
  return role === 'editor';
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
  /** Pre-derived asset thumbnail URL (e.g. from Cloudflare/Bunny Stream playback URL). */
  asset_bunny_thumbnail_url?: string;
  asset_provider?: string;
  version_thumbnail_url?: string;
  version_file_url?: string;
  asset_bunny_cdn_url?: string;
  asset_file_url?: string;
  asset_playback_url?: string | null;
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

  // Priority 3: Pre-derived asset thumbnail (caller already resolved from playback_url)
  if (sources.asset_bunny_thumbnail_url) {
    return sources.asset_bunny_thumbnail_url;
  }

  // Priority 3.5: Cloudflare Stream thumbnail derived from playback_url
  if (sources.asset_playback_url?.includes('videodelivery.net') ||
      sources.asset_playback_url?.includes('cloudflarestream.com')) {
    const uidMatch = sources.asset_playback_url.match(
      /(?:videodelivery\.net|cloudflarestream\.com)\/([a-zA-Z0-9_-]+)/,
    );
    if (uidMatch) {
      return `https://videodelivery.net/${uidMatch[1]}/thumbnails/thumbnail.jpg?time=5s`;
    }
  }

  // Priority 4: Bunny Stream thumbnail derived from playback_url
  if (sources.asset_playback_url?.includes('.b-cdn.net')) {
    const guid = extractBunnyGuid(sources.asset_playback_url);
    if (guid) {
      return constructBunnyThumbnail(guid, sources.asset_playback_url);
    }
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

  // Priority 7: CDN fallback
  if (sources.asset_bunny_cdn_url) {
    return sources.asset_bunny_cdn_url;
  }

  // Priority 8: For images, use the file itself
  if (sources.deliverable_type === 'image' && sources.asset_file_url) {
    return sources.asset_file_url;
  }

  return undefined;
}

// ===== ASSET THUMBNAIL (for assets table - no bunny_thumbnail_url column) =====

export interface AssetThumbnailSources {
  type?: string;
  mime_type?: string;
  bunny_cdn_url?: string | null;
  playback_url?: string | null;
  storage_url?: string | null;
}

/**
 * Derive thumbnail URL for an asset (bunny_thumbnail_url column was dropped).
 * Videos: derive from playback_url. Images: use bunny_cdn_url or storage_url.
 */
export function resolveAssetThumbnail(sources: AssetThumbnailSources): string | undefined {
  const isVideo =
    sources.type === 'video' ||
    (sources.mime_type || '').startsWith('video/');

  if (!isVideo) {
    return sources.bunny_cdn_url || sources.storage_url || undefined;
  }

  const playback = sources.playback_url;
  if (playback) {
    if (playback.includes('videodelivery.net')) {
      const uidMatch = playback.match(/videodelivery\.net\/([a-zA-Z0-9_-]+)/);
      if (uidMatch) {
        return `https://videodelivery.net/${uidMatch[1]}/thumbnails/thumbnail.jpg?time=5s`;
      }
    }
    if (playback.includes('.b-cdn.net') || /[0-9a-f-]{36}/i.test(playback)) {
      const guidMatch = playback.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (guidMatch) {
        const region = extractBunnyRegion(playback) || DEFAULT_BUNNY_REGION;
        return `https://${region}.b-cdn.net/${guidMatch[1]}/thumbnail.jpg`;
      }
    }
  }

  return sources.bunny_cdn_url || sources.storage_url || undefined;
}

// ===== PLAYBACK URL RESOLUTION =====

export interface PlaybackSources {
  /** Cloudflare Stream / Bunny Stream HLS manifest URL stored on the asset row. */
  playback_url?: string | null;
  /** Storage backend identifier — e.g. 'cloudflare', 'bunny', 'b2', 'r2'. */
  provider?: string | null;
  bunny_cdn_url?: string | null;
  storage_url?: string | null;
  file_url?: string | null;
  processing_status?: string | null;
}

/**
 * Resolves the URL the video player should stream.
 *
 * Priority (mirrors the web app's HLS-first behaviour for streamed assets):
 *   1. `playback_url` — Cloudflare Stream / Bunny Stream HLS manifest. This is what we want
 *      for any asset that has been transcoded and is hosted on a streaming CDN.
 *   2. Direct CDN / storage files (Bunny CDN MP4, B2 storage, raw upload) as fallbacks
 *      for assets that haven't been transcoded yet.
 *
 * NOTE: do NOT return a raw B2 / Backblaze storage URL when a `playback_url` exists —
 * those are huge originals (often 5K masters) and will choke the mobile player.
 */
export function resolvePlaybackUrl(sources: PlaybackSources): string | undefined {
  if (sources.playback_url) return sources.playback_url;

  // For Cloudflare-provider assets without a playback_url yet, the file is still processing.
  // Don't fall back to the raw storage_url (multi-GB master) — let the caller surface a
  // "still processing" state instead.
  if (sources.provider !== 'cloudflare') {
    if (sources.bunny_cdn_url) return sources.bunny_cdn_url;
    if (sources.storage_url) return sources.storage_url;
    if (sources.file_url) return sources.file_url;
  } else {
    // Cloudflare path: only fall back to a small Bunny CDN MP4 if one happens to exist.
    if (sources.bunny_cdn_url) return sources.bunny_cdn_url;
  }
  return undefined;
}

// ===== VERSION NUMBER DISPLAY =====

export function formatVersionNumber(versionNumber: number): string {
  if (versionNumber >= 100) return 'FINAL';
  return `V${versionNumber}`;
}

