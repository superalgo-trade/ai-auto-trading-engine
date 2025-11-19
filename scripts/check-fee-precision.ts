/**
 * 检查手续费精度问题
 */
import { getExchangeClient } from '../src/exchanges/index';

async function main() {
  console.log('🔍 检查手续费精度\n');
  
  const exchangeClient = getExchangeClient();
  
  // 获取最近的成交记录
  const trades = await exchangeClient.getMyTrades(undefined, 10);
  
  console.log('最近10笔成交的手续费精度：\n');
  
  for (const trade of trades) {
    console.log(`合约: ${trade.contract}`);
    console.log(`  订单ID: ${trade.order_id || trade.id}`);
    console.log(`  原始手续费: ${trade.fee}`);
    console.log(`  手续费类型: ${typeof trade.fee}`);
    console.log(`  解析为数字: ${parseFloat(trade.fee || '0')}`);
    console.log(`  完整精度: ${parseFloat(trade.fee || '0').toString()}`);
    console.log(`  交易时间: ${new Date(trade.timestamp).toLocaleString('zh-CN')}`);
    console.log('');
  }
}

main().catch(console.error);
