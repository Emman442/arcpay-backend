import { IOrderDocument } from '../models/order.model'

export async function notifyMerchantWebhook(
  webhookUrl: string,
  order: IOrderDocument
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'payment.confirmed',
        orderId: order.orderId,
        amount: order.amount,
        txHash: order.txHash,
        paidAt: order.paidAt,
        merchantId: order.merchantId,
      }),
    })
    console.log(`[WebhookService] Merchant notified — Order: ${order.orderId}`)
  } catch (err) {
    console.error(`[WebhookService] Failed to reach merchant webhook:`, err)
  }
}