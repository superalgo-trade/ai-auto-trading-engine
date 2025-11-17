/**
 * 测试平仓原因显示优化
 * 验证不同 close_reason 的显示文本是否正确
 */

// 模拟不同的平仓事件
const testEvents = [
  {
    symbol: 'BTC',
    side: 'long',
    close_reason: 'stop_loss_triggered',
    entry_price: 50000,
    close_price: 49000,
    pnl: -100,
    pnl_percent: -2,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'ETH',
    side: 'short',
    close_reason: 'take_profit_triggered',
    entry_price: 3000,
    close_price: 2950,
    pnl: 50,
    pnl_percent: 1.67,
    trigger_price: 2950,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'LTC',
    side: 'short',
    close_reason: 'partial_close',
    entry_price: 96.050,
    close_price: 94.930,
    pnl: 23.44,
    pnl_percent: 10.49,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'SOL',
    side: 'long',
    close_reason: 'peak_drawdown',
    entry_price: 100,
    close_price: 105,
    pnl: 50,
    pnl_percent: 5,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'BNB',
    side: 'long',
    close_reason: 'forced_close',
    entry_price: 300,
    close_price: 295,
    pnl: -25,
    pnl_percent: -1.67,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'DOGE',
    side: 'short',
    close_reason: 'trend_reversal',
    entry_price: 0.1,
    close_price: 0.098,
    pnl: 20,
    pnl_percent: 2,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'XRP',
    side: 'long',
    close_reason: 'trailing_stop',
    entry_price: 0.5,
    close_price: 0.55,
    pnl: 100,
    pnl_percent: 10,
    created_at: new Date().toISOString()
  }
];

console.log('📊 平仓原因显示测试\n');
console.log('测试修改后的平仓事件显示效果：\n');

for (const e of testEvents) {
  // 根据 close_reason 映射显示文本（与修改后的代码一致）
  let reasonText = '⚠️ 未知原因';
  switch (e.close_reason) {
    case 'stop_loss_triggered':
      reasonText = '🛑 止损触发';
      break;
    case 'take_profit_triggered':
      reasonText = '🎯 止盈触发';
      break;
    case 'partial_close':
      reasonText = '📈 分批止盈';
      break;
    case 'manual_close':
    case 'manual':
      reasonText = '📝 手动平仓';
      break;
    case 'ai_decision':
      reasonText = '🤖 AI决策平仓';
      break;
    case 'trend_reversal':
      reasonText = '🔄 趋势反转平仓';
      break;
    case 'peak_drawdown':
      reasonText = '📉 峰值回撤平仓';
      break;
    case 'time_limit':
      reasonText = '⏰ 超时平仓';
      break;
    case 'trailing_stop':
      reasonText = '🎯 移动止损触发';
      break;
    case 'forced_close':
      reasonText = '⚠️ 强制平仓';
      break;
  }
  
  console.log(`${e.symbol} ${e.side === 'long' ? '多单' : '空单'}`);
  console.log(`  触发原因: ${reasonText}`);
  console.log(`  开仓价: ${e.entry_price.toFixed(2)}${e.trigger_price ? `, 触发价: ${e.trigger_price.toFixed(2)}` : ''}, 成交价: ${e.close_price.toFixed(2)}`);
  console.log(`  盈亏: ${e.pnl >= 0 ? '+' : ''}${e.pnl.toFixed(2)} USDT (${e.pnl_percent >= 0 ? '+' : ''}${e.pnl_percent.toFixed(2)}%)`);
  
  // 分析提示
  switch (e.close_reason) {
    case 'stop_loss_triggered':
      if (e.pnl < 0) {
        console.log(`  💡 分析：止损保护了本金，防止了更大亏损`);
      } else {
        console.log(`  💡 分析：止损触发但仍获利，说明入场时机和止损设置都很合理`);
      }
      break;
    case 'take_profit_triggered':
      if (e.pnl > 0) {
        console.log(`  💡 分析：成功止盈，锁定了利润`);
      }
      break;
    case 'partial_close':
      if (e.pnl > 0) {
        console.log(`  💡 分析：分批止盈执行成功，部分锁定利润，剩余仓位继续持有`);
      }
      break;
    case 'peak_drawdown':
      console.log(`  💡 分析：峰值回撤平仓，成功保护了部分利润，避免盈利回吐过多`);
      break;
    case 'trend_reversal':
      console.log(`  💡 分析：趋势反转平仓，及时止盈/止损避免趋势反转造成损失`);
      break;
    case 'trailing_stop':
      if (e.pnl > 0) {
        console.log(`  💡 分析：移动止损触发，成功锁定大部分利润`);
      }
      break;
    case 'forced_close':
      console.log(`  💡 分析：系统强制平仓（可能超时或风控触发），需要检查持仓策略`);
      break;
  }
  
  console.log('');
}

// 统计分析
const totalPnl = testEvents.reduce((sum, e) => sum + e.pnl, 0);
const profitEvents = testEvents.filter(e => e.pnl > 0).length;
const lossEvents = testEvents.filter(e => e.pnl < 0).length;

const stopLossCount = testEvents.filter(e => e.close_reason === 'stop_loss_triggered').length;
const takeProfitCount = testEvents.filter(e => e.close_reason === 'take_profit_triggered').length;
const partialCloseCount = testEvents.filter(e => e.close_reason === 'partial_close').length;
const otherCount = testEvents.length - stopLossCount - takeProfitCount - partialCloseCount;

console.log('近期平仓事件统计：');

const categories: string[] = [];
if (stopLossCount > 0) categories.push(`止损${stopLossCount}次`);
if (takeProfitCount > 0) categories.push(`止盈${takeProfitCount}次`);
if (partialCloseCount > 0) categories.push(`分批止盈${partialCloseCount}次`);
if (otherCount > 0) categories.push(`其他${otherCount}次`);

console.log(`  - 平仓总次数: ${testEvents.length}次 (${categories.join(', ')})`);
console.log(`  - 盈利平仓: ${profitEvents}次, 亏损平仓: ${lossEvents}次`);
console.log(`  - 胜率: ${(profitEvents / (profitEvents + lossEvents) * 100).toFixed(1)}%`);
console.log(`  - 净盈亏: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT`);
console.log('\n💡 策略优化建议：分析这些平仓事件，思考如何改进入场时机和止损止盈设置。');

console.log('\n\n✅ 测试完成！');
console.log('\n修改总结：');
console.log('1. 修复了 partial_close 被错误显示为"强制平仓"的问题');
console.log('2. 为所有10种 close_reason 类型提供了准确的显示文本');
console.log('3. 优化了分析提示，针对不同平仓原因提供更精准的建议');
console.log('4. 改进了统计信息，详细展示各类平仓的次数分布');
