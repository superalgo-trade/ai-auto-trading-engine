#!/usr/bin/env tsx
/**
 * 修复trades表中的时间戳格式
 * 统一转换为UTC ISO格式
 */

import { createClient } from "@libsql/client";

const dbClient = createClient({
  url: process.env.DATABASE_URL || "file:./.voltagent/trading.db",
});

async function fixTimestamps() {
  console.log("开始修复trades表时间戳格式...\n");

  // 1. 查询所有trades记录
  const result = await dbClient.execute("SELECT id, timestamp FROM trades");
  
  console.log(`找到 ${result.rows.length} 条交易记录\n`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const row of result.rows) {
    const id = row.id;
    const oldTimestamp = row.timestamp as string;
    
    try {
      // 尝试解析时间戳
      const date = new Date(oldTimestamp);
      
      if (isNaN(date.getTime())) {
        console.log(`❌ 记录 ${id}: 无效的时间戳 "${oldTimestamp}"`);
        errorCount++;
        continue;
      }
      
      // 转换为UTC ISO格式
      const newTimestamp = date.toISOString();
      
      // 只更新格式不同的记录
      if (oldTimestamp !== newTimestamp) {
        await dbClient.execute({
          sql: "UPDATE trades SET timestamp = ? WHERE id = ?",
          args: [newTimestamp, id]
        });
        
        console.log(`✅ 记录 ${id}: ${oldTimestamp} -> ${newTimestamp}`);
        fixedCount++;
      }
    } catch (error: any) {
      console.log(`❌ 记录 ${id}: 处理失败 - ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n修复完成:`);
  console.log(`  ✅ 已修复: ${fixedCount} 条`);
  console.log(`  ❌ 失败: ${errorCount} 条`);
  console.log(`  ⏭️  跳过: ${result.rows.length - fixedCount - errorCount} 条`);
}

fixTimestamps()
  .then(() => {
    console.log("\n✅ 时间戳格式修复完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 修复失败:", error);
    process.exit(1);
  });
