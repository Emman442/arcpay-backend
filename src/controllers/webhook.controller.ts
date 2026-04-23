import { Request, Response } from 'express'
import Order from '../models/order.model'
import Merchant from '../models/merchant.model'
import { notifyMerchantWebhook } from '../services/webhook.service'
import { WebhookPayload } from '../types/types'

const TRANSFER_EVENT_HASH =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// POST /api/webhook/circle
// Receives real-time Transfer notifications from Circle event monitors
export async function handleCircleWebhook(req: Request, res: Response): Promise<void> {
  // Acknowledge immediately — Circle expects a fast 200
  res.status(200).json({ received: true })

  try {
    const body: WebhookPayload =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    if (body.notificationType !== 'contracts.eventLog') return
    if (body.notification.eventSignatureHash !== TRANSFER_EVENT_HASH) return

    const { txHash, topics, data } = body.notification

    // topics[2] = padded 'to' address → strip padding to get plain address
    const toAddress = '0x' + topics[2].slice(-40)

    // data = raw USDC amount in hex (6 decimals)
    const humanAmount = (Number(BigInt(data)) / 1e6).toFixed(2)

    console.log(`[Webhook] Transfer — To: ${toAddress}, Amount: ${humanAmount} USDC, Tx: ${txHash}`)

    // Find a pending order matching this wallet + amount
    const order = await Order.findOneAndUpdate(
      {
        merchantWallet: toAddress.toLowerCase(),
        amount: humanAmount,
        status: 'pending',
      },
      { status: 'paid', txHash, paidAt: new Date() },
      { new: true }
    )

    if (!order) {
      console.warn(`[Webhook] No matching pending order for wallet ${toAddress}, amount ${humanAmount}`)
      return
    }

    console.log(`[Webhook] Order ${order.orderId} marked as PAID`)

    const merchant = await Merchant.findById(order.merchantId)
    if (merchant?.webhookUrl) {
      await notifyMerchantWebhook(merchant.webhookUrl, order)
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', err)
  }
}

// POST /api/webhook/test — dev only, simulate a payment
export async function testWebhook(req: Request, res: Response): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not available in production' })
    return
  }

  try {
    const { orderId, txHash = '0xTEST_HASH' } = req.body

    if (!orderId) {
      res.status(400).json({ error: 'orderId is required' })
      return
    }

    const order = await Order.findOneAndUpdate(
      { orderId, status: 'pending' },
      { status: 'paid', txHash, paidAt: new Date() },
      { new: true }
    )

    if (!order) {
      res.status(404).json({ error: 'Pending order not found' })
      return
    }

    const merchant = await Merchant.findById(order.merchantId)
    if (merchant?.webhookUrl) {
      await notifyMerchantWebhook(merchant.webhookUrl, order)
    }

    res.json({ success: true, order })
  } catch (err) {
    console.error('[Webhook] testWebhook error:', err)
    res.status(500).json({ error: 'Test webhook failed' })
  }
}