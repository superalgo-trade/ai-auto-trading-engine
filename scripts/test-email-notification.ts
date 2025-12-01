/**
 * 测试邮件提醒功能
 * 
 * 使用方法:
 * npx tsx --env-file=.env ./scripts/test-email-notification.ts
 */

import { emailAlertService, AlertLevel } from '../src/utils/emailAlert';

async function main() {
  console.log('🧪 测试邮件提醒功能...\n');
  
  // 1. 初始化邮件服务
  console.log('1. 初始化邮件服务...');
  emailAlertService.initialize();
  
  // 2. 测试开仓提醒
  console.log('\n2. 测试开仓提醒邮件...');
  const openResult = await emailAlertService.sendTradeNotification({
    type: 'open',
    symbol: 'BTC',
    side: 'long',
    quantity: 100,
    price: 89826.6,
    leverage: 3,
    margin: 2994.22,
    stopLoss: 87846.0,
    takeProfit: 95787.8,
    liquidationPrice: 59884.4,
    marketState: 'uptrend_neutral',
    strategyType: 'trend_following',
    opportunityScore: 85,
    orderId: '123456789',
    timestamp: new Date().toISOString(),
  });
  
  if (openResult) {
    console.log('✅ 开仓提醒邮件发送成功');
  } else {
    console.log('⚠️  开仓提醒邮件未发送（可能是邮件服务未配置或在冷却期内）');
  }
  
  // 等待2秒
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3. 测试平仓提醒（盈利）
  console.log('\n3. 测试平仓提醒邮件（盈利）...');
  const closeProfitResult = await emailAlertService.sendTradeNotification({
    type: 'close',
    symbol: 'BTC',
    side: 'long',
    quantity: 100,
    price: 91500.0,
    leverage: 3,
    entryPrice: 89826.6,
    exitPrice: 91500.0,
    pnl: 250.5,
    pnlPercent: 5.6,
    fee: 15.2,
    closeReason: 'ai_decision',
    totalBalance: 5250.5,
    orderId: '987654321',
    timestamp: new Date().toISOString(),
  });
  
  if (closeProfitResult) {
    console.log('✅ 平仓提醒邮件（盈利）发送成功');
  } else {
    console.log('⚠️  平仓提醒邮件（盈利）未发送');
  }
  
  // 等待2秒
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 4. 测试平仓提醒（亏损）
  console.log('\n4. 测试平仓提醒邮件（亏损）...');
  const closeLossResult = await emailAlertService.sendTradeNotification({
    type: 'close',
    symbol: 'ETH',
    side: 'short',
    quantity: 500,
    price: 3050.0,
    leverage: 3,
    entryPrice: 3004.38,
    exitPrice: 3050.0,
    pnl: -68.5,
    pnlPercent: -4.5,
    fee: 12.8,
    closeReason: 'stop_loss',
    totalBalance: 5182.0,
    orderId: '456789123',
    timestamp: new Date().toISOString(),
  });
  
  if (closeLossResult) {
    console.log('✅ 平仓提醒邮件（亏损）发送成功');
  } else {
    console.log('⚠️  平仓提醒邮件（亏损）未发送');
  }
  
  console.log('\n✅ 测试完成！请检查您的邮箱查看测试邮件。');
  console.log('📧 如果未收到邮件，请检查：');
  console.log('   1. .env 文件中的 SMTP 配置是否正确');
  console.log('   2. SMTP_USER 和 SMTP_PASS 是否有效');
  console.log('   3. 邮箱是否开启了 SMTP 服务');
  console.log('   4. 检查垃圾邮件文件夹');
}

main().catch(console.error);
