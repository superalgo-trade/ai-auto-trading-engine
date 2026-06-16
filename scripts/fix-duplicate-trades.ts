#!/usr/bin/env tsx
/**
 * 修复重复的交易记录
 * 问题：条件单监控服务在早期版本中存在重复检测bug，导致同一笔成交被记录多次
 * 解决方案：保留每个order_id的第一条记录（最早的），删除重复的
 */

import { createClient } from '@libsql/client';
import { createLogger } from '../src/utils/logger';

const logger = createLogger({ name: 'fix-duplicate-trades', level: 'info' });

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'file:./.voltagent/trading.db';
  const dbClient = createClient({ url: dbUrl });
  
  logger.info('🔍 开始检查重复的交易记录...');
  
  try {
    // 1. 查找重复的订单ID
    const duplicates = await dbClient.execute(`
      SELECT order_id, symbol, COUNT(*) as count 
      FROM trades 
      WHERE type = 'close'
      GROUP BY order_id 
      HAVING count > 1
      ORDER BY count DESC
    `);
    
    if (duplicates.rows.length === 0) {
      logger.info('✅ 没有发现重复的交易记录');
      process.exit(0);
    }
    
    logger.info(`⚠️ 发现 ${duplicates.rows.length} 个重复的订单ID:`);
    duplicates.rows.forEach(row => {
      logger.info(`   - ${row.order_id} (${row.symbol}): ${row.count}条记录`);
    });
    
    // 2. 对每个重复的订单ID，保留最早的记录，删除其他
    let totalDeleted = 0;
    
    for (const dup of duplicates.rows) {
      const orderId = dup.order_id as string;
      
      // 获取该订单ID的所有记录
      const records = await dbClient.execute({
        sql: 'SELECT id, timestamp FROM trades WHERE order_id = ? ORDER BY timestamp ASC',
        args: [orderId]
      });
      
      if (records.rows.length <= 1) continue;
      
      // 保留第一条，删除其他
      const keepId = records.rows[0].id;
      const deleteIds = records.rows.slice(1).map(r => r.id);
      
      logger.info(`📝 订单 ${orderId}: 保留ID=${keepId}, 删除${deleteIds.length}条重复记录`);
      
      for (const delId of deleteIds) {
        await dbClient.execute({
          sql: 'DELETE FROM trades WHERE id = ?',
          args: [delId]
        });
      }
      
      totalDeleted += deleteIds.length;
    }
    
    // 3. 同样处理 position_close_events 表的重复
    const duplicateEvents = await dbClient.execute(`
      SELECT trigger_order_id, symbol, COUNT(*) as count 
      FROM position_close_events 
      WHERE trigger_order_id IS NOT NULL
      GROUP BY trigger_order_id 
      HAVING count > 1
      ORDER BY count DESC
    `);
    
    if (duplicateEvents.rows.length > 0) {
      logger.info(`⚠️ 发现 ${duplicateEvents.rows.length} 个重复的平仓事件记录`);
      
      for (const dup of duplicateEvents.rows) {
        const triggerOrderId = dup.trigger_order_id as string;
        
        const eventRecords = await dbClient.execute({
          sql: 'SELECT id, created_at FROM position_close_events WHERE trigger_order_id = ? ORDER BY created_at ASC',
          args: [triggerOrderId]
        });
        
        if (eventRecords.rows.length <= 1) continue;
        
        const keepId = eventRecords.rows[0].id;
        const deleteIds = eventRecords.rows.slice(1).map(r => r.id);
        
        logger.info(`📝 平仓事件 ${triggerOrderId}: 保留ID=${keepId}, 删除${deleteIds.length}条重复记录`);
        
        for (const delId of deleteIds) {
          await dbClient.execute({
            sql: 'DELETE FROM position_close_events WHERE id = ?',
            args: [delId]
          });
        }
        
        totalDeleted += deleteIds.length;
      }
    }
    
    logger.info(`✅ 清理完成！共删除 ${totalDeleted} 条重复记录`);
    
    // 4. 显示修复后的统计
    const afterStats = await dbClient.execute('SELECT COUNT(*) as count FROM trades WHERE type = "close"');
    logger.info(`📊 当前平仓交易记录数: ${afterStats.rows[0].count}`);
    
  } catch (error: any) {
    logger.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    dbClient.close();
  }
}

main();
