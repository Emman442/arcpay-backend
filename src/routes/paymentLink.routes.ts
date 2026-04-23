import { Router } from 'express'
import {
  createPaymentLink,
  listPaymentLinks,
  getPaymentLinkBySlug,
  deactivatePaymentLink,
} from '../controllers/paymentLink.controller'
import { requireApiKey } from '../middlewares/auth.middleware'

const router = Router()

router.get('/slug/:slug', getPaymentLinkBySlug)                  // public — checkout page
router.post('/', requireApiKey, createPaymentLink)               // protected
router.get('/', requireApiKey, listPaymentLinks)                 // protected
router.delete('/:id', requireApiKey, deactivatePaymentLink)     // protected

export default router