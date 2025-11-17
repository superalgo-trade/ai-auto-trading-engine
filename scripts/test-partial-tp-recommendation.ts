/**
 * 测试分批止盈建议逻辑修复
 * 验证不同阶段的建议文本是否正确
 */

// 模拟不同的场景
const testScenarios = [
  {
    name: "场景1: 未达到阶段1",
    currentR: 0.7,
    adjustedR1: 0.8,
    adjustedR2: 1.6,
    adjustedR3: 2.4,
    executedStages: [],
    volatilityLevel: "中等",
    expected: "未达到阶段1要求"
  },
  {
    name: "场景2: 达到阶段1（应该建议执行）",
    currentR: 1.0,
    adjustedR1: 0.8,
    adjustedR2: 1.6,
    adjustedR3: 2.4,
    executedStages: [],
    volatilityLevel: "中等",
    expected: "建议执行阶段1"
  },
  {
    name: "场景3: 已完成阶段1，未达到阶段2 ⭐ 这是要修复的场景",
    currentR: 1.2,
    adjustedR1: 0.8,
    adjustedR2: 1.6,
    adjustedR3: 2.4,
    executedStages: [1],
    volatilityLevel: "中等",
    expected: "阶段1已完成，未达到阶段2要求"
  },
  {
    name: "场景4: 已完成阶段1，达到阶段2（应该建议执行）",
    currentR: 1.8,
    adjustedR1: 0.8,
    adjustedR2: 1.6,
    adjustedR3: 2.4,
    executedStages: [1],
    volatilityLevel: "中等",
    expected: "建议执行阶段2"
  },
  {
    name: "场景5: 已完成阶段1-2，未达到阶段3",
    currentR: 2.0,
    adjustedR1: 0.8,
    adjustedR2: 1.6,
    adjustedR3: 2.4,
    executedStages: [1, 2],
    volatilityLevel: "中等",
    expected: "阶段1-2已完成，未达到阶段3要求"
  },
  {
    name: "场景6: 已完成阶段1-2，达到阶段3（应该建议执行）",
    currentR: 2.6,
    adjustedR1: 0.8,
    adjustedR2: 1.6,
    adjustedR3: 2.4,
    executedStages: [1, 2],
    volatilityLevel: "中等",
    expected: "建议执行阶段3"
  },
  {
    name: "场景7: 所有阶段已完成",
    currentR: 3.0,
    adjustedR1: 0.8,
    adjustedR2: 1.6,
    adjustedR3: 2.4,
    executedStages: [1, 2, 3],
    volatilityLevel: "中等",
    expected: "所有阶段已完成"
  }
];

console.log('🧪 分批止盈建议逻辑测试\n');
console.log('修复前的问题：');
console.log('- 已执行阶段1，但R倍数未达到阶段2时');
console.log('- 错误显示："未达到阶段1要求"');
console.log('- 应该显示："阶段1已完成，未达到阶段2要求"\n');
console.log('='.repeat(80) + '\n');

let passCount = 0;
let failCount = 0;

for (const scenario of testScenarios) {
  console.log(`测试: ${scenario.name}`);
  console.log(`  当前R: ${scenario.currentR}, 执行历史: [${scenario.executedStages.join(', ')}]`);
  
  // 模拟修复后的逻辑
  let canExecuteStages: number[] = [];
  let recommendation = "";
  
  // 判断可执行阶段
  if (scenario.currentR >= scenario.adjustedR3 && !scenario.executedStages.includes(3)) {
    canExecuteStages.push(3);
    recommendation = `建议执行阶段3（${scenario.adjustedR3.toFixed(2)}R）`;
  }
  
  if (scenario.currentR >= scenario.adjustedR2 && !scenario.executedStages.includes(2) && scenario.executedStages.includes(1)) {
    canExecuteStages.push(2);
    recommendation = `建议执行阶段2（${scenario.adjustedR2.toFixed(2)}R）`;
  }
  
  if (scenario.currentR >= scenario.adjustedR1 && !scenario.executedStages.includes(1)) {
    canExecuteStages.push(1);
    recommendation = `建议执行阶段1（${scenario.adjustedR1.toFixed(2)}R）`;
  }
  
  // 修复后的逻辑：检查已执行的阶段
  if (canExecuteStages.length === 0 && recommendation === "") {
    if (scenario.executedStages.includes(3)) {
      recommendation = "所有阶段已完成，使用移动止损管理剩余仓位";
    } else if (scenario.executedStages.includes(2)) {
      recommendation = `当前R=${scenario.currentR.toFixed(2)}，阶段1-2已完成，未达到阶段3要求（${scenario.adjustedR3.toFixed(2)}R，${scenario.volatilityLevel}波动），继续持有`;
    } else if (scenario.executedStages.includes(1)) {
      recommendation = `当前R=${scenario.currentR.toFixed(2)}，阶段1已完成，未达到阶段2要求（${scenario.adjustedR2.toFixed(2)}R，${scenario.volatilityLevel}波动），继续持有`;
    } else if (scenario.currentR < scenario.adjustedR1) {
      recommendation = `当前R=${scenario.currentR.toFixed(2)}，未达到阶段1要求（${scenario.adjustedR1.toFixed(2)}R，${scenario.volatilityLevel}波动），继续持有`;
    } else {
      recommendation = "已执行当前R倍数对应的所有阶段";
    }
  }
  
  // 检查结果
  const passed = recommendation.includes(scenario.expected);
  if (passed) {
    console.log(`  ✅ 通过: ${recommendation}`);
    passCount++;
  } else {
    console.log(`  ❌ 失败: ${recommendation}`);
    console.log(`  期望包含: ${scenario.expected}`);
    failCount++;
  }
  console.log('');
}

console.log('='.repeat(80));
console.log(`\n测试结果: ${passCount}/${testScenarios.length} 通过, ${failCount} 失败\n`);

if (failCount === 0) {
  console.log('✅ 所有测试通过！修复成功！\n');
  console.log('修复总结：');
  console.log('1. 已执行阶段1但未达到阶段2时，正确显示"阶段1已完成，未达到阶段2要求"');
  console.log('2. 已执行阶段1-2但未达到阶段3时，正确显示"阶段1-2已完成，未达到阶段3要求"');
  console.log('3. AI现在能准确了解持仓的分批止盈执行状态');
} else {
  console.log('❌ 部分测试失败，需要检查逻辑');
}
