// Supabase Edge Function: Process Push Notification Queue
// This function reads pending notifications from the queue and sends them via APNs
// Deploy with: supabase functions deploy process-push-queue
// Set up a cron job to call this every minute

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

// Send push notification to a single device
async function sendToDevice(
  deviceToken: string, 
  apnsToken: string, 
  title: string,
  body: string,
  data?: Record<string, unknown>
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

  try {
    const response = await fetch(
      `https://${APNS_HOST}/3/device/${deviceToken}`,
      {
        method: 'POST',
        headers: {
          'authorization': `bearer ${apnsToken}`,
          'apns-topic': APNS_BUNDLE_ID,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': '0',
          'content-type': 'application/json',
        },
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
    // Get pending notifications from queue (limit to 50 per run)
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('Error fetching queue:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch queue', details: fetchError }),
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
      return new Response(
        JSON.stringify({ error: 'Failed to generate APNs token', details: String(tokenError) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        // Get user's device tokens
        const { data: tokens, error: tokensError } = await supabase
          .from('user_push_tokens')
          .select('token, platform')
          .eq('user_id', notification.user_id)
          .eq('active', true)

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

        // Send to all iOS devices
        const iosTokens = tokens.filter(t => t.platform === 'ios')
        if (iosTokens.length === 0) {
          await supabase
            .from('push_notification_queue')
            .update({ 
              status: 'skipped', 
              error_message: 'No iOS tokens',
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
            notification.data || {}
          ))
        )

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
