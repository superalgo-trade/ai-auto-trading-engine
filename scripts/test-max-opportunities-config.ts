/**
 * 测试 MAX_OPPORTUNITIES_TO_SHOW 配置是否正确应用到 AI 提示词中
 */

import { getMaxOpportunitiesToShow, generateTradingPrompt } from '../src/agents/tradingAgent';

console.log('测试 MAX_OPPORTUNITIES_TO_SHOW 配置');
console.log('='.repeat(60));

// 测试环境变量读取
console.log('\n1. 测试环境变量读取：');
console.log(`   process.env.MAX_OPPORTUNITIES_TO_SHOW = ${process.env.MAX_OPPORTUNITIES_TO_SHOW}`);
console.log(`   getMaxOpportunitiesToShow() = ${getMaxOpportunitiesToShow()}`);

// 测试生成的提示词
console.log('\n2. 测试生成的提示词：');
const testPrompt = generateTradingPrompt({
  minutesElapsed: 15,
  iteration: 1,
  intervalMinutes: 15,
  marketData: {},
  accountInfo: { totalBalance: 1000, availableBalance: 500 },
  positions: [],
  tradeHistory: [],
  recentDecisions: [],
  closeEvents: [],
});

// 提取提示词中与机会数量相关的部分
const opportunityLine = testPrompt.split('\n').find(line => line.includes('返回评分最高的前'));
console.log(`   找到的机会数量描述: ${opportunityLine?.trim()}`);

// 验证是否包含正确的数量
const expectedCount = getMaxOpportunitiesToShow();
const hasCorrectCount = testPrompt.includes(`返回评分最高的前${expectedCount}个机会`);

console.log('\n3. 验证结果：');
console.log(`   期望值: 前${expectedCount}个机会`);
console.log(`   是否正确: ${hasCorrectCount ? '✅ 是' : '❌ 否'}`);

if (hasCorrectCount) {
  console.log('\n✅ 测试通过！MAX_OPPORTUNITIES_TO_SHOW 配置已正确应用到 AI 提示词中');
} else {
  console.log('\n❌ 测试失败！提示词中仍然包含硬编码的机会数量');
  console.log('\n完整提示词（前2000字符）：');
  console.log(testPrompt.substring(0, 2000));
}

console.log('\n' + '='.repeat(60));
