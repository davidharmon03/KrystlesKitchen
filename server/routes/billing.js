const express = require('express')
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY || '')
const { getDb } = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// GET /api/billing/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const db = await getDb()
    const user = await db.get(
      'SELECT plan, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?',
      req.user.id
    )
    res.json({
      plan:                   user.plan || 'free',
      stripe_customer_id:     user.stripe_customer_id || null,
      stripe_subscription_id: user.stripe_subscription_id || null,
    })
  } catch (err) {
    console.error('[billing] status error:', err)
    res.status(500).json({ error: 'Failed to fetch billing status' })
  }
})

// POST /api/billing/create-checkout  — redirect to Stripe Checkout
router.post('/create-checkout', authMiddleware, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing not configured' })
  }
  try {
    const db   = await getDb()
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id)

    let customerId = user.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name })
      customerId = customer.id
      await db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, req.user.id])
    }

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ['card'],
      line_items: [{
        price:    process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      mode:        'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?success=true`,
      cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing] checkout error:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// POST /api/billing/portal  — redirect to Stripe Billing Portal
router.post('/portal', authMiddleware, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing not configured' })
  }
  try {
    const db   = await getDb()
    const user = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', req.user.id)

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing] portal error:', err)
    res.status(500).json({ error: 'Failed to open billing portal' })
  }
})

// ── Webhook handler (exported separately — needs raw body, mounted before express.json()) ──
async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature']

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('[billing] STRIPE_WEBHOOK_SECRET not set — skipping webhook verification')
    return res.json({ received: true })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[billing] Webhook signature error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    const db = await getDb()

    if (event.type === 'checkout.session.completed') {
      const session        = event.data.object
      const customerId     = session.customer
      const subscriptionId = session.subscription
      await db.run(
        'UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE stripe_customer_id = ?',
        ['pro', subscriptionId, customerId]
      )
      console.log('[billing] Upgraded to pro:', customerId)
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      await db.run(
        'UPDATE users SET plan = ?, stripe_subscription_id = NULL WHERE stripe_customer_id = ?',
        ['free', sub.customer]
      )
      console.log('[billing] Subscription cancelled:', sub.customer)
    }

    if (event.type === 'customer.subscription.updated') {
      const sub  = event.data.object
      const plan = sub.status === 'active' ? 'pro' : 'free'
      await db.run(
        'UPDATE users SET plan = ? WHERE stripe_customer_id = ?',
        [plan, sub.customer]
      )
      console.log('[billing] Subscription updated:', sub.customer, '->', plan)
    }
  } catch (err) {
    console.error('[billing] Webhook DB error:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  res.json({ received: true })
}

module.exports = { router, webhookHandler }
