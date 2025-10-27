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
 * 数据库迁移脚本：添加 peak_pnl_percent 字段到 positions 表
 */
import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function addPeakPnlColumn() {
  try {
    console.log("开始数据库迁移：添加 peak_pnl_percent 字段...");
    
    // 检查字段是否已存在
    const tableInfo = await dbClient.execute("PRAGMA table_info(positions)");
    const columnExists = tableInfo.rows.some((row: any) => row.name === "peak_pnl_percent");
    
    if (columnExists) {
      console.log("✅ peak_pnl_percent 字段已存在，无需迁移");
      return;
    }
    
    // 添加字段
    await dbClient.execute(`
      ALTER TABLE positions 
      ADD COLUMN peak_pnl_percent REAL DEFAULT 0
    `);
    
    console.log("✅ 成功添加 peak_pnl_percent 字段到 positions 表");
    
    // 为现有持仓初始化峰值盈亏
    const positions = await dbClient.execute("SELECT * FROM positions");
    
    for (const pos of positions.rows) {
      const entryPrice = Number.parseFloat(pos.entry_price as string);
      const currentPrice = Number.parseFloat(pos.current_price as string);
      const leverage = Number.parseInt(pos.leverage as string);
      const side = pos.side as string;
      
      // 计算当前盈亏百分比
      const priceChangePercent = entryPrice > 0 
        ? ((currentPrice - entryPrice) / entryPrice * 100 * (side === 'long' ? 1 : -1))
        : 0;
      const pnlPercent = priceChangePercent * leverage;
      
      // 初始化峰值为当前盈亏（如果是正数）或0
      const initialPeak = Math.max(pnlPercent, 0);
      
      await dbClient.execute({
        sql: "UPDATE positions SET peak_pnl_percent = ? WHERE symbol = ?",
        args: [initialPeak, pos.symbol],
      });
    }
    
    console.log(`✅ 初始化了 ${positions.rows.length} 个持仓的峰值盈亏百分比`);
    
  } catch (error: any) {
    console.error("❌ 数据库迁移失败:", error.message);
    process.exit(1);
  }
}

addPeakPnlColumn().then(() => {
  console.log("数据库迁移完成");
  process.exit(0);
});

