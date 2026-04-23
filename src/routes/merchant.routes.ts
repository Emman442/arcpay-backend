import { Router } from 'express'
import {
  registerMerchant,
  loginMerchant,
  getMerchantProfile,
  updateMerchantProfile,
  changePassword,
  rotateApiKey,
} from '../controllers/merchant.controller'
import { requireAuth } from '../middlewares/auth.middleware'

const router = Router()

// Public
router.post('/register', registerMerchant)
router.post('/login', loginMerchant)

// Protected — JWT required (dashboard)
router.get('/me', requireAuth, getMerchantProfile)
router.patch('/me', requireAuth, updateMerchantProfile)
router.post('/me/change-password', requireAuth, changePassword)
router.post('/me/rotate-key', requireAuth, rotateApiKey)

export default router