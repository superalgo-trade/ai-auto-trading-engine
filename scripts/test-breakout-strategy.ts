/**
 * 测试突破策略修复 - 验证K线数据是否正确传递
 */

import "dotenv/config";
import { performMultiTimeframeAnalysis } from "../src/services/multiTimeframeAnalysis";
import { analyzeMarketState } from "../src/services/marketStateAnalyzer";
import { breakoutStrategy } from "../src/strategies/breakoutStrategy";
import { createLogger } from "../src/utils/logger";

const logger = createLogger({
  name: "test-breakout",
  level: "info",
});

async function testBreakoutStrategy() {
  logger.info("=".repeat(80));
  logger.info("测试突破策略K线数据传递");
  logger.info("=".repeat(80));

  const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT"];

  for (const symbol of symbols) {
    try {
      logger.info(`\n${"=".repeat(60)}`);
      logger.info(`测试品种: ${symbol}`);
      logger.info(`${"=".repeat(60)}`);

      // 1. 获取多时间框架数据
      const mtfData = await performMultiTimeframeAnalysis(symbol, ["SHORT_CONFIRM", "MEDIUM"]);
      const tf15m = mtfData.timeframes.shortconfirm;
      const tf1h = mtfData.timeframes.medium;

      if (!tf15m || !tf1h) {
        logger.error(`${symbol}: 无法获取时间框架数据`);
        continue;
      }

      // 2. 检查K线数据是否存在
      logger.info(`\n📊 K线数据检查:`);
      logger.info(`  - 15分钟K线数量: ${tf15m.candles?.length || 0}`);
      logger.info(`  - 1小时K线数量: ${tf1h.candles?.length || 0}`);

      if (tf15m.candles && tf15m.candles.length > 0) {
        // 显示最新的3根K线
        const recent3 = tf15m.candles.slice(-3);
        logger.info(`\n  最新3根15分钟K线:`);
        recent3.forEach((candle: any, idx: number) => {
          const close = parseFloat(candle.close || candle.c || "0");
          const high = parseFloat(candle.high || candle.h || "0");
          const low = parseFloat(candle.low || candle.l || "0");
          logger.info(`    [${idx + 1}] Close: ${close}, High: ${high}, Low: ${low}`);
        });

        // 检查支撑阻力位
        logger.info(`\n  15分钟支撑阻力位:`);
        logger.info(`    - 近期高点: ${tf15m.recentHigh}`);
        logger.info(`    - 近期低点: ${tf15m.recentLow}`);
        logger.info(`    - 阻力位: ${tf15m.resistanceLevels.join(", ")}`);
        logger.info(`    - 支撑位: ${tf15m.supportLevels.join(", ")}`);
      } else {
        logger.warn(`  ⚠️ 15分钟K线数据为空或未传递！`);
      }

      // 3. 分析市场状态
      const marketState = await analyzeMarketState(symbol);
      logger.info(`\n🔍 市场状态: ${marketState.state}`);

      // 4. 测试突破策略（做多和做空）
      logger.info(`\n📈 测试突破做多策略:`);
      const longResult = await breakoutStrategy(symbol, "long", marketState, tf15m, tf1h);
      logger.info(`  - 动作: ${longResult.action}`);
      logger.info(`  - 信号强度: ${(longResult.signalStrength * 100).toFixed(1)}%`);
      logger.info(`  - 置信度: ${longResult.confidence}`);
      logger.info(`  - 原因: ${longResult.reason}`);

      logger.info(`\n📉 测试突破做空策略:`);
      const shortResult = await breakoutStrategy(symbol, "short", marketState, tf15m, tf1h);
      logger.info(`  - 动作: ${shortResult.action}`);
      logger.info(`  - 信号强度: ${(shortResult.signalStrength * 100).toFixed(1)}%`);
      logger.info(`  - 置信度: ${shortResult.confidence}`);
      logger.info(`  - 原因: ${shortResult.reason}`);

    } catch (error) {
      logger.error(`${symbol} 测试失败:`, error);
    }
  }

  logger.info(`\n${"=".repeat(80)}`);
  logger.info("测试完成");
  logger.info(`${"=".repeat(80)}`);
}

// 运行测试
testBreakoutStrategy().catch((error) => {
  logger.error("测试执行失败:", error);
  process.exit(1);
});
