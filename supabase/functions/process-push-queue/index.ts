// Supabase Edge Function: Process Push Notification Queue
// This function atomically claims pending notifications from the queue and sends them via APNs.
// Uses claim_pending_notifications() RPC with FOR UPDATE SKIP LOCKED to prevent concurrent
// invocations from processing the same rows (the trigger fires FOR EACH ROW).
// Deploy with: supabase functions deploy process-push-queue

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v4.14.4/index.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')!
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')!
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')!
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID')!

// Use sandbox for development, production for App Store builds
const APNS_HOST = Deno.env.get('APNS_PRODUCTION') === 'true' 
  ? 'api.push.apple.com' 
  : 'api.sandbox.push.apple.com'

// Generate APNs JWT token
async function generateAPNsToken(): Promise<string> {
  const privateKey = await importPKCS8(APNS_PRIVATE_KEY, 'ES256')
  
  const token = await new SignJWT({})
    .setProtectedHeader({ 
      alg: 'ES256', 
      kid: APNS_KEY_ID,
      typ: 'JWT'
    })
    .setIssuer(APNS_TEAM_ID)
    .setIssuedAt()
    .sign(privateKey)
  
  return token
}

// Build a collapse ID from notification data so APNs deduplicates on the device.
// Notifications for the same event (e.g. same version upload) sent to different users
// but arriving on the same physical device will collapse into one.
function buildCollapseId(notificationType?: string, data?: Record<string, unknown>): string | null {
  if (!notificationType || !data) return null
  
  // Use the most specific ID available per notification type
  if (data.version_id) return `${notificationType}_${data.version_id}`
  if (data.comment_id) return `${notificationType}_${data.comment_id}`
  if (data.todo_id) return `${notificationType}_${data.todo_id}`
  if (data.deliverable_id) return `${notificationType}_${data.deliverable_id}`
  if (data.transfer_session_id) return `${notificationType}_${data.transfer_session_id}`
  
  return null
}

