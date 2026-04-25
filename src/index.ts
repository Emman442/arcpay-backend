import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import morgan from "morgan";
import helmet from "helmet";

import orderRoutes from './routes/order.routes'
import merchantRoutes from './routes/merchant.routes'
import webhookRoutes from './routes/webhook.routes'
import paymentLinkRoutes from './routes/paymentLink.routes'
import connectDB from "./database/connectDB";

dotenv.config();


const app = express();
const PORT = 5000;
const DB_URL = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yrqq1im.mongodb.net/stakeForge?retryWrites=true&w=majority`

app.use(express.json());
app.use(helmet())
app.use(cors({
  origin: [
    'https://arc-pay-eosin.vercel.app',   // no trailing slash
    'http://localhost:3000',               // for local dev
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))


app.use('/api/orders', orderRoutes)
app.use('/api/merchants', merchantRoutes)
app.use('/api/webhook', webhookRoutes)
app.use('/api/payment-links', paymentLinkRoutes)



app.use(morgan("dev"))


connectDB().then(() => {
  app.listen(PORT, () => console.log(`ArcPay backend running on port ${PORT}`))
})
 