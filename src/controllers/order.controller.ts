import { Request, Response } from 'express'
import Order from '../models/order.model'
import Merchant from '../models/merchant.model'
import { watchForPayment } from '../services/arc.service'

function generateOrderId(): string {
  return `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

// POST /api/orders
export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const { amount, description, expiresInMinutes = 30 } = req.body

    if (!amount || !description) {
      res.status(400).json({ error: 'amount and description are required' })
      return
    }

    const merchant = await Merchant.findById(req.merchantId)
    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' })
      return
    }

    const orderId = generateOrderId()

    const order = await Order.create({
      merchantId: req.merchantId,
      orderId,
      amount: parseFloat(amount).toFixed(2),
      description,
      memo: `Payment for ${orderId}`,
      merchantWallet: merchant.walletAddress,
      status: 'pending',
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    })

    // Start watching Arc Network for this payment
    watchForPayment(merchant.walletAddress, orderId, order.amount)

    res.status(201).json({
      success: true,
      order: {
        orderId: order.orderId,
        amount: order.amount,
        description: order.description,
        memo: order.memo,
        merchantWallet: order.merchantWallet,
        status: order.status,
        expiresAt: order.expiresAt,
        checkoutUrl: `${process.env.FRONTEND_URL}/pay/${order.orderId}`,
      },
    })
  } catch (err) {
    console.error('[OrderController] createOrder:', err)
    res.status(500).json({ error: 'Failed to create order' })
  }
}

// GET /api/orders — merchant's order list with summary stats
export async function listOrders(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query
    const filter: Record<string, any> = { merchantId: req.merchantId }
    if (status) filter.status = status

    const orders = await Order.find(filter).sort({ createdAt: -1 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const totalReceivedToday = orders
      .filter(o => o.status === 'paid' && o.paidAt && o.paidAt >= today)
      .reduce((sum, o) => sum + parseFloat(o.amount), 0)
      .toFixed(2)

    res.json({
      summary: {
        total: orders.length,
        paid: orders.filter(o => o.status === 'paid').length,
        pending: orders.filter(o => o.status === 'pending').length,
        totalReceivedToday,
        transactionsToday: orders.filter(
          o => o.status === 'paid' && o.paidAt && o.paidAt >= today
        ).length,
      },
      orders,
    })
  } catch (err) {
    console.error('[OrderController] listOrders:', err)
    res.status(500).json({ error: 'Failed to list orders' })
  }
}

// GET /api/orders/:orderId — public, used by checkout page
export async function getOrder(req: Request, res: Response): Promise<void> {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })

    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    // Auto-expire if past expiry
    if (order.status === 'pending' && new Date() > order.expiresAt) {
      order.status = 'expired'
      await order.save()
    }

    res.json(order)
  } catch (err) {
    console.error('[OrderController] getOrder:', err)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
}

// GET /api/orders/:orderId/status — lightweight poll for frontend
export async function getOrderStatus(req: Request, res: Response): Promise<void> {
  try {
    const order = await Order.findOne(
      { orderId: req.params.orderId },
      { status: 1, txHash: 1, paidAt: 1, orderId: 1 }
    )

    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    res.json({
      orderId: order.orderId,
      status: order.status,
      txHash: order.txHash ?? null,
      paidAt: order.paidAt ?? null,
    })
  } catch (err) {
    console.error('[OrderController] getOrderStatus:', err)
    res.status(500).json({ error: 'Failed to get status' })
  }
}