import { Request, Response } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import Merchant from '../models/merchant.model'
import { getWalletBalance } from '../services/arc.service'



function generateToken(merchantId: string): string {
  const secret = process.env.JWT_SECRET
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'

  if (!secret) throw new Error('JWT_SECRET is not defined')

  return jwt.sign({ id: merchantId }, secret, { expiresIn } as jwt.SignOptions)
}

// -----------------------------------------------------------
// POST /api/merchants/register
// New: accepts password, hashes it via model pre-save hook,
// returns JWT so merchant is logged in immediately
// -----------------------------------------------------------
export async function registerMerchant(req: Request, res: Response): Promise<void> {
  
  try {
    const { name, email, password, walletAddress, webhookUrl } = req.body

    if (!name || !email || !password || !walletAddress) {
      res.status(400).json({ error: 'name, email, password, and walletAddress are required' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }

    const existing = await Merchant.findOne({ email })
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' })
      return
    }

    const apiKey = `arcpay_${crypto.randomBytes(24).toString('hex')}`

    // Password is hashed automatically by the pre-save hook on the model
    const merchant = await Merchant.create({
      name,
      email,
      password,
      walletAddress,
      apiKey,
      webhookUrl: webhookUrl || null,
    })

    const token = generateToken(merchant._id.toString())

    res.status(201).json({
      success: true,
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        walletAddress: merchant.walletAddress,
        apiKey: merchant.apiKey, // only returned once on registration
      },
      message: 'Save your API key — it will not be shown again',
    })
  } catch (err) {
    console.error('[MerchantController] registerMerchant:', err)
    res.status(500).json({ error: 'Failed to register merchant' })
  }
}

// -----------------------------------------------------------
// POST /api/merchants/login
// Email + password → JWT
// -----------------------------------------------------------
export async function loginMerchant(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }

    // Explicitly select password since toJSON strips it
    const merchant = await Merchant.findOne({ email }).select('+password')

    if (!merchant) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const isMatch = await merchant.comparePassword(password)
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = generateToken(merchant._id.toString())

    res.json({
      success: true,
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        walletAddress: merchant.walletAddress,
      },
    })
  } catch (err) {
    console.error('[MerchantController] loginMerchant:', err)
    res.status(500).json({ error: 'Login failed' })
  }
}

// -----------------------------------------------------------
// GET /api/merchants/me
// Requires JWT. Returns profile + live wallet balance.
// -----------------------------------------------------------
export async function getMerchantProfile(req: Request, res: Response): Promise<void> {
  try {
    const merchant = await Merchant.findById(req.merchantId)
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' })
      return
    }

    let walletBalance = '0.00'
    try {
      walletBalance = await getWalletBalance(merchant.walletAddress)
    } catch {
      console.warn('[MerchantController] Could not fetch wallet balance')
    }

    res.json({
      id: merchant._id,
      name: merchant.name,
      email: merchant.email,
      walletAddress: merchant.walletAddress,
      webhookUrl: merchant.webhookUrl ?? null,
      walletBalance,
    })
  } catch (err) {
    console.error('[MerchantController] getMerchantProfile:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
}

// -----------------------------------------------------------
// PATCH /api/merchants/me
// Requires JWT. Update name, wallet address, webhook URL.
// Changing password handled separately via /change-password.
// -----------------------------------------------------------
export async function updateMerchantProfile(req: Request, res: Response): Promise<void> {
  try {
    const { name, webhookUrl, walletAddress } = req.body

    const merchant = await Merchant.findByIdAndUpdate(
      req.merchantId,
      {
        ...(name && { name }),
        ...(webhookUrl !== undefined && { webhookUrl }),
        ...(walletAddress && { walletAddress }),
      },
      { new: true }
    )

    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' })
      return
    }

    res.json({ success: true, merchant })
  } catch (err) {
    console.error('[MerchantController] updateMerchantProfile:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
}

// -----------------------------------------------------------
// POST /api/merchants/me/change-password
// Requires JWT + current password confirmation
// -----------------------------------------------------------
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required' })
      return
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' })
      return
    }

    const merchant = await Merchant.findById(req.merchantId).select('+password')
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' })
      return
    }

    const isMatch = await merchant.comparePassword(currentPassword)
    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }

    merchant.password = newPassword // pre-save hook re-hashes it
    await merchant.save()

    res.json({ success: true, message: 'Password updated successfully' })
  } catch (err) {
    console.error('[MerchantController] changePassword:', err)
    res.status(500).json({ error: 'Failed to change password' })
  }
}

// -----------------------------------------------------------
// POST /api/merchants/me/rotate-key
// Requires JWT. Generates a new API key for the plugin.
// -----------------------------------------------------------
export async function rotateApiKey(req: Request, res: Response): Promise<void> {
  try {
    const newApiKey = `arcpay_${crypto.randomBytes(24).toString('hex')}`

    await Merchant.findByIdAndUpdate(req.merchantId, { apiKey: newApiKey })

    res.json({
      success: true,
      apiKey: newApiKey,
      message: 'Old API key invalidated. Save the new one securely.',
    })
  } catch (err) {
    console.error('[MerchantController] rotateApiKey:', err)
    res.status(500).json({ error: 'Failed to rotate API key' })
  }
}