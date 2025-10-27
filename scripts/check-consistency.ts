/**
 * open-nof1.ai - AI 加密货币自动交易系统
 * Copyright (C) 2025 195440
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * 检查交易记录和持仓状态的一致性
 */
import { createClient } from "@libsql/client";
import { createGateClient } from "../src/services/gateClient";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function checkConsistency() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 检查交易记录与持仓状态一致性");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const gateClient = createGateClient();

  try {
    // 1. 从 Gate.io 获取实际持仓
    console.log("🔍 步骤1: 获取 Gate.io 实际持仓...");
    const gatePositions = await gateClient.getPositions();
    const activeGatePositions = gatePositions.filter(
      (p: any) => Number.parseInt(p.size || "0") !== 0
    );

    console.log(`   ✅ Gate.io 当前持仓数: ${activeGatePositions.length}\n`);

    if (activeGatePositions.length > 0) {
      for (const pos of activeGatePositions) {
        const size = Number.parseInt(pos.size || "0");
        const symbol = pos.contract.replace("_USDT", "");
        const side = size > 0 ? "long" : "short";
        const quantity = Math.abs(size);
        const entryPrice = Number.parseFloat(pos.entryPrice || "0");
        const markPrice = Number.parseFloat(pos.markPrice || "0");
        const pnl = Number.parseFloat(pos.unrealisedPnl || "0");
        const leverage = Number.parseInt(pos.leverage || "1");

        console.log(`   📍 ${symbol}:`);
        console.log(`      方向: ${side === "long" ? "做多 (LONG)" : "做空 (SHORT)"}`);
        console.log(`      数量: ${quantity} 张`);
        console.log(`      开仓价: ${entryPrice.toFixed(4)}`);
        console.log(`      当前价: ${markPrice.toFixed(4)}`);
        console.log(`      杠杆: ${leverage}x`);
        console.log(`      未实现盈亏: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT`);
        console.log(`      Gate.io size值: ${size} (${size > 0 ? "正数=做多" : "负数=做空"})\n`);
      }
    }

    // 2. 从数据库获取持仓记录
    console.log("🔍 步骤2: 检查数据库持仓记录...");
    const dbPositions = await dbClient.execute("SELECT * FROM positions");
    console.log(`   ✅ 数据库持仓记录数: ${dbPositions.rows.length}\n`);

    if (dbPositions.rows.length > 0) {
      for (const row of dbPositions.rows) {
        const pos = row as any;
        console.log(`   📍 ${pos.symbol}:`);
        console.log(`      方向: ${pos.side === "long" ? "做多 (LONG)" : "做空 (SHORT)"}`);
        console.log(`      数量: ${pos.quantity} 张`);
        console.log(`      开仓价: ${Number.parseFloat(pos.entry_price).toFixed(4)}`);
        console.log(`      当前价: ${Number.parseFloat(pos.current_price).toFixed(4)}`);
        console.log(`      杠杆: ${pos.leverage}x`);
        console.log(`      未实现盈亏: ${pos.unrealized_pnl >= 0 ? "+" : ""}${Number.parseFloat(pos.unrealized_pnl).toFixed(2)} USDT`);
        console.log(`      开仓时间: ${pos.opened_at}\n`);
      }
    }

    // 3. 对比一致性
    console.log("🔍 步骤3: 对比 Gate.io 与数据库持仓一致性...\n");

    const gateSymbols = new Set(
      activeGatePositions.map((p: any) => p.contract.replace("_USDT", ""))
    );
    const dbSymbols = new Set(
      dbPositions.rows.map((row: any) => row.symbol)
    );

    // 检查 Gate.io 有但数据库没有的
    const missingInDb = Array.from(gateSymbols).filter(s => !dbSymbols.has(s));
    if (missingInDb.length > 0) {
      console.log(`   ⚠️ Gate.io 有但数据库缺失的持仓: ${missingInDb.join(", ")}`);
    }

    // 检查数据库有但 Gate.io 没有的
    const missingInGate = Array.from(dbSymbols).filter(s => !gateSymbols.has(s));
    if (missingInGate.length > 0) {
      console.log(`   ⚠️ 数据库有但 Gate.io 已平仓的持仓: ${missingInGate.join(", ")}`);
    }

    // 检查两边都有的，对比详细信息
    const commonSymbols = Array.from(gateSymbols).filter(s => dbSymbols.has(s));
    for (const symbol of commonSymbols) {
      const gatePos = activeGatePositions.find(
        (p: any) => p.contract.replace("_USDT", "") === symbol
      );
      const dbPos = dbPositions.rows.find(
        (row: any) => row.symbol === symbol
      ) as any;

      const gateSize = Number.parseInt(gatePos.size || "0");
      const gateSide = gateSize > 0 ? "long" : "short";
      const gateQuantity = Math.abs(gateSize);

      const inconsistencies: string[] = [];

      if (gateSide !== dbPos.side) {
        inconsistencies.push(
          `方向不一致: Gate=${gateSide}, DB=${dbPos.side}`
        );
      }

      if (gateQuantity !== dbPos.quantity) {
        inconsistencies.push(
          `数量不一致: Gate=${gateQuantity}, DB=${dbPos.quantity}`
        );
      }

      if (inconsistencies.length > 0) {
        console.log(`   ⚠️ ${symbol} 存在不一致:`);
        inconsistencies.forEach(msg => console.log(`      - ${msg}`));
      } else {
        console.log(`   ✅ ${symbol} 数据一致`);
      }
    }

    // 4. 检查交易记录
    console.log("\n🔍 步骤4: 检查交易记录...");
    const trades = await dbClient.execute(`
      SELECT * FROM trades 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    console.log(`   ✅ 最近10条交易记录:\n`);

    if (trades.rows.length > 0) {
      for (const row of trades.rows) {
        const trade = row as any;
        const type = trade.type === "open" ? "开仓" : "平仓";
        const side = trade.side === "long" ? "做多 (LONG)" : "做空 (SHORT)";
        const pnl = trade.pnl ? ` | 盈亏: ${Number.parseFloat(trade.pnl) >= 0 ? "+" : ""}${Number.parseFloat(trade.pnl).toFixed(2)} USDT` : "";

        console.log(`   📝 ${trade.timestamp}`);
        console.log(`      ${type} ${trade.symbol} ${side}`);
        console.log(`      价格: ${Number.parseFloat(trade.price).toFixed(4)} | 数量: ${trade.quantity} 张 | 杠杆: ${trade.leverage}x${pnl}`);
        console.log(`      订单ID: ${trade.order_id} | 状态: ${trade.status}\n`);
      }
    } else {
      console.log("   ℹ️ 暂无交易记录\n");
    }

    // 5. 验证交易记录逻辑
    console.log("🔍 步骤5: 验证交易记录的 side 字段逻辑...\n");
    
    const openTrades = await dbClient.execute(`
      SELECT symbol, side, type, quantity FROM trades 
      WHERE type = 'open' 
      ORDER BY timestamp DESC 
      LIMIT 5
    `);

    const closeTrades = await dbClient.execute(`
      SELECT symbol, side, type, quantity, pnl FROM trades 
      WHERE type = 'close' 
      ORDER BY timestamp DESC 
      LIMIT 5
    `);

    if (openTrades.rows.length > 0) {
      console.log("   📊 最近5条开仓记录:");
      for (const row of openTrades.rows) {
        const trade = row as any;
        console.log(`      ${trade.symbol}: side=${trade.side} (${trade.side === "long" ? "开多=买入" : "开空=卖出"}), 数量=${trade.quantity}张`);
      }
      console.log();
    }

    if (closeTrades.rows.length > 0) {
      console.log("   📊 最近5条平仓记录:");
      for (const row of closeTrades.rows) {
        const trade = row as any;
        const pnl = trade.pnl ? Number.parseFloat(trade.pnl).toFixed(2) : "0.00";
        console.log(`      ${trade.symbol}: side=${trade.side} (原持仓方向), 数量=${trade.quantity}张, 盈亏=${pnl}U`);
      }
      console.log();
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ 一致性检查完成");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("📝 说明:");
    console.log("   - trades表中的 side 字段表示持仓方向（long=做多, short=做空）");
    console.log("   - 开仓记录: side=持仓方向，实际执行=long时买入(+size)，short时卖出(-size)");
    console.log("   - 平仓记录: side=原持仓方向，实际执行=long时卖出(-size)，short时买入(+size)");
    console.log("   - Gate.io的size字段: 正数=做多，负数=做空\n");

  } catch (error) {
    console.error("❌ 检查失败:", error);
  }
}

checkConsistency();


