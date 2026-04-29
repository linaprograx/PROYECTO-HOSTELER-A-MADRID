/* eslint-disable no-undef */
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const sig = req.headers['stripe-signature'];
    const body = await buffer(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Manejar eventos
    switch (event.type) {
      case 'checkout.session.completed': {
        // La suscripción ha sido creada (en trial o activa)
        const checkoutSession = event.data.object;
        console.log('Checkout session completed:', checkoutSession.id);
        // Aquí guardaríamos en base de datos si la tuviéramos
        break;
      }

      case 'customer.subscription.updated': {
        // Cambios en la suscripción (trial terminado, etc)
        const subscription = event.data.object;
        console.log('Subscription updated:', subscription.id, subscription.status);
        break;
      }

      case 'customer.subscription.deleted': {
        // Suscripción cancelada
        const deletedSub = event.data.object;
        console.log('Subscription deleted:', deletedSub.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
}
