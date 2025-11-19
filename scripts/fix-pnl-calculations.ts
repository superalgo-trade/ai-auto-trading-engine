/**
 * 修复数据库中错误的盈亏和盈亏百分比计算
 * 
 * 问题：
 * 1. priceOrderMonitor 使用了错误的平仓数量（trade.size 而非 position.quantity）
 * 2. 盈亏百分比计算公式错误（应该是 净盈亏/保证金*100）
 * 
 * 修复范围：
 * - position_close_events 表
 * - partial_take_profit_history 表
 * - trades 表（type='close'）
 */

import { createClient } from "@libsql/client";
import { getExchangeClient } from "../src/exchanges/index.js";
import { getQuantoMultiplier } from "../src/utils/contractUtils.js";
import { FeeService } from "../src/services/feeService.js";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

interface CloseEvent {
  id: number;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  close_price: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnl_percent: number;
  fee: number;
  close_reason: string;
  order_id?: string;
}

/**
 * 重新计算单个平仓事件的盈亏
 */
async function recalculatePnl(
  event: CloseEvent,
  feeService: FeeService
): Promise<{
  netPnl: number;
  pnlPercent: number;
  totalFee: number;
} | null> {
  try {
    const exchangeClient = getExchangeClient();
    const contract = exchangeClient.normalizeContract(event.symbol);
    
    // 1. 重新计算毛盈亏
    const grossPnl = await exchangeClient.calculatePnl(
      event.entry_price,
      event.close_price,
      event.quantity,
      event.side,
      contract
    );
    
    // 2. 🔧 使用 FeeService 计算手续费
    const contractType = exchangeClient.getContractType(contract);
    let openFee: number;
    let closeFee: number;
    
    // 计算名义价值
    let openNotionalValue: number;
    let closeNotionalValue: number;
    
    if (contractType === 'inverse') {
      const quantoMultiplier = await getQuantoMultiplier(contract);
      openNotionalValue = event.quantity * quantoMultiplier * event.entry_price;
      closeNotionalValue = event.quantity * quantoMultiplier * event.close_price;
    } else {
      const quantoMultiplier = await getQuantoMultiplier(contract);
      const actualQuantity = quantoMultiplier > 1 ? event.quantity * quantoMultiplier : event.quantity;
      openNotionalValue = actualQuantity * event.entry_price;
      closeNotionalValue = actualQuantity * event.close_price;
    }
    
    // 尝试从交易记录获取真实手续费（如果有 order_id）
    if (event.order_id) {
      const closeFeeResult = await feeService.getFee(
        event.order_id,
        contract,
        closeNotionalValue
      );
      closeFee = closeFeeResult.fee;
      
      if (closeFeeResult.source === 'actual') {
        console.log(`   ✓ 使用真实平仓手续费: ${closeFee.toFixed(4)} USDT`);
      }
    } else {
      // 没有订单ID，使用估算
      closeFee = feeService.estimateFee(closeNotionalValue).fee;
    }
    
    // 开仓手续费：数据库中没有订单ID，只能估算
    openFee = feeService.estimateFee(openNotionalValue).fee;
    
    const totalFee = openFee + closeFee;
    const netPnl = grossPnl - totalFee;
    
    // 3. 重新计算盈亏百分比
    let pnlPercent: number;
    
    if (contractType === 'inverse') {
      // Gate.io 币本位合约
      const quantoMultiplier = await getQuantoMultiplier(contract);
      const positionValue = event.quantity * quantoMultiplier * event.entry_price;
      const margin = positionValue / event.leverage;
      pnlPercent = (netPnl / margin) * 100;
    } else {
      // USDT 正向合约
      // 🔧 关键修复：需要考虑 quantoMultiplier
      // 如果 quantoMultiplier > 1，说明 quantity 是张数，需要转换为实际数量
      const quantoMultiplier = await getQuantoMultiplier(contract);
      const actualQuantity = quantoMultiplier > 1 ? event.quantity * quantoMultiplier : event.quantity;
      const positionValue = actualQuantity * event.entry_price;
      const margin = positionValue / event.leverage;
      pnlPercent = (netPnl / margin) * 100;
    }
    
    return { netPnl, pnlPercent, totalFee };
  } catch (error: any) {
    console.error(`计算 ${event.symbol} 盈亏失败:`, error.message);
    return null;
  }
}

/**
 * 修复 position_close_events 表
 */
