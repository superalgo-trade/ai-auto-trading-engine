#!/usr/bin/env node
/**
 * 修复数据库中带时区偏移的时间戳
 * 将 +08:00 格式转换为 UTC 格式 (Z)
 */

import { createClient } from '@libsql/client';

async function fixTimestamps() {
  const dbClient = createClient({
    url: process.env.DATABASE_URL || 'file:./.voltagent/trading.db',
  });

  console.log('🔍 查找需要修复的时间戳...');

  // 查找所有带 +08:00 的记录
  const result = await dbClient.execute({
    sql: `SELECT id, symbol, type, timestamp FROM trades WHERE timestamp LIKE '%+08:00'`,
  });

  console.log(`📊 找到 ${result.rows.length} 条需要修复的记录`);

  if (result.rows.length === 0) {
    console.log('✅ 没有需要修复的记录');
    return;
  }

  let fixed = 0;
  for (const row of result.rows) {
    const id = row.id;
    const oldTimestamp = row.timestamp;
    
    // 解析带时区的时间戳，转换为 UTC
    // 例如: 2025-11-21T10:56:03+08:00 → 2025-11-21T02:56:03.000Z
    const date = new Date(oldTimestamp);
    const newTimestamp = date.toISOString();
    
    console.log(`  ID ${id}: ${oldTimestamp} → ${newTimestamp}`);
    
    // 更新数据库
    await dbClient.execute({
      sql: `UPDATE trades SET timestamp = ? WHERE id = ?`,
      args: [newTimestamp, id],
    });
    
    fixed++;
  }

  console.log(`\n✅ 成功修复 ${fixed} 条记录`);
  
  // 验证修复结果
  const checkResult = await dbClient.execute({
    sql: `SELECT COUNT(*) as count FROM trades WHERE timestamp LIKE '%+08:00'`,
  });
  
  const remaining = checkResult.rows[0].count;
  console.log(`📊 剩余未修复: ${remaining} 条`);
  
  if (remaining === 0) {
    console.log('🎉 所有时间戳已统一为 UTC 格式！');
  }
}

fixTimestamps().catch(console.error);
