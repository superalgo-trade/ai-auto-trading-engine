/**
 * 手续费服务测试脚本
 * 验证FeeService的各项功能
 */

import { FeeService } from '../src/services/feeService';
import { createExchangeClient } from '../src/exchanges/index';

async function main() {
  console.log('🧪 手续费服务测试\n');

  // 1. 创建交易所客户端
  const exchangeClient = createExchangeClient();
  const feeService = new FeeService(exchangeClient);

  console.log(`📌 交易所: ${exchangeClient.getExchangeName()}`);
  console.log(`📌 测试网: ${exchangeClient.isTestnet()}\n`);

  // 2. 测试手续费估算
  console.log('=== 测试1: 手续费估算 ===');
  
  const testNotionalValue = 1000; // 1000 USDT名义价值
  
  const takerFeeResult = feeService.estimateFee(testNotionalValue, false);
  console.log(`Taker手续费: ${takerFeeResult.fee.toFixed(4)} USDT`);
  console.log(`费率: ${((takerFeeResult.rate || 0) * 100).toFixed(3)}%`);
  console.log(`来源: ${takerFeeResult.source}\n`);

  const makerFeeResult = feeService.estimateFee(testNotionalValue, true);
  console.log(`Maker手续费: ${makerFeeResult.fee.toFixed(4)} USDT`);
  console.log(`费率: ${((makerFeeResult.rate || 0) * 100).toFixed(3)}%`);
  console.log(`来源: ${makerFeeResult.source}\n`);

  // 3. 测试从交易记录获取真实手续费
  console.log('=== 测试2: 获取真实手续费 ===');
  
  try {
    // 获取最近的持仓
    const positions = await exchangeClient.getPositions();
    if (positions.length === 0) {
      console.log('⚠️ 当前无持仓，无法测试真实手续费获取\n');
    } else {
      const position = positions[0];
      console.log(`测试持仓: ${position.contract}`);
      
      // 获取该合约的最近成交记录
      const trades = await exchangeClient.getMyTrades(position.contract, 10);
      
      if (trades.length === 0) {
        console.log(`⚠️ ${position.contract} 无最近成交记录\n`);
      } else {
        const latestTrade = trades[0];
        console.log(`最新成交: 订单ID=${latestTrade.order_id}, 手续费=${latestTrade.fee}\n`);
        
        // 测试从订单ID获取真实手续费
        const actualFeeResult = await feeService.getActualFeeFromTrade(
          latestTrade.order_id || latestTrade.id,
          position.contract
        );
        
        if (actualFeeResult) {
          console.log(`✅ 成功获取真实手续费:`);
          console.log(`  手续费: ${actualFeeResult.fee.toFixed(4)} USDT`);
          console.log(`  来源: ${actualFeeResult.source}\n`);
        } else {
          console.log(`⚠️ 未能获取真实手续费\n`);
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ 测试真实手续费失败: ${error.message}\n`);
  }

  // 4. 测试智能手续费获取（带缓存）
  console.log('=== 测试3: 智能手续费获取 ===');
  
  const testOrderId = '12345678';
  const testContract = 'BTC_USDT';
  const testNotional = 500;
  
  // 第一次调用 - 应该估算
  const smartFee1 = await feeService.getFee(
    null, // 无订单ID
    testContract,
    testNotional,
    false
  );
  console.log(`智能获取(无订单ID): ${smartFee1.fee.toFixed(4)} USDT, 来源=${smartFee1.source}`);
  
  // 第二次调用 - 带订单ID（可能找不到，会降级到估算）
  const smartFee2 = await feeService.getFee(
    testOrderId,
    testContract,
    testNotional,
    false
  );
  console.log(`智能获取(有订单ID): ${smartFee2.fee.toFixed(4)} USDT, 来源=${smartFee2.source}\n`);

  // 5. 测试缓存清理
  console.log('=== 测试4: 缓存管理 ===');
  feeService.cleanupCache();
  console.log('✅ 缓存已清理\n');

  console.log('🎉 所有测试完成！');
}

main().catch(console.error);
