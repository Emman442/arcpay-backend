import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IMerchantDocument extends Document {
  name: string
  email: string
  password: string
  walletAddress: string
  apiKey: string
  webhookUrl?: string
  verified?: boolean
  createdAt: Date
  updatedAt: Date
  comparePassword(candidate: string): Promise<boolean>
}

const MerchantSchema = new Schema<IMerchantDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    walletAddress: { type: String, required: true, trim: true },
    apiKey: { type: String, required: true, unique: true },
    webhookUrl: { type: String, default: null },
    verified: {type: Boolean, default: false}
  },
  { timestamps: true }
)

// Hash password before saving
MerchantSchema.pre('save', async function (this: IMerchantDocument) {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

// Instance method to compare passwords at login
MerchantSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password)
}

// Never return password in JSON responses
MerchantSchema.set('toJSON', {
  transform: (_, ret: any) => {
    delete ret?.password
    return ret
  },
})

MerchantSchema.index({ apiKey: 1 })

export default mongoose.model<IMerchantDocument>('Merchant', MerchantSchema)