async function fixCloseEvents() {
  console.log('\n📊 开始修复 position_close_events 表...\n');
  
  // 创建 FeeService 实例
  const exchangeClient = getExchangeClient();
  const feeService = new FeeService(exchangeClient);
  
  // 查询所有需要修复的记录
  const result = await dbClient.execute({
    sql: `SELECT id, symbol, side, entry_price, close_price, quantity, leverage, 
                 pnl, pnl_percent, fee, close_reason, order_id
          FROM position_close_events
          WHERE created_at >= datetime('now', '-7 days')
          ORDER BY created_at DESC`
  });
  
  if (result.rows.length === 0) {
    console.log('✅ 没有需要修复的记录');
    return;
  }
  
  console.log(`找到 ${result.rows.length} 条记录，开始修复...\n`);
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const row of result.rows) {
    const event: CloseEvent = {
      id: row.id as number,
      symbol: row.symbol as string,
      side: row.side as 'long' | 'short',
      entry_price: parseFloat(row.entry_price as string),
      close_price: parseFloat(row.close_price as string),
      quantity: parseFloat(row.quantity as string),
      leverage: parseInt(row.leverage as string),
      pnl: parseFloat(row.pnl as string),
      pnl_percent: parseFloat(row.pnl_percent as string),
      fee: parseFloat(row.fee as string),
      close_reason: row.close_reason as string,
      order_id: row.order_id as string | undefined,
    };
    
    // 重新计算
    const recalc = await recalculatePnl(event, feeService);
    if (!recalc) {
      skippedCount++;
      continue;
    }
    
    const { netPnl, pnlPercent, totalFee } = recalc;
    
    // 🔧 强制更新所有数据，不做差异判断
    await dbClient.execute({
      sql: `UPDATE position_close_events 
            SET pnl = ?, pnl_percent = ?, fee = ?
            WHERE id = ?`,
      args: [netPnl, pnlPercent, totalFee, event.id]
    });
    
    const pnlDiff = netPnl - event.pnl;
    const pnlPercentDiff = pnlPercent - event.pnl_percent;
    
    console.log(`✅ ${event.symbol} ${event.side} (${event.close_reason})`);
    console.log(`   旧值: PnL=${event.pnl.toFixed(2)} (${event.pnl_percent.toFixed(2)}%), Fee=${event.fee.toFixed(4)}`);
    console.log(`   新值: PnL=${netPnl.toFixed(2)} (${pnlPercent.toFixed(2)}%), Fee=${totalFee.toFixed(4)}`);
    console.log(`   差异: PnL=${pnlDiff.toFixed(2)}, %=${pnlPercentDiff.toFixed(2)}\n`);
    
    fixedCount++;
    
    // 同时更新 trades 表中对应的记录
    if (event.order_id) {
      await dbClient.execute({
        sql: `UPDATE trades 
              SET pnl = ?, fee = ?
              WHERE order_id = ? AND type = 'close'`,
        args: [netPnl, totalFee, event.order_id]
      });
      console.log(`   ↳ 同步更新 trades 表`);
    }
  }
  
  console.log(`\n📊 position_close_events 修复完成:`);
  console.log(`   ✅ 已修复: ${fixedCount} 条`);
  console.log(`   ⏭️  已跳过: ${skippedCount} 条`);
}

/**
 * 修复 partial_take_profit_history 表
 */
