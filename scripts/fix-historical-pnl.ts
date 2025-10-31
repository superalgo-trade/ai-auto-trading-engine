/**
 * 修复数据库中所有异常的历史盈亏记录
 * 
 * 这个脚本会：
 * 1. 扫描所有平仓记录
 * 2. 为每条记录找到对应的开仓记录
 * 3. 重新计算正确的盈亏和手续费
 * 4. 修复所有差异超过阈值的记录
 */
import { createClient } from "@libsql/client";
import { getQuantoMultiplier } from "../src/utils/contractUtils.js";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function fixHistoricalPnl() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔧 修复历史盈亏记录");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // 查询所有平仓记录
    const result = await dbClient.execute({
      sql: `SELECT * FROM trades WHERE type = 'close' ORDER BY timestamp DESC`,
      args: [],
    });

    if (!result.rows || result.rows.length === 0) {
      console.log("❌ 未找到平仓记录\n");
      return;
    }

    console.log(`找到 ${result.rows.length} 条平仓记录\n`);

    let fixedCount = 0;
    let correctCount = 0;
    let skippedCount = 0;

    for (const closeTrade of result.rows) {
      const id = closeTrade.id;
      const symbol = closeTrade.symbol as string;
      const side = closeTrade.side as string;
      const closePrice = Number.parseFloat(closeTrade.price as string);
      const quantity = Number.parseFloat(closeTrade.quantity as string);
      const recordedPnl = Number.parseFloat(closeTrade.pnl as string || "0");
      const recordedFee = Number.parseFloat(closeTrade.fee as string || "0");
      const timestamp = closeTrade.timestamp as string;

      // 查找对应的开仓记录
      const openResult = await dbClient.execute({
        sql: `SELECT * FROM trades WHERE symbol = ? AND type = 'open' AND timestamp < ? ORDER BY timestamp DESC LIMIT 1`,
        args: [symbol, timestamp],
      });

      if (!openResult.rows || openResult.rows.length === 0) {
        console.log(`ID ${id} (${symbol}): ⚠️  未找到开仓记录，跳过`);
        skippedCount++;
        continue;
      }

      const openTrade = openResult.rows[0];
      const openPrice = Number.parseFloat(openTrade.price as string);

      // 获取合约乘数
      const contract = `${symbol}_USDT`;
      const quantoMultiplier = await getQuantoMultiplier(contract);

      // 重新计算正确的盈亏
      const priceChange = side === "long" 
        ? (closePrice - openPrice) 
        : (openPrice - closePrice);
      
      const grossPnl = priceChange * quantity * quantoMultiplier;
      const openFee = openPrice * quantity * quantoMultiplier * 0.0005;
      const closeFee = closePrice * quantity * quantoMultiplier * 0.0005;
      const totalFee = openFee + closeFee;
      const correctPnl = grossPnl - totalFee;

      // 计算差异
      const pnlDiff = Math.abs(recordedPnl - correctPnl);
      const feeDiff = Math.abs(recordedFee - totalFee);

      // 如果差异超过0.5 USDT，就需要修复
      if (pnlDiff > 0.5 || feeDiff > 0.1) {
        console.log(`ID ${id} (${symbol} ${side}): 🔧 需要修复`);
        console.log(`  开仓价: ${openPrice.toFixed(4)}, 平仓价: ${closePrice.toFixed(4)}, 数量: ${quantity}`);
        console.log(`  盈亏: ${recordedPnl.toFixed(2)} → ${correctPnl.toFixed(2)} USDT (差异: ${pnlDiff.toFixed(2)})`);
        console.log(`  手续费: ${recordedFee.toFixed(4)} → ${totalFee.toFixed(4)} USDT (差异: ${feeDiff.toFixed(4)})`);

        try {
          // 更新数据库
          await dbClient.execute({
            sql: `UPDATE trades SET pnl = ?, fee = ? WHERE id = ?`,
            args: [correctPnl, totalFee, id],
          });

          console.log(`  ✅ 已修复\n`);
          fixedCount++;
        } catch (updateError: any) {
          console.log(`  ❌ 更新失败: ${updateError.message}\n`);
        }
      } else {
        console.log(`ID ${id} (${symbol}): ✅ 正确 (盈亏: ${recordedPnl.toFixed(2)} USDT)`);
        correctCount++;
      }
    }

    // 统计结果
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n📊 修复统计:`);
    console.log(`  总记录数: ${result.rows.length}`);
    console.log(`  已修复: ${fixedCount} 条`);
    console.log(`  正确: ${correctCount} 条`);
    console.log(`  跳过: ${skippedCount} 条`);

    if (fixedCount > 0) {
      console.log(`\n✅ 成功修复 ${fixedCount} 条错误记录！`);
    } else {
      console.log(`\n✅ 所有记录都正确！`);
    }

    // 显示修复后的累计盈亏
    const allTrades = await dbClient.execute({
      sql: `SELECT SUM(pnl) as total_pnl FROM trades WHERE type = 'close'`,
      args: [],
    });
    
    if (allTrades.rows[0]) {
      const totalPnl = Number.parseFloat(allTrades.rows[0].total_pnl as string || "0");
      console.log(`\n💰 修复后累计净盈亏: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error: any) {
    console.error("修复失败:", error);
    throw error;
  } finally {
    await dbClient.close();
  }
}

// 执行修复
console.log("⚠️  此操作将修改数据库中的交易记录");
console.log("数据库已在运行前自动备份\n");

fixHistoricalPnl().catch((error) => {
  console.error("执行失败:", error);
  process.exit(1);
});

