import { Request, Response } from 'express'
import PaymentLink from '../models/paymentLink.model'
import Order from '../models/order.model'
import Merchant from '../models/merchant.model'
import { watchForPayment } from '../services/arc.service'

function generateSlug(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// POST /api/payment-links
export async function createPaymentLink(req: Request, res: Response): Promise<void> {
  try {
    const { amount, description, expiresInHours } = req.body

    if (!amount || !description) {
      res.status(400).json({ error: 'amount and description are required' })
      return
    }

    const merchant = await Merchant.findById(req.merchantId)
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' })
      return
    }

    const slug = generateSlug()
    const orderId = `ORD-${slug}`
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // default 7 days

    // Create underlying order
    const order = await Order.create({
      merchantId: req.merchantId,
      orderId,
      amount: parseFloat(amount).toFixed(2),
      description,
      memo: `Payment for ${orderId}`,
      merchantWallet: merchant.walletAddress,
      status: 'pending',
      expiresAt,
    })

    // Create payment link
    const link = await PaymentLink.create({
      merchantId: req.merchantId,
      orderId,
      amount: order.amount,
      description,
      slug,
      status: 'active',
      expiresAt,
    })

    watchForPayment(merchant.walletAddress, orderId, order.amount)

    res.status(201).json({
      success: true,
      link: {
        id: link._id,
        slug,
        url: `${process.env.FRONTEND_URL}/pay/${slug}`,
        amount: link.amount,
        description: link.description,
        status: link.status,
        expiresAt: link.expiresAt,
        orderId,
      },
    })
  } catch (err) {
    console.error('[PaymentLinkController] createPaymentLink:', err)
    res.status(500).json({ error: 'Failed to create payment link' })
  }
}

// GET /api/payment-links
export async function listPaymentLinks(req: Request, res: Response): Promise<void> {
  try {
    const links = await PaymentLink.find({ merchantId: req.merchantId }).sort({ createdAt: -1 })

    res.json({
      total: links.length,
      links: links.map(l => ({
        id: l._id,
        slug: l.slug,
        url: `${process.env.FRONTEND_URL}/pay/${l.slug}`,
        amount: l.amount,
        description: l.description,
        status: l.status,
        expiresAt: l.expiresAt,
        // createdAt: l?.createdAt,
      })),
    })
  } catch (err) {
    console.error('[PaymentLinkController] listPaymentLinks:', err)
    res.status(500).json({ error: 'Failed to list payment links' })
  }
}

// GET /api/payment-links/:slug — public
export async function getPaymentLinkBySlug(req: Request, res: Response): Promise<void> {
  try {
    const link = await PaymentLink.findOne({ slug: req.params.slug })

    if (!link) {
      res.status(404).json({ error: 'Payment link not found' })
      return
    }

    if (link.expiresAt && new Date() > link.expiresAt && link.status === 'active') {
      link.status = 'expired'
      await link.save()
    }

    const order = await Order.findOne({ orderId: link.orderId })

    res.json({
      slug: link.slug,
      amount: link.amount,
      description: link.description,
      status: link.status,
      expiresAt: link.expiresAt,
      merchantWallet: order?.merchantWallet,
      memo: order?.memo,
      orderStatus: order?.status,
      txHash: order?.txHash ?? null,
    })
  } catch (err) {
    console.error('[PaymentLinkController] getPaymentLinkBySlug:', err)
    res.status(500).json({ error: 'Failed to fetch payment link' })
  }
}

// DELETE /api/payment-links/:id
export async function deactivatePaymentLink(req: Request, res: Response): Promise<void> {
  try {
    const link = await PaymentLink.findOne({ _id: req.params.id, merchantId: req.merchantId })

    if (!link) {
      res.status(404).json({ error: 'Payment link not found' })
      return
    }

    link.status = 'expired'
    await link.save()

    res.json({ success: true, message: 'Payment link deactivated' })
  } catch (err) {
    console.error('[PaymentLinkController] deactivatePaymentLink:', err)
    res.status(500).json({ error: 'Failed to deactivate link' })
  }
}