// routes/order.routes.ts
import { Router } from 'express'
import { createOrder, listOrders, getOrder, getOrderStatus } from '../controllers/order.controller'
import { requireApiKey } from '../middlewares/auth.middleware'

const router = Router()

router.get('/:orderId/status', getOrderStatus)   // public — frontend polls this
router.get('/:orderId', getOrder)                // public — checkout page
router.post('/', requireApiKey, createOrder)     // protected
router.get('/', requireApiKey, listOrders)       // protected

export default router