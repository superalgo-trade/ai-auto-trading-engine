/**
 * 验证数据库 Schema 升级
 * 
 * 功能：
 * 1. 检查 positions 表是否有新增的策略字段
 * 2. 尝试插入测试数据（包含策略信息）
 * 3. 验证数据可以正常读取
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';

const DB_URL = process.env.DATABASE_URL || "file:./.voltagent/trading.db";
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function verifySchemaUpgrade() {
  console.log('🔍 开始验证数据库 Schema 升级...\n');

  const db = createClient({
    url: DB_URL,
    authToken: DB_TOKEN,
  });

  try {
    // 1. 检查 positions 表结构
    console.log('📋 Step 1: 检查 positions 表结构');
    const tableInfo = await db.execute('PRAGMA table_info(positions)');
    
    const requiredFields = ['market_state', 'strategy_type', 'signal_strength', 'opportunity_score'];
    const existingFields = tableInfo.rows.map((row: any) => row.name);
    
    console.log(`   现有字段: ${existingFields.length} 个`);
    
    const missingFields = requiredFields.filter(field => !existingFields.includes(field));
    
    if (missingFields.length > 0) {
      console.error(`   ❌ 缺少字段: ${missingFields.join(', ')}`);
      return false;
    }
    
    console.log(`   ✅ 所有策略字段都已添加\n`);

    // 2. 显示新字段详情
    console.log('📊 Step 2: 新字段详情');
    const newFields = tableInfo.rows.filter((row: any) => requiredFields.includes(row.name));
    for (const field of newFields) {
      console.log(`   - ${field.name}: ${field.type} (nullable: ${field.notnull === 0})`);
    }
    console.log();

    // 3. 测试插入数据（使用事务，最后回滚）
    console.log('🧪 Step 3: 测试插入包含策略信息的数据');
    
    const testData = {
      symbol: 'TEST_BTC_USDT',
      exchange: 'binance',
      side: 'long',
      entryPrice: 50000,
      quantity: 0.01,
      leverage: 3,
      stopLossPrice: 49000,
      takeProfitPrice: 52000,
      status: 'open',
      marketState: 'uptrend_oversold',
      strategyType: 'trend_following',
      signalStrength: 0.85,
      opportunityScore: 78.5
    };

    await db.execute('BEGIN TRANSACTION');
    
    try {
      const result = await db.execute({
        sql: `
          INSERT INTO positions (
            symbol, exchange, side, entry_price, quantity, leverage,
            stop_loss_price, take_profit_price, status,
            market_state, strategy_type, signal_strength, opportunity_score,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            datetime('now'), datetime('now')
          )
        `,
        args: [
          testData.symbol, testData.exchange, testData.side, testData.entryPrice, 
          testData.quantity, testData.leverage, testData.stopLossPrice, testData.takeProfitPrice, 
          testData.status, testData.marketState, testData.strategyType, 
          testData.signalStrength, testData.opportunityScore
        ]
      });
      
      const insertedId = result.lastInsertRowid;
      
      console.log(`   ✅ 插入成功 (ID: ${insertedId})\n`);

      // 4. 验证读取
      console.log('📖 Step 4: 验证数据读取');
      const selectResult = await db.execute(`
        SELECT 
          id, symbol, side, entry_price,
          market_state, strategy_type, signal_strength, opportunity_score
        FROM positions 
        WHERE id = ${insertedId}
      `);
      
      const row = selectResult.rows[0];
      
      if (row) {
        console.log('   读取到的数据:');
        console.log(`   - ID: ${row.id}`);
        console.log(`   - Symbol: ${row.symbol}`);
        console.log(`   - Side: ${row.side}`);
        console.log(`   - Entry Price: ${row.entry_price}`);
        console.log(`   - Market State: ${row.market_state}`);
        console.log(`   - Strategy Type: ${row.strategy_type}`);
        console.log(`   - Signal Strength: ${row.signal_strength}`);
        console.log(`   - Opportunity Score: ${row.opportunity_score}`);
        console.log(`   ✅ 数据读取成功\n`);
      } else {
        console.error('   ❌ 无法读取插入的数据\n');
        return false;
      }

      // 回滚事务（不保留测试数据）
      await db.execute('ROLLBACK');
      console.log('🔄 测试数据已回滚（不影响生产数据）\n');

    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }

    // 5. 统计现有持仓的策略分布
    console.log('📈 Step 5: 现有持仓的策略信息统计');
    const statsResult = await db.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(market_state) as with_market_state,
        COUNT(strategy_type) as with_strategy_type,
        COUNT(signal_strength) as with_signal_strength,
        COUNT(opportunity_score) as with_opportunity_score
      FROM positions
      WHERE status IN ('open', 'partial_close')
    `);
    
    const stats = statsResult.rows[0];
    
    console.log(`   - 当前活跃持仓: ${stats.total} 个`);
    console.log(`   - 有市场状态记录: ${stats.with_market_state} 个`);
    console.log(`   - 有策略类型记录: ${stats.with_strategy_type} 个`);
    console.log(`   - 有信号强度记录: ${stats.with_signal_strength} 个`);
    console.log(`   - 有机会评分记录: ${stats.with_opportunity_score} 个\n`);

    console.log('✅ Schema 升级验证完成！所有测试通过！\n');
    
    return true;

  } catch (error) {
    console.error('❌ 验证过程中出错:', error);
    return false;
  }
}

// 运行验证
verifySchemaUpgrade()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
