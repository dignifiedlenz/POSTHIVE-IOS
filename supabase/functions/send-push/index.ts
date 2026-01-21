// Supabase Edge Function: Send Push Notification via APNs
// Deploy with: supabase functions deploy send-push

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

interface PushPayload {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
  notificationType?: string
  badge?: number
  sound?: string
}

interface NotificationPreferences {
  push_enabled: boolean
  push_uploads: boolean
  push_comments: boolean
  push_mentions: boolean
  push_todos: boolean
  push_deliverable_updates: boolean
}

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

// Check if user wants this type of notification
function shouldSendNotification(
  prefs: NotificationPreferences | null, 
  notificationType?: string
): boolean {
  // Default to sending if no preferences set
  if (!prefs) return true
  
  // Master switch
  if (!prefs.push_enabled) return false
  
  // Check specific type
  if (!notificationType) return true
  
  if (notificationType.includes('comment') || notificationType.includes('reply')) {
    return prefs.push_comments
  }
  if (notificationType.includes('mention')) {
    return prefs.push_mentions
  }
  if (notificationType.includes('upload') || notificationType.includes('version') || notificationType.includes('processing')) {
    return prefs.push_uploads
  }
  if (notificationType.includes('transcription') || notificationType.includes('transcribe')) {
    return prefs.push_uploads // Use uploads preference for transcription notifications
  }
  if (notificationType.includes('todo') || notificationType.includes('task')) {
    return prefs.push_todos
  }
  if (notificationType.includes('deliverable') || notificationType.includes('approved') || notificationType.includes('status')) {
    return prefs.push_deliverable_updates
  }
  
  return true
}

// Send push notification to a single device
async function sendToDevice(
  token: string, 
  apnsToken: string, 
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: payload.sound || 'default',
      badge: payload.badge,
      'mutable-content': 1,
    },
    // Custom data for the app
    ...payload.data,
    type: payload.notificationType,
  }

  try {
    const response = await fetch(
      `https://${APNS_HOST}/3/device/${token}`,
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

  try {
    const payload: PushPayload = await req.json()
    
    if (!payload.userId || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user's notification preferences
    const { data: prefs } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', payload.userId)
      .single()

    // Check if user wants this notification type
    if (!shouldSendNotification(prefs, payload.notificationType)) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Notification skipped due to user preferences',
          sent: 0 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get user's active device tokens
    // Only get the most recent token per platform to avoid duplicates
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('token, platform, updated_at')
      .eq('user_id', payload.userId)
      .eq('active', true)
      .order('updated_at', { ascending: false })

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active device tokens found',
          sent: 0 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Deduplicate tokens - only keep the most recent token per platform
    const uniqueTokens = new Map<string, typeof tokens[0]>()
    for (const token of tokens) {
      if (!uniqueTokens.has(token.platform)) {
        uniqueTokens.set(token.platform, token)
      }
    }
    const deduplicatedTokens = Array.from(uniqueTokens.values())

    // Generate APNs token
    const apnsToken = await generateAPNsToken()

    // Send to all iOS devices (now deduplicated)
    const iosTokens = deduplicatedTokens.filter(t => t.platform === 'ios')
    const results = await Promise.all(
      iosTokens.map(t => sendToDevice(t.token, apnsToken, payload))
    )

    // Deactivate invalid tokens
    const invalidTokens = iosTokens.filter((t, i) => 
      !results[i].success && 
      (results[i].error?.includes('BadDeviceToken') || 
       results[i].error?.includes('Unregistered'))
    )

    if (invalidTokens.length > 0) {
      await supabase
        .from('user_push_tokens')
        .update({ active: false })
        .in('token', invalidTokens.map(t => t.token))
    }

    const successCount = results.filter(r => r.success).length

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        total: iosTokens.length,
        errors: results.filter(r => !r.success).map(r => r.error)
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