// Send push notification to a single device
async function sendToDevice(
  deviceToken: string, 
  apnsToken: string, 
  title: string,
  body: string,
  data?: Record<string, unknown>,
  collapseId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const apnsPayload = {
    aps: {
      alert: {
        title,
        body,
      },
      sound: 'default',
      'mutable-content': 1,
    },
    ...data,
  }

  const headers: Record<string, string> = {
    'authorization': `bearer ${apnsToken}`,
    'apns-topic': APNS_BUNDLE_ID,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-expiration': '0',
    'content-type': 'application/json',
  }

  // Collapse ID tells APNs to replace older notifications with the same ID on the device.
  // This prevents 5 "New Upload" banners when 5 workspace members share a device.
  if (collapseId) {
    headers['apns-collapse-id'] = collapseId.substring(0, 64) // APNs limit: 64 bytes
  }

  try {
    const response = await fetch(
      `https://${APNS_HOST}/3/device/${deviceToken}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(apnsPayload),
      }
    )

    if (response.status === 200) {
      return { success: true }
    } else {
      const errorBody = await response.text()
      console.error('APNs error:', response.status, errorBody)
      return { success: false, error: `${response.status}: ${errorBody}` }
    }
  } catch (error) {
    console.error('Send error:', error)
    return { success: false, error: String(error) }
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Atomically claim pending notifications using FOR UPDATE SKIP LOCKED.
    // This prevents concurrent invocations (caused by the FOR EACH ROW trigger)
    // from processing the same notifications.
    const { data: pendingNotifications, error: fetchError } = await supabase
      .rpc('claim_pending_notifications', { p_limit: 50 })

    if (fetchError) {
      console.error('Error claiming from queue:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to claim from queue', details: fetchError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending notifications', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingNotifications.length} notifications`)

    // Generate APNs token once for all notifications
    let apnsToken: string
    try {
      apnsToken = await generateAPNsToken()
    } catch (tokenError) {
      console.error('Failed to generate APNs token:', tokenError)
      // Reset claimed notifications back to pending so they can be retried
      const claimedIds = pendingNotifications.map((n: { id: string }) => n.id)
      await supabase
        .from('push_notification_queue')
        .update({ status: 'pending' })
        .in('id', claimedIds)
      return new Response(
        JSON.stringify({ error: 'Failed to generate APNs token', details: String(tokenError) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // Track device tokens we've already sent to in this batch.
    // This prevents the same physical device from receiving multiple pushes
    // when multiple workspace members share a device (same APNs token registered
    // under different user accounts).
    const sentDeviceTokens = new Set<string>()

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        // Build collapse ID for this notification type
        const collapseId = buildCollapseId(notification.notification_type, notification.data)

        // Get user's device tokens (ordered by most recently updated)
        const { data: tokens, error: tokensError } = await supabase
          .from('user_push_tokens')
          .select('token, platform, updated_at')
          .eq('user_id', notification.user_id)
          .eq('active', true)
          .order('updated_at', { ascending: false })

        if (tokensError || !tokens || tokens.length === 0) {
          // No tokens - mark as skipped
          await supabase
            .from('push_notification_queue')
            .update({ 
              status: 'skipped', 
              error_message: 'No active device tokens',
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id)
          skippedCount++
          continue
        }

        // Deduplicate tokens - only keep the most recent token per platform
        const uniqueTokens = new Map<string, typeof tokens[0]>()
        for (const token of tokens) {
          if (!uniqueTokens.has(token.platform)) {
            uniqueTokens.set(token.platform, token)
          }
        }
        const deduplicatedTokens = Array.from(uniqueTokens.values())

        // Send to iOS devices only (deduplicated to most recent token per platform)
        let iosTokens = deduplicatedTokens.filter(t => t.platform === 'ios')

        // Skip device tokens we've already sent to in this batch
        // (handles multiple users sharing the same physical device)
        iosTokens = iosTokens.filter(t => {
          const key = collapseId ? `${t.token}:${collapseId}` : t.token
          if (sentDeviceTokens.has(key)) {
            console.log(`Skipping already-sent token for user ${notification.user_id} (same device, same event)`)
            return false
          }
          return true
        })

        if (iosTokens.length === 0) {
          await supabase
            .from('push_notification_queue')
            .update({ 
              status: 'skipped', 
              error_message: 'No iOS tokens (or already sent to device)',
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id)
          skippedCount++
          continue
        }

        // Send notification
        const results = await Promise.all(
          iosTokens.map(t => sendToDevice(
            t.token, 
            apnsToken, 
            notification.title,
            notification.body,
            notification.data || {},
            collapseId
          ))
        )

        // Track tokens we successfully sent to
        iosTokens.forEach((t, i) => {
          if (results[i].success) {
            const key = collapseId ? `${t.token}:${collapseId}` : t.token
            sentDeviceTokens.add(key)
          }
        })

        const successCount = results.filter(r => r.success).length
        const failedResults = results.filter(r => !r.success)

        if (successCount > 0) {
          // Mark as sent
          await supabase
            .from('push_notification_queue')
            .update({ 
              status: 'sent', 
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id)
          sentCount++
        } else {
          // All failed
          const errorMsg = failedResults.map(r => r.error).join('; ')
          await supabase
            .from('push_notification_queue')
            .update({ 
              status: 'failed', 
              error_message: errorMsg,
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id)
          failedCount++
          errors.push(`${notification.id}: ${errorMsg}`)
        }

        // Deactivate invalid tokens
        const invalidTokenIndices = results
          .map((r, i) => r.error?.includes('BadDeviceToken') || r.error?.includes('Unregistered') ? i : -1)
          .filter(i => i !== -1)
        
        if (invalidTokenIndices.length > 0) {
          const invalidTokens = invalidTokenIndices.map(i => iosTokens[i].token)
          await supabase
            .from('user_push_tokens')
            .update({ active: false })
            .in('token', invalidTokens)
        }

      } catch (notifError) {
        console.error(`Error processing notification ${notification.id}:`, notifError)
        await supabase
          .from('push_notification_queue')
          .update({ 
            status: 'failed', 
            error_message: String(notifError),
            processed_at: new Date().toISOString()
          })
          .eq('id', notification.id)
        failedCount++
        errors.push(`${notification.id}: ${String(notifError)}`)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: pendingNotifications.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Handler error:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
