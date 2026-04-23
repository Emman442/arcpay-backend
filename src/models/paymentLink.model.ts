import mongoose, { Schema, Document } from 'mongoose'
import { IPaymentLink } from '../types/types'

export interface IPaymentLinkDocument extends IPaymentLink, Document {}

const PaymentLinkSchema = new Schema<IPaymentLinkDocument>(
  {
    merchantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true },
    amount: { type: String, required: true },
    description: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['active', 'paid', 'expired'],
      default: 'active',
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.model<IPaymentLinkDocument>('PaymentLink', PaymentLinkSchema)