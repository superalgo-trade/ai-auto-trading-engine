/**
 * open-nof1.ai - AI 加密货币自动交易系统
 * Copyright (C) 2025 195440
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
 * 盈亏计算演示脚本
 * 展示如何正确计算扣除手续费后的净盈亏
 */

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📊 盈亏计算公式演示（扣除手续费）");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

/**
 * 交易参数
 */
const scenarios = [
  {
    name: "做多BTC盈利",
    symbol: "BTC",
    side: "long",
    entryPrice: 95000,
    exitPrice: 97000,
    quantity: 100, // 张数
    quantoMultiplier: 0.0001, // BTC合约：1张 = 0.0001 BTC
    leverage: 5,
  },
  {
    name: "做多BTC亏损",
    symbol: "BTC",
    side: "long",
    entryPrice: 97000,
    exitPrice: 95000,
    quantity: 100,
    quantoMultiplier: 0.0001,
    leverage: 5,
  },
  {
    name: "做空ETH盈利",
    symbol: "ETH",
    side: "short",
    entryPrice: 3500,
    exitPrice: 3400,
    quantity: 50,
    quantoMultiplier: 0.01, // ETH合约：1张 = 0.01 ETH
    leverage: 3,
  },
  {
    name: "做空ETH亏损",
    symbol: "ETH",
    side: "short",
    entryPrice: 3400,
    exitPrice: 3500,
    quantity: 50,
    quantoMultiplier: 0.01,
    leverage: 3,
  },
];

for (const scenario of scenarios) {
  console.log(`\n📍 场景: ${scenario.name}`);
  console.log("─".repeat(60));
  
  const {
    symbol,
    side,
    entryPrice,
    exitPrice,
    quantity,
    quantoMultiplier,
    leverage,
  } = scenario;
  
  // 1. 计算开仓名义价值
  const openNotionalValue = entryPrice * quantity * quantoMultiplier;
  console.log(`\n1️⃣ 开仓:`);
  console.log(`   方向: ${side === "long" ? "做多 (LONG)" : "做空 (SHORT)"}`);
  console.log(`   价格: ${entryPrice.toFixed(2)} USDT`);
  console.log(`   数量: ${quantity} 张 = ${(quantity * quantoMultiplier).toFixed(4)} ${symbol}`);
  console.log(`   名义价值: ${openNotionalValue.toFixed(2)} USDT`);
  console.log(`   杠杆: ${leverage}x`);
  
  // 2. 计算开仓保证金
  const margin = openNotionalValue / leverage;
  console.log(`   保证金: ${margin.toFixed(2)} USDT`);
  
  // 3. 计算开仓手续费 (0.05%)
  const openFee = openNotionalValue * 0.0005;
  console.log(`   开仓手续费 (0.05%): ${openFee.toFixed(2)} USDT`);
  
  // 4. 计算平仓名义价值
  const closeNotionalValue = exitPrice * quantity * quantoMultiplier;
  console.log(`\n2️⃣ 平仓:`);
  console.log(`   价格: ${exitPrice.toFixed(2)} USDT`);
  console.log(`   名义价值: ${closeNotionalValue.toFixed(2)} USDT`);
  
  // 5. 计算平仓手续费 (0.05%)
  const closeFee = closeNotionalValue * 0.0005;
  console.log(`   平仓手续费 (0.05%): ${closeFee.toFixed(2)} USDT`);
  
  // 6. 计算价格变动
  const priceChange = side === "long" 
    ? (exitPrice - entryPrice) 
    : (entryPrice - exitPrice);
  
  const priceChangePercent = (priceChange / entryPrice) * 100;
  console.log(`\n3️⃣ 价格变动:`);
  console.log(`   ${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)} USDT (${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(2)}%)`);
  
  // 7. 计算毛盈亏（未扣手续费）
  const grossPnl = priceChange * quantity * quantoMultiplier;
  console.log(`\n4️⃣ 毛盈亏 (未扣手续费):`);
  console.log(`   公式: 价格变动 × 数量 × 合约乘数`);
  console.log(`   计算: ${priceChange.toFixed(2)} × ${quantity} × ${quantoMultiplier} = ${grossPnl.toFixed(2)} USDT`);
  
  // 8. 计算总手续费
  const totalFees = openFee + closeFee;
  console.log(`\n5️⃣ 总手续费:`);
  console.log(`   开仓手续费: ${openFee.toFixed(2)} USDT`);
  console.log(`   平仓手续费: ${closeFee.toFixed(2)} USDT`);
  console.log(`   总计: ${totalFees.toFixed(2)} USDT`);
  
  // 9. 计算净盈亏（已扣手续费）
  const netPnl = grossPnl - totalFees;
  console.log(`\n6️⃣ 净盈亏 (已扣手续费):`);
  console.log(`   公式: 毛盈亏 - 总手续费`);
  console.log(`   计算: ${grossPnl.toFixed(2)} - ${totalFees.toFixed(2)} = ${netPnl >= 0 ? "+" : ""}${netPnl.toFixed(2)} USDT`);
  
  // 10. 计算收益率（基于保证金）
  const returnPercent = (netPnl / margin) * 100;
  console.log(`\n7️⃣ 收益率 (基于保证金 ${margin.toFixed(2)} USDT):`);
  console.log(`   ${returnPercent >= 0 ? "+" : ""}${returnPercent.toFixed(2)}%`);
  
  // 11. 实际资金变化
  const actualPnlWithLeverage = netPnl;
  console.log(`\n8️⃣ 实际资金变化:`);
  console.log(`   账户盈亏: ${actualPnlWithLeverage >= 0 ? "+" : ""}${actualPnlWithLeverage.toFixed(2)} USDT`);
  
  console.log("\n" + "─".repeat(60));
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("✅ 演示完成");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

console.log("📝 关键要点:");
console.log("   1. 手续费基于名义价值计算，不是保证金");
console.log("   2. 开仓和平仓都要收取 0.05% 手续费，总计 0.1%");
console.log("   3. 净盈亏 = 毛盈亏 - 总手续费");
console.log("   4. 收益率基于实际投入的保证金计算");
console.log("   5. 杠杆越高，收益率越高，但风险也越大\n");

console.log("🔍 代码位置:");
console.log("   - 平仓盈亏计算: src/tools/trading/tradeExecution.ts:443-541");
console.log("   - 手续费扣除: src/tools/trading/tradeExecution.ts:530-541");
console.log("   - 数据库记录: src/tools/trading/tradeExecution.ts:598-636\n");


