/**
 * ai-auto-trading - AI 加密货币自动交易系统
 * Copyright (C) 2025 losesky
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
 * 数据库迁移: 添加positions表的metadata字段
 * 用于存储入场时的市场状态等元数据
 */

import { createClient } from "@libsql/client";
import { createLogger } from "../utils/logger";

const logger = createLogger({
  name: "migrate-add-metadata",
  level: "info",
});

async function migrate() {
  const dbClient = createClient({
    url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  });

  try {
    logger.info("开始迁移: 添加positions表的metadata字段...");

    // 检查字段是否已存在
    const tableInfo = await dbClient.execute({
      sql: "PRAGMA table_info(positions)",
      args: [],
    });

    const hasMetadata = tableInfo.rows.some((row: any) => row.name === 'metadata');

    if (hasMetadata) {
      logger.info("✅ metadata字段已存在，无需迁移");
      return;
    }

    // 添加metadata字段
    await dbClient.execute({
      sql: "ALTER TABLE positions ADD COLUMN metadata TEXT",
      args: [],
    });

    logger.info("✅ 成功添加metadata字段到positions表");
    logger.info("字段用途: 存储JSON格式的元数据，如开仓时的市场状态");
  } catch (error) {
    logger.error("❌ 迁移失败:", error);
    throw error;
  }
}

// 执行迁移
migrate()
  .then(() => {
    logger.info("迁移完成");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("迁移失败:", error);
    process.exit(1);
  });

export { migrate };
