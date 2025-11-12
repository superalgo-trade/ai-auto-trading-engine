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
 * 数据一致性检查服务
 * 定期检查数据库与交易所状态的一致性，自动清理不一致的数据
 * 
 * 检查内容:
 * 1. 数据库持仓 vs 交易所实际持仓
 * 2. 活跃条件单 vs 交易所实际条件单
 * 3. 孤儿条件单（持仓已平但条件单仍活跃）
 * 4. 测试数据残留清理
 */

import { createLogger } from "../utils/logger";
import type { Client } from "@libsql/client";
import type { IExchangeClient } from "../exchanges/IExchangeClient";

const logger = createLogger({
  name: "data-consistency-check",
  level: "info",
});

interface InconsistentData {
  orphanPositions: Array<{ symbol: string; side: string; dbSize: number; exchangeSize: number }>;
  orphanPriceOrders: Array<{ id: number; order_id: string; symbol: string; type: string }>;
  testDataPositions: Array<{ symbol: string; side: string }>;
  missingPositions: Array<{ contract: string; size: number }>;
}

export class DataConsistencyChecker {
  private dbClient: Client;
  private exchangeClient: IExchangeClient;
  private checkIntervalMs: number;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    dbClient: Client,
    exchangeClient: IExchangeClient,
    checkIntervalMinutes: number = 15 // 默认每15分钟检查一次
  ) {
    this.dbClient = dbClient;
    this.exchangeClient = exchangeClient;
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000;
  }

  /**
   * 启动定期检查
   */
  public start() {
    if (this.isRunning) {
      logger.warn("数据一致性检查已在运行中");
      return;
    }

    logger.info(`🔍 启动数据一致性检查服务，检查间隔: ${this.checkIntervalMs / 60000} 分钟`);
    
    // 立即执行一次检查
    this.runCheck();

    // 设置定期检查
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.checkIntervalMs);

    this.isRunning = true;
  }

  /**
   * 停止定期检查
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    logger.info("数据一致性检查服务已停止");
  }

  /**
   * 执行一次完整的一致性检查
   */
  private async runCheck() {
    logger.info("======================================");
    logger.info("🔍 开始数据一致性检查");
    logger.info("======================================");

    try {
      const inconsistencies = await this.checkConsistency();
      
      if (this.hasInconsistencies(inconsistencies)) {
        logger.warn("⚠️ 发现数据不一致，开始自动修复...");
        await this.fixInconsistencies(inconsistencies);
        logger.info("✅ 数据一致性修复完成");
      } else {
        logger.info("✅ 数据一致性检查通过，无需修复");
      }
    } catch (error: any) {
      logger.error("❌ 数据一致性检查失败:", error);
    }

    logger.info("======================================");
  }

  /**
   * 检查数据一致性
   */
  private async checkConsistency(): Promise<InconsistentData> {
    const result: InconsistentData = {
      orphanPositions: [],
      orphanPriceOrders: [],
      testDataPositions: [],
      missingPositions: []
    };

    // 1. 获取交易所实际持仓
    const exchangePositions = await this.exchangeClient.getPositions();
    logger.info(`交易所持仓数: ${exchangePositions.length}`);

    // 2. 获取数据库持仓
    const dbPositionsResult = await this.dbClient.execute({
      sql: `SELECT symbol, side, quantity FROM positions ORDER BY symbol`
    });
    logger.info(`数据库持仓数: ${dbPositionsResult.rows.length}`);

    // 3. 检查数据库持仓是否在交易所存在
    for (const dbPos of dbPositionsResult.rows) {
      const symbol = dbPos.symbol as string;
      const side = dbPos.side as string;
      const dbQty = Math.abs(parseFloat(dbPos.quantity as string));
      const contract = this.exchangeClient.normalizeContract(symbol);

      const exchangePos = exchangePositions.find(p => p.contract === contract);
      const exchangeSize = exchangePos ? Math.abs(parseFloat(exchangePos.size || '0')) : 0;

      // 检查是否是测试数据（包含_TEST、test等标识）
      const isTestData = symbol.includes('_TEST') || 
                        symbol.includes('test') || 
                        symbol.includes('TEST');
      
      if (isTestData) {
        result.testDataPositions.push({ symbol, side });
        logger.debug(`发现测试数据: ${symbol} ${side}`);
        continue;
      }

      // 持仓数量不一致或交易所已无持仓
      if (exchangeSize === 0 || Math.abs(exchangeSize - dbQty) > 0.0001) {
        result.orphanPositions.push({
          symbol,
          side,
          dbSize: dbQty,
          exchangeSize
        });
        logger.debug(`持仓不一致: ${symbol} ${side}, DB=${dbQty}, Exchange=${exchangeSize}`);
      }
    }

    // 4. 检查交易所持仓是否在数据库存在
    for (const exchangePos of exchangePositions) {
      const contract = exchangePos.contract;
      const size = Math.abs(parseFloat(exchangePos.size || '0'));
      
      if (size < 0.0001) continue; // 忽略零持仓

      const dbPos = dbPositionsResult.rows.find(p => {
        const dbSymbol = this.exchangeClient.normalizeContract(p.symbol as string);
        return dbSymbol === contract;
      });

      if (!dbPos) {
        result.missingPositions.push({ contract, size });
        logger.debug(`数据库缺失持仓: ${contract}, size=${size}`);
      }
    }

    // 5. 检查孤儿条件单（持仓已平但条件单仍活跃）
    const activePriceOrders = await this.dbClient.execute({
      sql: `SELECT id, order_id, symbol, side, type FROM price_orders WHERE status = 'active'`
    });
    
    for (const order of activePriceOrders.rows) {
      const symbol = order.symbol as string;
      const side = order.side as string;

      // 检查对应的持仓是否存在
      const positionExists = dbPositionsResult.rows.some(p => 
        p.symbol === symbol && p.side === side
      );

      if (!positionExists) {
        result.orphanPriceOrders.push({
          id: order.id as number,
          order_id: order.order_id as string,
          symbol,
          type: order.type as string
        });
        logger.debug(`孤儿条件单: ${order.order_id} ${symbol} ${order.type}`);
      }
    }

    // 输出统计
    logger.info(`检查结果:`);
    logger.info(`  - 孤儿持仓: ${result.orphanPositions.length}`);
    logger.info(`  - 孤儿条件单: ${result.orphanPriceOrders.length}`);
    logger.info(`  - 测试数据: ${result.testDataPositions.length}`);
    logger.info(`  - 数据库缺失持仓: ${result.missingPositions.length}`);

    return result;
  }

  /**
   * 判断是否有不一致数据
   */
  private hasInconsistencies(data: InconsistentData): boolean {
    return data.orphanPositions.length > 0 ||
           data.orphanPriceOrders.length > 0 ||
           data.testDataPositions.length > 0 ||
           data.missingPositions.length > 0;
  }

  /**
   * 修复数据不一致
   */
  private async fixInconsistencies(data: InconsistentData) {
    // 1. 清理孤儿持仓（交易所已无持仓，但数据库仍有记录）
    for (const orphan of data.orphanPositions) {
      if (orphan.exchangeSize === 0) {
        logger.info(`🧹 清理孤儿持仓: ${orphan.symbol} ${orphan.side}`);
        await this.removePosition(orphan.symbol, orphan.side);
        
        // 同时取消相关的活跃条件单
        await this.cancelRelatedPriceOrders(orphan.symbol, orphan.side);
      } else {
        logger.warn(`⚠️ 持仓数量不一致: ${orphan.symbol} ${orphan.side}, DB=${orphan.dbSize}, Exchange=${orphan.exchangeSize}`);
        logger.warn(`   建议手动检查并修正`);
      }
    }

    // 2. 清理孤儿条件单
    for (const orphan of data.orphanPriceOrders) {
      logger.info(`🧹 清理孤儿条件单: ${orphan.order_id} ${orphan.symbol} ${orphan.type}`);
      
      // 尝试从交易所取消
      try {
        const contract = this.exchangeClient.normalizeContract(orphan.symbol);
        await this.exchangeClient.cancelOrder(orphan.order_id);
        logger.info(`  ✅ 已从交易所取消`);
      } catch (error: any) {
        logger.debug(`  ⚠️ 交易所取消失败（订单可能已不存在）: ${error.message}`);
      }

      // 更新数据库状态
      await this.updatePriceOrderStatus(orphan.order_id, 'cancelled');
    }

    // 3. 清理测试数据
    for (const testData of data.testDataPositions) {
      logger.info(`🧹 清理测试持仓: ${testData.symbol} ${testData.side}`);
      await this.removePosition(testData.symbol, testData.side);
      await this.cancelRelatedPriceOrders(testData.symbol, testData.side);
    }

    // 4. 处理数据库缺失的持仓
    if (data.missingPositions.length > 0) {
      logger.warn(`⚠️ 交易所有 ${data.missingPositions.length} 个持仓未在数据库记录`);
      for (const missing of data.missingPositions) {
        logger.warn(`   - ${missing.contract}: ${missing.size}`);
      }
      logger.warn(`   这些持仓可能是手动开仓或系统异常导致，请手动检查`);
    }
  }

  /**
   * 删除持仓记录
   */
  private async removePosition(symbol: string, side: string) {
    try {
      await this.dbClient.execute({
        sql: `DELETE FROM positions WHERE symbol = ? AND side = ?`,
        args: [symbol, side]
      });
      logger.debug(`  ✅ 已删除持仓记录`);
    } catch (error: any) {
      logger.error(`  ❌ 删除持仓记录失败:`, error);
    }
  }

  /**
   * 取消相关的活跃条件单
   */
  private async cancelRelatedPriceOrders(symbol: string, side: string) {
    try {
      const result = await this.dbClient.execute({
        sql: `SELECT order_id FROM price_orders 
              WHERE symbol = ? AND side = ? AND status = 'active'`,
        args: [symbol, side]
      });

      for (const row of result.rows) {
        const orderId = row.order_id as string;
        
        // 尝试从交易所取消
        try {
          const contract = this.exchangeClient.normalizeContract(symbol);
          await this.exchangeClient.cancelOrder(orderId);
          logger.debug(`  ✅ 已从交易所取消条件单: ${orderId}`);
        } catch (error: any) {
          logger.debug(`  ⚠️ 交易所取消失败: ${error.message}`);
        }

        // 更新数据库状态
        await this.updatePriceOrderStatus(orderId, 'cancelled');
      }
    } catch (error: any) {
      logger.error(`  ❌ 取消相关条件单失败:`, error);
    }
  }

  /**
   * 更新条件单状态
   */
  private async updatePriceOrderStatus(orderId: string, status: 'cancelled') {
    try {
      const now = new Date().toISOString();
      await this.dbClient.execute({
        sql: `UPDATE price_orders 
              SET status = ?, updated_at = ?
              WHERE order_id = ?`,
        args: [status, now, orderId]
      });
      logger.debug(`  ✅ 已更新条件单状态: ${orderId} -> ${status}`);
    } catch (error: any) {
      logger.error(`  ❌ 更新条件单状态失败:`, error);
    }
  }

  /**
   * 手动触发一次检查（用于测试或按需检查）
   */
  public async runManualCheck() {
    await this.runCheck();
  }
}
