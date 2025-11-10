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
 * 查询 AI 决策记录脚本
 * 
 * 用法：
 *   tsx scripts/query-decisions.ts [选项]
 * 
 * 选项：
 *   --limit <数量>     显示最近的 N 条记录（默认：10）
 *   --full            显示完整的决策内容（包括市场分析）
 *   --id <ID>         查询指定 ID 的决策记录
 *   --date <日期>     查询指定日期的决策记录（格式：YYYY-MM-DD）
 * 
 * 示例：
 *   npx tsx scripts/query-decisions.ts                    # 查询最近 10 条记录
 *   npx tsx scripts/query-decisions.ts --limit 20         # 查询最近 20 条记录
 *   npx tsx scripts/query-decisions.ts --full             # 查询最近 10 条记录（含完整内容）
 *   npx tsx scripts/query-decisions.ts --id 123           # 查询 ID 为 123 的记录
 *   npx tsx scripts/query-decisions.ts --date 2025-11-10  # 查询 2025-11-10 的记录
 */

import { createClient } from '@libsql/client';

const dbClient = createClient({
  url: process.env.DATABASE_URL || 'file:./.voltagent/trading.db',
});

interface AgentDecision {
  id: number;
  timestamp: string;
  iteration: number;
  market_analysis: string;
  decision: string;
  actions_taken: string;
  account_value: number;
  positions_count: number;
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    limit: number;
    full: boolean;
    id?: number;
    date?: string;
  } = {
    limit: 10,
    full: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[++i]);
        break;
      case '--full':
        options.full = true;
        break;
      case '--id':
        options.id = parseInt(args[++i]);
        break;
      case '--date':
        options.date = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
查询 AI 决策记录脚本

用法：
  tsx scripts/query-decisions.ts [选项]

选项：
  --limit <数量>     显示最近的 N 条记录（默认：10）
  --full            显示完整的决策内容（包括市场分析）
  --id <ID>         查询指定 ID 的决策记录
  --date <日期>     查询指定日期的决策记录（格式：YYYY-MM-DD）
  --help, -h        显示此帮助信息

示例：
  tsx scripts/query-decisions.ts                    # 查询最近 10 条记录
  tsx scripts/query-decisions.ts --limit 20         # 查询最近 20 条记录
  tsx scripts/query-decisions.ts --full             # 查询最近 10 条记录（含完整内容）
  tsx scripts/query-decisions.ts --id 123           # 查询 ID 为 123 的记录
  tsx scripts/query-decisions.ts --date 2025-11-10  # 查询 2025-11-10 的记录
        `);
        process.exit(0);
    }
  }

  return options;
}

// 格式化时间
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// 截断长文本
function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 打印决策记录
function printDecision(decision: AgentDecision, full: boolean = false) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 决策 ID: ${decision.id}`);
  console.log(`🕐 时间: ${formatTime(decision.timestamp)}`);
  console.log(`🔄 迭代次数: ${decision.iteration}`);
  console.log(`💰 账户价值: ${decision.account_value.toFixed(2)} USDT`);
  console.log(`📈 持仓数量: ${decision.positions_count}`);
  console.log('-'.repeat(80));
  
  if (full) {
    console.log('\n📋 市场分析:');
    console.log(decision.market_analysis);
    console.log('\n💡 决策内容:');
    console.log(decision.decision);
    console.log('\n⚡ 执行操作:');
    console.log(decision.actions_taken);
  } else {
    console.log(`📋 市场分析: ${truncate(decision.market_analysis, 80)}`);
    console.log(`💡 决策内容: ${truncate(decision.decision, 80)}`);
    console.log(`⚡ 执行操作: ${truncate(decision.actions_taken, 80)}`);
  }
}

// 主函数
async function main() {
  const options = parseArgs();

  console.log('\n🤖 查询 AI 决策记录\n');

  try {
    let result;
    let title = '';

    // 根据选项构建查询
    if (options.id) {
      // 查询指定 ID
      title = `ID ${options.id} 的决策记录`;
      result = await dbClient.execute({
        sql: 'SELECT * FROM agent_decisions WHERE id = ?',
        args: [options.id],
      });
    } else if (options.date) {
      // 查询指定日期
      title = `日期 ${options.date} 的决策记录`;
      const startDate = `${options.date}T00:00:00`;
      const endDate = `${options.date}T23:59:59`;
      result = await dbClient.execute({
        sql: 'SELECT * FROM agent_decisions WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
        args: [startDate, endDate],
      });
    } else {
      // 查询最近的记录
      title = `最近 ${options.limit} 条决策记录`;
      result = await dbClient.execute({
        sql: 'SELECT * FROM agent_decisions ORDER BY timestamp DESC LIMIT ?',
        args: [options.limit],
      });
    }

    console.log(`📚 ${title}\n`);

    if (result.rows.length === 0) {
      console.log('❌ 未找到匹配的决策记录');
      return;
    }

    console.log(`✅ 共找到 ${result.rows.length} 条记录`);

    // 打印每条记录
    for (const row of result.rows) {
      const decision = row as unknown as AgentDecision;
      printDecision(decision, options.full);
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // 显示统计信息
    if (!options.id) {
      const stats = await dbClient.execute(
        'SELECT COUNT(*) as total, MIN(timestamp) as first, MAX(timestamp) as last FROM agent_decisions'
      );
      const statsRow = stats.rows[0] as any;
      
      console.log('📊 统计信息:');
      console.log(`   总决策数: ${statsRow.total}`);
      if (statsRow.first && statsRow.last) {
        console.log(`   首次决策: ${formatTime(statsRow.first)}`);
        console.log(`   最后决策: ${formatTime(statsRow.last)}`);
      }
      console.log('');
    }

  } catch (error: any) {
    console.error('\n❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    dbClient.close();
  }
}

main();
