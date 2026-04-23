export type OrderStatus = 'pending' | 'paid' | 'expired' | 'refunded'
export type LinkStatus = 'active' | 'paid' | 'expired'

export interface IOrder {
  merchantId: string
  orderId: string
  amount: string
  description: string
  memo: string
  merchantWallet: string
  status: OrderStatus
  txHash?: string
  paidAt?: Date
  expiresAt: Date
}

export interface IMerchant {
  name: string
  email: string
  walletAddress: string
  apiKey: string
  webhookUrl?: string
}

export interface IPaymentLink {
  merchantId: string
  orderId: string
  amount: string
  description: string
  slug: string
  status: LinkStatus
  expiresAt?: Date
}

export interface WebhookPayload {
  subscriptionId: string
  notificationId: string
  notificationType: string
  notification: {
    contractAddress: string
    blockchain: string
    txHash: string
    blockHeight: number
    eventSignature: string
    eventSignatureHash: string
    topics: string[]
    data: string
    firstConfirmDate: string
  }
  timestamp: string
  version: number
}