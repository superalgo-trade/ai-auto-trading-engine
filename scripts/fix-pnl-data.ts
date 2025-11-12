/**
 * 修复错误的PNL数据
 * 
 * 问题：分批止盈系统错误地将PNL乘以了杠杆
 * 解决方案：重新计算所有受影响的交易记录的正确PNL
 */

import 'dotenv/config';
import { createClient } from "@libsql/client";
import { getExchangeClient } from "../src/exchanges/index.js";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function fixPnlData() {
  console.log("🔧 开始修复PNL数据...\n");

  try {
    // 获取交易所客户端
    const exchangeClient = getExchangeClient();
    
    // 1. 获取所有平仓交易记录
    const closeTradesResult = await dbClient.execute(
      "SELECT * FROM trades WHERE type = 'close' ORDER BY timestamp DESC"
    );

    if (!closeTradesResult.rows || closeTradesResult.rows.length === 0) {
      console.log("❌ 没有找到平仓交易记录");
      return;
    }

    console.log(`📊 找到 ${closeTradesResult.rows.length} 条平仓记录\n`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. 遍历每条平仓记录
    for (const closeRow of closeTradesResult.rows) {
      try {
        const symbol = closeRow.symbol as string;
        const side = closeRow.side as string;
        const closePrice = Number.parseFloat(closeRow.price as string);
        const quantity = Number.parseFloat(closeRow.quantity as string);
        const leverage = Number.parseInt(closeRow.leverage as string);
        const oldPnl = Number.parseFloat((closeRow.pnl as string) || "0");
        const oldFee = Number.parseFloat((closeRow.fee as string) || "0");

        // 查找对应的开仓记录
        const openTradesResult = await dbClient.execute({
          sql: `SELECT * FROM trades 
                WHERE symbol = ? 
                AND side = ? 
                AND type = 'open' 
                AND timestamp < ?
                ORDER BY timestamp DESC 
                LIMIT 1`,
          args: [symbol, side, closeRow.timestamp],
        });

        if (!openTradesResult.rows || openTradesResult.rows.length === 0) {
          console.log(`⚠️  无法找到 ${symbol} 的开仓记录，跳过`);
          skippedCount++;
          continue;
        }

        const openRow = openTradesResult.rows[0];
        const entryPrice = Number.parseFloat(openRow.price as string);

        // 构造合约名称
        const contract = exchangeClient.normalizeContract(symbol);

        // 3. 使用exchangeClient重新计算正确的PNL（毛利润）
        const grossPnl = await exchangeClient.calculatePnl(
          entryPrice,
          closePrice,
          quantity,
          side as 'long' | 'short',
          contract
        );

        // 4. 计算手续费
        const contractType = await exchangeClient.getContractType();
        let openFee: number;
        let closeFee: number;

        if (contractType === 'inverse') {
          // Gate.io 币本位合约
          const { getQuantoMultiplier } = await import("../src/utils/contractUtils.js");
          const quantoMultiplier = await getQuantoMultiplier(contract);
          openFee = entryPrice * quantity * quantoMultiplier * 0.0005;
          closeFee = closePrice * quantity * quantoMultiplier * 0.0005;
        } else {
          // Binance USDT合约
          openFee = entryPrice * quantity * 0.0005;
          closeFee = closePrice * quantity * 0.0005;
        }

        const totalFee = openFee + closeFee;
        const correctPnl = grossPnl - totalFee;

        // 5. 检查PNL是否需要修复
        const pnlDiff = Math.abs(oldPnl - correctPnl);
        const pnlDiffPercent = oldPnl !== 0 ? (pnlDiff / Math.abs(oldPnl)) * 100 : 0;

        // 如果差异超过5%，或者手续费为0（说明是旧代码生成的），则认为需要修复
        if (pnlDiffPercent > 5 || oldFee === 0) {
          console.log(`🔧 修复 ${symbol} ${side}:`);
          console.log(`   开仓: ${entryPrice.toFixed(6)}, 平仓: ${closePrice.toFixed(6)}, 数量: ${quantity}`);
          console.log(`   杠杆: ${leverage}x`);
          console.log(`   错误PNL: ${oldPnl.toFixed(2)} USDT`);
          console.log(`   正确PNL: ${correctPnl.toFixed(2)} USDT`);
          console.log(`   差异: ${pnlDiff.toFixed(2)} USDT (${pnlDiffPercent.toFixed(1)}%)`);
          console.log(`   手续费: ${oldFee.toFixed(4)} → ${totalFee.toFixed(4)} USDT\n`);

          // 6. 更新trades表
          await dbClient.execute({
            sql: `UPDATE trades 
                  SET pnl = ?, fee = ?
                  WHERE id = ?`,
            args: [correctPnl, totalFee, closeRow.id],
          });

          // 7. 更新position_close_events表
          const pnlPercent = entryPrice > 0 
            ? ((closePrice - entryPrice) / entryPrice * 100 * (side === 'long' ? 1 : -1) * leverage)
            : 0;

          await dbClient.execute({
            sql: `UPDATE position_close_events 
                  SET pnl = ?, pnl_percent = ?, fee = ?
                  WHERE symbol = ? 
                  AND ABS(close_price - ?) < 0.1
                  AND ABS(quantity - ?) < 0.1`,
            args: [
              correctPnl, 
              pnlPercent, 
              totalFee, 
              symbol, 
              closePrice, 
              quantity
            ],
          });

          // 8. 更新partial_take_profit_history表
          await dbClient.execute({
            sql: `UPDATE partial_take_profit_history 
                  SET pnl = ?
                  WHERE symbol = ? 
                  AND ABS(trigger_price - ?) < 0.1
                  AND ABS(closed_quantity - ?) < 0.1`,
            args: [
              correctPnl,
              symbol, 
              closePrice, 
              quantity
            ],
          });

          fixedCount++;
        } else {
          console.log(`✅ ${symbol} ${side} PNL正确 (${correctPnl.toFixed(2)} USDT)`);
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`❌ 处理记录失败:`, error.message);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 修复完成统计:");
    console.log(`   ✅ 已修复: ${fixedCount} 条`);
    console.log(`   ⏭️  已跳过: ${skippedCount} 条`);
    console.log(`   ❌ 失败: ${errorCount} 条`);
    console.log("=".repeat(50));

  } catch (error: any) {
    console.error("❌ 修复过程出错:", error);
    throw error;
  }
}

// 执行修复
fixPnlData()
  .then(() => {
    console.log("\n✅ 修复完成！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 修复失败:", error);
    process.exit(1);
  });
