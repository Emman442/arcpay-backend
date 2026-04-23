import mongoose, { Schema, Document } from 'mongoose'
import { IOrder, OrderStatus } from '../types/types'

export interface IOrderDocument extends IOrder, Document {}

const OrderSchema = new Schema<IOrderDocument>(
  {
    merchantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, unique: true },
    amount: { type: String, required: true },
    description: { type: String, required: true },
    memo: { type: String, required: true },
    merchantWallet: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'expired', 'refunded'],
      default: 'pending',
      index: true,
    },
    txHash: { type: String, default: null },
    paidAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// Compound index — used when matching incoming payments
// to pending orders by wallet + amount
OrderSchema.index({ merchantWallet: 1, status: 1, amount: 1 })

export default mongoose.model<IOrderDocument>('Order', OrderSchema)