/**
 * 数据库迁移：为 position_close_events 添加唯一约束
 * 防止重复插入同一个条件单的平仓事件
 */

import "dotenv/config";
import { createClient } from "@libsql/client";

async function migrate() {
  const dbUrl = process.env.DATABASE_URL || "file:./.voltagent/trading.db";
  const client = createClient({ url: dbUrl });

  console.log("🔧 开始数据库迁移：为 position_close_events 添加唯一约束...\n");

  try {
    // 步骤1：检查并清理重复记录
    console.log("📊 步骤1: 检查重复的平仓事件记录...");
    
    const duplicates = await client.execute(`
      SELECT trigger_order_id, COUNT(*) as count 
      FROM position_close_events 
      WHERE trigger_order_id IS NOT NULL AND trigger_order_id != ''
      GROUP BY trigger_order_id 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (duplicates.rows.length > 0) {
      console.log(`⚠️  发现 ${duplicates.rows.length} 个重复的条件单ID，开始清理...\n`);
      
      for (const dup of duplicates.rows) {
        const orderId = dup.trigger_order_id as string;
        const count = dup.count as number;
        
        console.log(`  处理重复: trigger_order_id=${orderId}, 重复次数=${count}`);
        
        // 获取所有相同order_id的记录，按创建时间排序
        const records = await client.execute({
          sql: `SELECT id, created_at, close_reason, pnl FROM position_close_events 
                WHERE trigger_order_id = ? 
                ORDER BY created_at ASC`,
          args: [orderId]
        });
        
        if (records.rows.length > 1) {
          // 保留第一条（最早的），删除其他
          const keepId = records.rows[0].id;
          const deleteIds = records.rows.slice(1).map(r => r.id);
          
          console.log(`    保留ID=${keepId}, 删除ID=[${deleteIds.join(', ')}]`);
          
          for (const deleteId of deleteIds) {
            await client.execute({
              sql: 'DELETE FROM position_close_events WHERE id = ?',
              args: [deleteId]
            });
          }
          
          console.log(`    ✅ 已删除 ${deleteIds.length} 条重复记录\n`);
        }
      }
      
      console.log("✅ 重复记录清理完成\n");
    } else {
      console.log("✅ 未发现重复记录，无需清理\n");
    }

    // 步骤2：添加唯一索引（作为唯一约束）
    console.log("📊 步骤2: 添加唯一索引...");
    
    try {
      // 先检查索引是否已存在
      const indexExists = await client.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name='idx_close_events_trigger_order_unique'
      `);
      
      if (indexExists.rows.length === 0) {
        // SQLite 不支持直接添加 UNIQUE 约束到现有表，需要通过唯一索引实现
        await client.execute(`
          CREATE UNIQUE INDEX idx_close_events_trigger_order_unique 
          ON position_close_events(trigger_order_id) 
          WHERE trigger_order_id IS NOT NULL AND trigger_order_id != ''
        `);
        console.log("✅ 唯一索引已创建\n");
      } else {
        console.log("ℹ️  唯一索引已存在，跳过创建\n");
      }
    } catch (error: any) {
      if (error.message && error.message.includes('already exists')) {
        console.log("ℹ️  唯一索引已存在\n");
      } else {
        throw error;
      }
    }

    // 步骤3：验证迁移结果
    console.log("📊 步骤3: 验证迁移结果...");
    
    const totalEvents = await client.execute(
      'SELECT COUNT(*) as count FROM position_close_events'
    );
    const totalCount = (totalEvents.rows[0] as any).count;
    
    const uniqueOrderIds = await client.execute(`
      SELECT COUNT(DISTINCT trigger_order_id) as count 
      FROM position_close_events 
      WHERE trigger_order_id IS NOT NULL AND trigger_order_id != ''
    `);
    const uniqueCount = (uniqueOrderIds.rows[0] as any).count;
    
    console.log(`  总平仓事件记录数: ${totalCount}`);
    console.log(`  唯一条件单ID数: ${uniqueCount}`);
    
    // 再次检查是否还有重复
    const stillDuplicates = await client.execute(`
      SELECT COUNT(*) as count FROM (
        SELECT trigger_order_id, COUNT(*) as cnt 
        FROM position_close_events 
        WHERE trigger_order_id IS NOT NULL AND trigger_order_id != ''
        GROUP BY trigger_order_id 
        HAVING COUNT(*) > 1
      )
    `);
    const dupCount = (stillDuplicates.rows[0] as any).count;
    
    if (dupCount > 0) {
      console.log(`⚠️  仍有 ${dupCount} 个重复记录，可能需要手动清理`);
    } else {
      console.log("✅ 验证通过：无重复记录");
    }

    console.log("\n✅ 数据库迁移完成！");
    console.log("📌 说明：唯一索引将防止同一个条件单ID重复插入平仓事件表");
    
    client.close();
  } catch (error) {
    console.error("❌ 迁移失败:", error);
    client.close();
    process.exit(1);
  }
}

migrate().catch(console.error);
