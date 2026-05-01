/* eslint-disable no-undef */
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, couponId } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Missing priceId' });
    }

    // Detectar origen para URLs de redirección
    const origin = req.headers.origin || 'http://localhost:5174';

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        // Aplicar coupon promocional si se proporciona (ej: 50% off 3 meses)
        ...(couponId ? { coupon: couponId } : {}),
      },
      // Mostrar descuento en la página de Stripe si hay coupon
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=canceled`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message });
  }
}
