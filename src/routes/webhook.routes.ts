import { Router } from 'express'
import { handleCircleWebhook, testWebhook } from '../controllers/webhook.controller'

const router = Router()

router.post('/circle', handleCircleWebhook)  // Circle event monitor pushes here
router.post('/test', testWebhook)            // dev-only: simulate a payment

export default router