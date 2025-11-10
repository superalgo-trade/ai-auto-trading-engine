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
 * 数据库迁移：为 position_close_events 表添加缺失字段
 * 
 * 添加字段：
 * - trigger_type: 触发类型（exchange_order/ai_decision/system_risk/manual_operation）
 * - leverage: 杠杆倍数
 * - fee: 手续费
 * - order_id: 关联订单ID
 */

import { createClient } from '@libsql/client';

const dbClient = createClient({
  url: process.env.DATABASE_URL || 'file:./.voltagent/trading.db',
});

async function migrate() {
  console.log('🔧 开始数据库迁移：添加 trigger_type 等字段到 position_close_events 表...');
  
  try {
    // 1. 检查表是否存在
    const tableCheck = await dbClient.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='position_close_events'`,
    });
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️  position_close_events 表不存在，跳过迁移');
      return;
    }
    
    // 2. 检查字段是否已存在
    const columnsCheck = await dbClient.execute({
      sql: `PRAGMA table_info(position_close_events)`,
    });
    
    const existingColumns = new Set(
      columnsCheck.rows.map((row: any) => row.name)
    );
    
    console.log('📋 现有字段:', Array.from(existingColumns).join(', '));
    
    // 3. 添加缺失的字段
    const fieldsToAdd = [
      { name: 'trigger_type', sql: 'ALTER TABLE position_close_events ADD COLUMN trigger_type TEXT' },
      { name: 'leverage', sql: 'ALTER TABLE position_close_events ADD COLUMN leverage INTEGER' },
      { name: 'fee', sql: 'ALTER TABLE position_close_events ADD COLUMN fee REAL' },
      { name: 'order_id', sql: 'ALTER TABLE position_close_events ADD COLUMN order_id TEXT' },
    ];
    
    for (const field of fieldsToAdd) {
      if (existingColumns.has(field.name)) {
        console.log(`✅ 字段 ${field.name} 已存在，跳过`);
      } else {
        console.log(`➕ 添加字段 ${field.name}...`);
        await dbClient.execute(field.sql);
        console.log(`✅ 字段 ${field.name} 添加成功`);
      }
    }
    
    // 4. 为已有记录设置默认值
    console.log('\n📝 为已有记录设置默认值...');
    
    // 根据 close_reason 推断 trigger_type
    await dbClient.execute({
      sql: `UPDATE position_close_events 
            SET trigger_type = CASE 
              WHEN close_reason IN ('stop_loss_triggered', 'take_profit_triggered', 'trailing_stop') THEN 'exchange_order'
              WHEN close_reason = 'forced_close' THEN 'system_risk'
              ELSE 'ai_decision'
            END
            WHERE trigger_type IS NULL`,
    });
    
    // 设置默认杠杆倍数为 1
    await dbClient.execute({
      sql: `UPDATE position_close_events SET leverage = 1 WHERE leverage IS NULL`,
    });
    
    // 设置默认手续费为 0
    await dbClient.execute({
      sql: `UPDATE position_close_events SET fee = 0 WHERE fee IS NULL`,
    });
    
    console.log('✅ 默认值设置完成');
    
    // 5. 验证迁移结果
    console.log('\n🔍 验证迁移结果...');
    const afterCheck = await dbClient.execute({
      sql: `PRAGMA table_info(position_close_events)`,
    });
    
    console.log('📋 迁移后的字段列表:');
    afterCheck.rows.forEach((row: any) => {
      console.log(`  - ${row.name} (${row.type})`);
    });
    
    // 显示统计信息
    const countResult = await dbClient.execute({
      sql: `SELECT COUNT(*) as total FROM position_close_events`,
    });
    
    const total = (countResult.rows[0] as any).total;
    console.log(`\n📊 表中共有 ${total} 条记录`);
    
    if (total > 0) {
      const typesResult = await dbClient.execute({
        sql: `SELECT trigger_type, COUNT(*) as count 
              FROM position_close_events 
              GROUP BY trigger_type`,
      });
      
      console.log('\n📈 按触发类型统计:');
      typesResult.rows.forEach((row: any) => {
        console.log(`  - ${row.trigger_type || 'NULL'}: ${row.count} 条`);
      });
    }
    
    console.log('\n✅ 数据库迁移完成！');
    
  } catch (error: any) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    dbClient.close();
  }
}

migrate();
