import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import Merchant from '../models/merchant.model'

declare global {
  namespace Express {
    interface Request {
      merchantId?: string
      merchantWallet?: string
    }
  }
}

// -----------------------------------------------------------
// JWT middleware — protects dashboard routes
// Usage: Authorization: Bearer <jwt_token>
// -----------------------------------------------------------
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated. Please log in.' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string }

    const merchant = await Merchant.findById(decoded.id)
    if (!merchant) {
      res.status(401).json({ error: 'Account no longer exists' })
      return
    }

    req.merchantId = merchant._id.toString()
    req.merchantWallet = merchant.walletAddress

    next()
  } catch (err) {
    res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}

// -----------------------------------------------------------
// API Key middleware — protects developer plugin routes
// Usage: Authorization: Bearer arcpay_<api_key>
// This is separate from JWT — used by external developers
// embedding the ArcPay button in their own apps
// -----------------------------------------------------------
export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing API key. Use: Authorization: Bearer <api_key>' })
    return
  }

  const apiKey = authHeader.split(' ')[1]

  const merchant = await Merchant.findOne({ apiKey })
  if (!merchant) {
    res.status(401).json({ error: 'Invalid API key' })
    return
  }

  req.merchantId = merchant._id.toString()
  req.merchantWallet = merchant.walletAddress

  next()
}