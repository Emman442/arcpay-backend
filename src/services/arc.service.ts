import { createPublicClient, http, parseAbi, decodeEventLog } from 'viem'
import Order from '../models/order.model'
import Merchant from '../models/merchant.model'
import { notifyMerchantWebhook } from '../services/webhook.service'

const ARC_RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'
const USDC_CONTRACT = (process.env.USDC_CONTRACT_ADDRESS || '0x') as `0x${string}`

const ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address) view returns (uint256)',
])

export const arcClient = createPublicClient({
  transport: http(ARC_RPC),
  chain: {
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls: { default: { http: [ARC_RPC] } },
  },
})

// -----------------------------------------------------------
// Watch for a specific payment on Arc Network.
// Called right after an order is created.
// Returns the unwatch function in case you need to cancel.
// -----------------------------------------------------------
export function watchForPayment(
  merchantWallet: string,
  orderId: string,
  expectedAmount: string
): () => void {
  console.log(`[ArcService] Watching — Order: ${orderId}, Wallet: ${merchantWallet}`)

  const unwatch = arcClient.watchContractEvent({
    address: USDC_CONTRACT,
    abi: ERC20_ABI,
    eventName: 'Transfer',
    args: { to: merchantWallet as `0x${string}` },

    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { args } = decodeEventLog({
            abi: ERC20_ABI,
            data: log.data,
            topics: log.topics,
          })

          const received = (Number(args.value) / 1e6).toFixed(2)
          const expected = parseFloat(expectedAmount).toFixed(2)

          if (received !== expected) continue

          console.log(`[ArcService] Payment matched — Order: ${orderId}, Tx: ${log.transactionHash}`)

          const updatedOrder = await Order.findOneAndUpdate(
            { orderId, status: 'pending' },
            { status: 'paid', txHash: log.transactionHash, paidAt: new Date() },
            { new: true }
          )

          if (!updatedOrder) continue

          unwatch() // stop watching — payment received

          const merchant = await Merchant.findById(updatedOrder.merchantId)
          if (merchant?.webhookUrl) {
            await notifyMerchantWebhook(merchant.webhookUrl, updatedOrder)
          }
        } catch (err) {
          console.error('[ArcService] Error processing log:', err)
        }
      }
    },

    onError: (err) => console.error('[ArcService] Watch error:', err),
  })

  return unwatch
}

// -----------------------------------------------------------
// Get USDC balance of a wallet address
// -----------------------------------------------------------
export async function getWalletBalance(walletAddress: string): Promise<string> {
  const raw = await arcClient.readContract({
    address: USDC_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress as `0x${string}`],
  })

  return (Number(raw) / 1e6).toFixed(2)
}