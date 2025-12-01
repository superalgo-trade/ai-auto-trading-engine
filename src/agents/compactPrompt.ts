/**
 * 精简版提示词生成器 - 大幅减少tokens使用,降低API费用
 */
import { formatChinaTime } from "../utils/timeUtils";
import { RISK_PARAMS } from "../config/riskParams";
import { formatPrice, formatUSDT, formatPercent } from "../utils/priceFormatter";
import { analyzeMultipleMarketStates } from "../services/marketStateAnalyzer";
import type { MarketStateAnalysis } from "../types/marketState";
import { createLogger } from "../utils/logger";
import { getTradingStrategy, getStrategyParams, getMinOpportunityScore } from "./tradingAgent";

const logger = createLogger({ name: "compact-prompt", level: "info" });

/**
 * 生成精简版交易提示词
 * tokens减少约70%,同时保留核心决策信息
 */
export async function generateCompactPrompt(data: {
  minutesElapsed: number;
  iteration: number;
  intervalMinutes: number;
  marketData: any;
  accountInfo: any;
  positions: any[];
}): Promise<string> {
  const { minutesElapsed, iteration, marketData, accountInfo, positions } = data;
  const currentTime = formatChinaTime();
  const strategy = getTradingStrategy();
  const params = getStrategyParams(strategy);
  const minScore = getMinOpportunityScore();
  
  let prompt = `#${iteration} ${currentTime} | ${params.name} | ${minutesElapsed}min

【风控】止损24/7自动,≥36h强制平,峰值回撤≥${formatPercent(params.peakDrawdownProtection)}%立即平

【决策】
1.持仓管理(优先):
  ▸监控≥70→立即平
  ▸reversal≥70→立即平
  ▸分批止盈check→执行跳移动止损
  ▸reversal50-70→结合盈亏评估
  ▸移动止损→可选优化
2.新开仓:
  ▸analyze_opening_opportunities()获评分
  ▸≥${minScore}分可考虑,<${Math.floor(minScore*0.75)}观望
  ▸checkOpenPosition()验→openPosition()执

【账户】
${formatUSDT(accountInfo.totalBalance)}|可用${formatUSDT(accountInfo.availableBalance)}|收益${accountInfo.returnPercent.toFixed(1)}%|未实现${formatUSDT(positions.reduce((s,p)=>s+(p.unrealized_pnl||0),0))}
`;
  
  // 持仓(紧凑)
  if (positions.length > 0) {
    prompt += `\n【持仓${positions.length}/${RISK_PARAMS.MAX_POSITIONS}】\n`;
    
    const posSymbols = positions.map(p => p.symbol);
    let states: Map<string, MarketStateAnalysis> = new Map();
    try {
      states = await analyzeMultipleMarketStates(posSymbols);
    } catch (e) {
      logger.warn(`状态分析失败: ${e}`);
    }
    
    for (const p of positions) {
      const pnl = p.entry_price > 0 
        ? ((p.current_price - p.entry_price) / p.entry_price * 100 * (p.side === 'long' ? 1 : -1) * p.leverage)
        : 0;
      const h = ((Date.now() - new Date(p.opened_at).getTime()) / 3600000).toFixed(1);
      
      const m = p.metadata || {};
      const w = m.warningScore || 0;
      let f = '';
      if (m.reversalWarning === 1 && w >= 70) f = '⚠️紧急';
      else if (w >= 50) f = '⚠️预';
      
      prompt += `${p.symbol} ${p.side}${p.leverage}x|${pnl>=0?'+':''}${formatPercent(pnl)}%|${h}h`;
      if (f) prompt += `|${f}`;
      
      const s = states.get(p.symbol);
      if (s?.reversalAnalysis) {
        const r = s.reversalAnalysis;
        if (r.reversalScore >= 70) prompt += `|反${r.reversalScore}⚠️⚠️立即平`;
        else if (r.reversalScore >= 50) prompt += `|反${r.reversalScore}⚠️评估`;
        else if (r.earlyWarning) prompt += `|早警`;
      }
      prompt += '\n';
    }
  }
  
  // 市场(仅关键指标)
  prompt += `\n【市场】币种|价|5m:MA/R|15m:MA/R|1h:MA/R\n`;
  for (const [sym, d] of Object.entries(marketData)) {
    const data = d as any;
    const t5 = data.timeframes?.["5m"];
    const t15 = data.timeframes?.["15m"];
    const t1h = data.timeframes?.["1h"];
    
    if (!t5) continue;
    
    prompt += `${sym}|${formatPrice(data.price)}`;
    prompt += `|${formatPrice(t5.ema20,1)}/${formatPrice(t5.ema50,1)},${formatPercent(t5.rsi14,0)}`;
    if (t15) prompt += `|${formatPrice(t15.ema20,1)}/${formatPrice(t15.ema50,1)},${formatPercent(t15.rsi14,0)}`;
    if (t1h) prompt += `|${formatPrice(t1h.ema20,1)}/${formatPrice(t1h.ema50,1)},${formatPercent(t1h.rsi14,0)}`;
    prompt += '\n';
  }
  
  prompt += `\n【任务】分析上述数据,执行工具做决策:closePosition/openPosition/checkPartialTakeProfitOpportunity/analyze_opening_opportunities`;
  
  return prompt;
}