async function fixPartialTakeProfitHistory() {
  console.log('\n📊 开始修复 partial_take_profit_history 表...\n');
  
  // 创建 FeeService 实例
  const exchangeClient = getExchangeClient();
  const feeService = new FeeService(exchangeClient);
  
  // 查询所有分批止盈记录
  const result = await dbClient.execute({
    sql: `SELECT id, symbol, side, trigger_price, closed_quantity, pnl, order_id
          FROM partial_take_profit_history
          WHERE status = 'completed'
          ORDER BY timestamp DESC`
  });
  
  if (result.rows.length === 0) {
    console.log('✅ 没有需要修复的记录');
    return;
  }
  
  console.log(`找到 ${result.rows.length} 条分批止盈记录，开始修复...\n`);
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const row of result.rows) {
    const symbol = row.symbol as string;
    const side = row.side as 'long' | 'short';
    const triggerPrice = parseFloat(row.trigger_price as string);
    const closedQuantity = parseFloat(row.closed_quantity as string);
    const oldPnl = parseFloat(row.pnl as string);
    const orderId = row.order_id as string | undefined;
    
    // 从 trades 表查找对应的开仓价格和杠杆
    const tradeResult = await dbClient.execute({
      sql: `SELECT price as entry_price, leverage
            FROM trades
            WHERE symbol = ? AND side = ? AND type = 'open'
            ORDER BY timestamp DESC
            LIMIT 1`,
      args: [symbol, side]
    });
    
    if (tradeResult.rows.length === 0) {
      console.log(`⚠️  ${symbol}: 未找到开仓记录，跳过`);
      skippedCount++;
      continue;
    }
    
    const entryPrice = parseFloat(tradeResult.rows[0].entry_price as string);
    const leverage = parseInt(tradeResult.rows[0].leverage as string);
    
    if (!entryPrice || entryPrice <= 0) {
      console.log(`⚠️  ${symbol}: 开仓价无效 (${entryPrice})，跳过`);
      skippedCount++;
      continue;
    }
    
    // 重新计算盈亏
    const contract = exchangeClient.normalizeContract(symbol);
    
    const grossPnl = await exchangeClient.calculatePnl(
      entryPrice,
      triggerPrice,
      closedQuantity,
      side,
      contract
    );
    
    // 🔧 使用 FeeService 计算手续费
    const contractType = exchangeClient.getContractType(contract);
    let notionalValue: number;
    
    if (contractType === 'inverse') {
      const quantoMultiplier = await getQuantoMultiplier(contract);
      notionalValue = triggerPrice * closedQuantity * quantoMultiplier;
    } else {
      const quantoMultiplier = await getQuantoMultiplier(contract);
      const actualQuantity = quantoMultiplier > 1 ? closedQuantity * quantoMultiplier : closedQuantity;
      notionalValue = actualQuantity * triggerPrice;
    }
    
    // 尝试获取真实手续费
    let actualFee: number;
    if (orderId) {
      const feeResult = await feeService.getFee(orderId, contract, notionalValue);
      actualFee = feeResult.fee;
      if (feeResult.source === 'actual') {
        console.log(`   ✓ 使用真实手续费: ${actualFee.toFixed(4)} USDT`);
      }
    } else {
      actualFee = feeService.estimateFee(notionalValue).fee;
    }
    
    const netPnl = grossPnl - actualFee;
    
    // 🔧 强制更新，不做差异判断
    await dbClient.execute({
      sql: `UPDATE partial_take_profit_history 
            SET pnl = ?
            WHERE id = ?`,
      args: [netPnl, row.id]
    });
    
    const pnlDiff = netPnl - oldPnl;
    
    console.log(`✅ ${symbol} ${side}`);
    console.log(`   旧值: ${oldPnl.toFixed(2)} USDT`);
    console.log(`   新值: ${netPnl.toFixed(2)} USDT`);
    console.log(`   差异: ${pnlDiff.toFixed(2)} USDT\n`);
    
    fixedCount++;
    
    // 同时更新 trades 表
    if (orderId) {
      await dbClient.execute({
        sql: `UPDATE trades 
              SET pnl = ?, fee = ?
              WHERE order_id = ? AND type = 'close'`,
        args: [netPnl, actualFee, orderId]
      });
      console.log(`   ↳ 同步更新 trades 表`);
    }
  }
  
  console.log(`\n📊 partial_take_profit_history 修复完成:`);
  console.log(`   ✅ 已修复: ${fixedCount} 条`);
  console.log(`   ⏭️  已跳过: ${skippedCount} 条`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🔧 开始修复数据库中的盈亏计算错误...');
  console.log('━'.repeat(60));
  
  try {
    // 1. 修复平仓事件
    await fixCloseEvents();
    
    // 2. 修复分批止盈记录
    await fixPartialTakeProfitHistory();
    
    console.log('✅ 所有修复完成！\n');
    
    // 显示修复后的统计
    console.log('📊 修复后的数据统计:\n');
    
    const statsResult = await dbClient.execute({
      sql: `SELECT 
              symbol,
              side,
              close_reason,
              ROUND(pnl, 2) as pnl,
              ROUND(pnl_percent, 2) as pnl_percent
            FROM position_close_events
            WHERE created_at >= datetime('now', '-7 days')
            ORDER BY created_at DESC
            LIMIT 10`
    });
    
    console.log('最近的平仓事件:');
    console.table(statsResult.rows);
    
  } catch (error: any) {
    console.error('❌ 修复失败:', error.message);
    process.exit(1);
  }
}

main();
