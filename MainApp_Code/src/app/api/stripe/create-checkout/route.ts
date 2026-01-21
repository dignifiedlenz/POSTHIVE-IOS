import { NextResponse } from 'next/server';
import { getSession } from '@/lib/actions/auth';
import { stripe, getPriceIdForTier, TIER_FEATURES } from '@/lib/stripe/config';
import type { WorkspaceTier } from '@/lib/stripe/config';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceName, workspaceSlug, tier, isUpgrade, workspaceId } = await request.json();

    // Debug logging
    console.log('Creating checkout session with:', {
      workspaceName,
      workspaceSlug,
      tier,
      isUpgrade,
      workspaceId,
      priceId: getPriceIdForTier(tier as WorkspaceTier),
    });

    // Validate input
    if (!workspaceName || !workspaceSlug || !tier) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get price ID for the selected tier
    const priceId = getPriceIdForTier(tier as WorkspaceTier);
    
    // Free tier doesn't need a checkout session
    if (!priceId) {
      return NextResponse.json({ 
        free: true,
        workspaceName,
        workspaceSlug,
        tier 
      });
    }

    // Determine cancel URL based on context
    const cancelUrl = isUpgrade && workspaceId 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/${workspaceSlug}/settings?tab=billing`
      : `${process.env.NEXT_PUBLIC_APP_URL}/create-workspace`;

    // Prepare checkout session options with dark mode
    const checkoutOptions: any = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      // Enable Stripe's built-in coupon functionality
      allow_promotion_codes: true,
      // Terms of Service acceptance
      consent_collection: {
        terms_of_service: 'required',
      },
      // Custom text for better UX
      custom_text: {
        submit: {
          message: 'Your subscription will start immediately after payment.',
        },
        terms_of_service_acceptance: {
          message: `I agree to the [Terms of Service](${process.env.NEXT_PUBLIC_APP_URL}/legal/terms) and [Privacy Policy](${process.env.NEXT_PUBLIC_APP_URL}/legal/privacy).`,
        },
      },
      metadata: {
        workspaceName,
        workspaceSlug,
        tier,
        userId: session.user.id,
        workspace_name: workspaceName,
        workspace_id: workspaceId || '',
        ...(isUpgrade && { isUpgrade: 'true', workspaceId }),
      },
    };

    console.log('Creating Stripe checkout session with options:', checkoutOptions);

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create(checkoutOptions);

    console.log('Checkout session created successfully:', checkoutSession.id);
    return NextResponse.json({ sessionId: checkoutSession.id });
  } catch (error) {
    console.error('Error in create-checkout:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 