// routes/order.routes.ts
import { Router } from 'express'
import { createOrder, listOrders, getOrder, getOrderStatus } from '../controllers/order.controller'
import { requireApiKey, requireAuth } from '../middlewares/auth.middleware'

const router = Router()

router.get('/:orderId/status', getOrderStatus)   // public — frontend polls this
router.get('/:orderId', getOrder)                // public — checkout page
router.post('/', requireAuth, createOrder)     // protected
router.get('/', requireAuth, listOrders)       // protected

export default router