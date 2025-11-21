#!/usr/bin/env ts-node
/**
 * 数据库迁移脚本：为 position_close_events 表添加 position_order_id 字段
 * 
 * 目的：解决平仓事件无法关联到具体持仓的问题，使AI能够准确区分不同持仓的平仓历史
 * 
 * 迁移步骤：
 * 1. 添加 position_order_id 列
 * 2. 尝试从 position_history 回填历史数据
 * 3. 创建索引以优化查询性能
 */

import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
  syncUrl: process.env.DATABASE_SYNC_URL,
  syncInterval: 1000,
});

async function migrate() {
  try {
    console.log('开始迁移：为 position_close_events 添加 position_order_id 字段...');
    
    // 1. 检查表是否存在
    const tableCheck = await dbClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='position_close_events'"
    );

    if (tableCheck.rows.length === 0) {
      console.log("⚠️ 表 position_close_events 不存在，跳过迁移");
      return;
    }
    
    // 2. 检查是否已存在该列
    const tableInfo = await dbClient.execute("PRAGMA table_info(position_close_events)");
    const hasPositionOrderId = tableInfo.rows.some((row: any) => row.name === 'position_order_id');
    
    if (hasPositionOrderId) {
      console.log('✅ position_order_id 列已存在，跳过添加列步骤');
    } else {
      console.log('添加 position_order_id 列...');
      await dbClient.execute("ALTER TABLE position_close_events ADD COLUMN position_order_id TEXT");
      console.log('✅ position_order_id 列添加成功');
    }
    
    // 3. 尝试从 position_history 回填数据
    console.log('开始回填 position_order_id...');
    
    // 统计需要回填的记录数
    const nullCount = await dbClient.execute(`
      SELECT COUNT(*) as count 
      FROM position_close_events 
      WHERE position_order_id IS NULL
    `);
    
    const nullCountValue = Number(nullCount.rows[0]?.count || 0);
    console.log(`找到 ${nullCountValue} 条需要回填的记录`);
    
    if (nullCountValue > 0) {
      console.log('策略1：尝试从 positions 表匹配当前活跃持仓');
      console.log('策略2：尝试从 trades 表匹配开仓订单');
      console.log('策略3：对于无法匹配的记录，使用 order_id 或 close_trade_id 作为标识');
      
      // 由于libsql不支持复杂的UPDATE子查询，我们分步处理
      // 1. 先获取所有需要回填的记录
      const recordsToUpdate = await dbClient.execute(`
        SELECT id, symbol, side, entry_price, created_at, order_id, close_trade_id
        FROM position_close_events 
        WHERE position_order_id IS NULL
      `);
      
      let updatedCount = 0;
      
      // 2. 逐条查找匹配的持仓并更新
      for (const record of recordsToUpdate.rows) {
        let positionOrderId = null;
        
        // 策略1: 从 positions 表匹配（当前活跃持仓）
        const matchFromPositions = await dbClient.execute({
          sql: `
            SELECT entry_order_id
            FROM positions
            WHERE symbol = ?
              AND side = ?
              AND ABS(entry_price - ?) < 0.0001
            LIMIT 1
          `,
          args: [record.symbol, record.side, record.entry_price]
        });
        
        if (matchFromPositions.rows.length > 0 && matchFromPositions.rows[0].entry_order_id) {
          positionOrderId = matchFromPositions.rows[0].entry_order_id;
        }
        
        // 策略2: 从 trades 表匹配（开仓交易记录）
        if (!positionOrderId) {
          const matchFromTrades = await dbClient.execute({
            sql: `
              SELECT order_id
              FROM trades
              WHERE symbol = ?
                AND side = ?
                AND type = 'OPEN'
                AND ABS(price - ?) < 0.0001
                AND datetime(timestamp) <= datetime(?)
              ORDER BY datetime(timestamp) DESC
              LIMIT 1
            `,
            args: [record.symbol, record.side, record.entry_price, record.created_at]
          });
          
          if (matchFromTrades.rows.length > 0 && matchFromTrades.rows[0].order_id) {
            positionOrderId = matchFromTrades.rows[0].order_id;
          }
        }
        
        // 策略3: 使用 order_id 或 close_trade_id 作为兜底
        if (!positionOrderId) {
          positionOrderId = record.order_id || record.close_trade_id || `unknown_${record.symbol}_${record.id}`;
        }
        
        // 更新记录
        if (positionOrderId) {
          await dbClient.execute({
            sql: "UPDATE position_close_events SET position_order_id = ? WHERE id = ?",
            args: [positionOrderId, record.id]
          });
          updatedCount++;
        }
      }
      
      console.log(`✅ 成功回填 ${updatedCount} 条记录的 position_order_id`);
      
      // 检查仍然为NULL的记录
      const remainingNull = await dbClient.execute(`
        SELECT COUNT(*) as count 
        FROM position_close_events 
        WHERE position_order_id IS NULL
      `);
      
      const remainingNullCount = Number(remainingNull.rows[0]?.count || 0);
      
      if (remainingNullCount > 0) {
        console.log(`⚠️ 仍有 ${remainingNullCount} 条记录无法匹配到 position_order_id`);
        console.log('这些记录可能是已删除持仓的平仓事件，将保持为NULL');
        
        // 显示一些无法匹配的示例
        const examples = await dbClient.execute(`
          SELECT id, symbol, side, entry_price, created_at
          FROM position_close_events 
          WHERE position_order_id IS NULL
          LIMIT 5
        `);
        
        if (examples.rows.length > 0) {
          console.log('无法匹配的示例：');
          examples.rows.forEach((ex: any) => {
            console.log(`  ID=${ex.id} ${ex.symbol} ${ex.side} entry_price=${ex.entry_price} time=${ex.created_at}`);
          });
        }
      }
    } else {
      console.log('✅ 所有记录都已有 position_order_id，无需回填');
    }
    
    // 4. 创建索引
    console.log('创建索引...');
    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_close_events_position_order_id 
      ON position_close_events(position_order_id)
    `);
    console.log('✅ 索引创建成功');
    
    // 5. 验证迁移结果
    console.log('\n迁移结果验证：');
    
    const stats = await dbClient.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN position_order_id IS NOT NULL THEN 1 ELSE 0 END) as with_position_id,
        SUM(CASE WHEN position_order_id IS NULL THEN 1 ELSE 0 END) as without_position_id
      FROM position_close_events
    `);
    
    const statsRow = stats.rows[0];
    console.log(`  总记录数: ${statsRow.total}`);
    console.log(`  有 position_order_id: ${statsRow.with_position_id} (${Number(statsRow.total) > 0 ? (Number(statsRow.with_position_id) / Number(statsRow.total) * 100).toFixed(1) : 0}%)`);
    console.log(`  无 position_order_id: ${statsRow.without_position_id} (${Number(statsRow.total) > 0 ? (Number(statsRow.without_position_id) / Number(statsRow.total) * 100).toFixed(1) : 0}%)`);
    
    console.log('\n✅ 迁移完成！');
    
  } catch (error: any) {
    console.error('迁移失败:', error.message);
    throw error;
  }
}

// 运行迁移
migrate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
