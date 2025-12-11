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

【风控】${params.scientificStopLoss?.enabled?'科学':'策略'}止损24/7自动,≥36h强制平,峰值回撤≥${formatPercent(params.peakDrawdownProtection)}%立即平

【止损机制】
${params.scientificStopLoss?.enabled ? `▸科学止损(交易所服务器端):开仓已设条件单,${params.scientificStopLoss.minDistance}-${params.scientificStopLoss.maxDistance}%(ATR${params.scientificStopLoss.atrMultiplier}x+支撑/阻力),24/7监控触及立即平
▸AI职责:✅信任止损单保护,❌禁因"接近止损"主动平,✅仅趋势明确反转时主动平
▸移动止损:可选优化,仅当(盈利+未分批+无反转)时调updateTrailingStop→updatePositionStopLoss
▸极端止盈${params.partialTakeProfit.extremeTakeProfit?.rMultiple||5}R:兜底防线(服务器自动),AI应通过分批主动管利润,触发=分批执行不到位` : `▸策略止损:${formatPercent(params.stopLoss.low)}-${formatPercent(params.stopLoss.high)}%,根据杠杆动态调整
▸移动止损:盈≥${formatPercent(params.trailingStop.level1.trigger)}%→止${formatPercent(params.trailingStop.level1.stopAt)}%,≥${formatPercent(params.trailingStop.level2.trigger)}%→止${formatPercent(params.trailingStop.level2.stopAt)}%,≥${formatPercent(params.trailingStop.level3.trigger)}%→止${formatPercent(params.trailingStop.level3.stopAt)}%`}

【决策流程】
1.持仓管理(优先级从高到低):
  ▸监控预警≥70(看持仓info的【反转监控紧急预警】标记)→立即全平closePosition,跳过所有后续
  ▸reversal≥70→立即全平closePosition,跳过所有后续(含分批,强烈反转无条件退出)
  ▸分批止盈→reversal<70时每持仓必查checkPartialTakeProfitOpportunity,canExecute=true立即executePartialTakeProfit(工具自动算R+波动率自适应+自动移止损),执行后本周期跳过移动止损(Stage:无分批=0%,S1=已平33%,S2=已平66%,S3=全平100%)
  ▸reversal50-70→已盈利立即平锁利,小亏(<5%)平止损,接近止损等待触发
  ▸earlyWarning→停止移动止损,准备退出
  ▸移动止损优化→仅当(盈利+未分批+无反转+无early)时可选调用
2.新开仓(强制按序):
  ▸必须先analyze_opening_opportunities()获评分(工具自动:识别市场+选策略+量化评分+过滤已持+返前3个)
  ▸≥${minScore}分可考虑|${Math.floor(minScore*0.75)}-${minScore-1}分观望|<${Math.floor(minScore*0.75)}分禁止
  ▸⚠️禁止跳过evaluate|忽略评分|全<${minScore}分强行开
  ${params.scientificStopLoss?.enabled 
    ? `▸checkOpenPosition()验(必须):检查止损${params.scientificStopLoss.minDistance}-${params.scientificStopLoss.maxDistance}%范围+质量评分≥${RISK_PARAMS.MIN_STOP_LOSS_QUALITY_SCORE}+波动率非极端,shouldOpen=false立即放弃`
    : `▸checkOpenPosition()验(必须):检查止损合理性+无反向仓+资金充足,shouldOpen=false立即放弃`}
  ▸openPosition()执(自动设${params.scientificStopLoss?.enabled?'科学':'策略'}止损+${params.partialTakeProfit.extremeTakeProfit?.rMultiple||5}R极端止盈)
  ▸AI保留决策权(评分合格前提)

【账户】
${formatUSDT(accountInfo.totalBalance)}|可用${formatUSDT(accountInfo.availableBalance)}|收益${accountInfo.returnPercent.toFixed(1)}%|未实现${formatUSDT(positions.reduce((s,p)=>s+(p.unrealized_pnl||0),0))}
`;
  
  // 持仓(紧凑)
  if (positions.length > 0) {
    prompt += `\n【持仓${positions.length}/${RISK_PARAMS.MAX_POSITIONS}】格式:币种 方向杠杆|盈亏%|持仓h|止损单|分批阶段|预警\n`;
    
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
      
      // 🔧 止损单状态标记（让AI知道止损保护已启用）
      const hasStopLoss = p.stop_loss && parseFloat(p.stop_loss) > 0;
      const stopLossStatus = hasStopLoss ? '✓止损' : '❌无止损';
      
      // 🔧 关键修复: 包含分批止盈进度（与完整版一致，添加百分比信息）
      const partialClosed = p.partial_close_percentage || 0;
      let stageInfo = '';
      if (partialClosed >= 66) stageInfo = '|S3(已平66%)';
      else if (partialClosed >= 33) stageInfo = '|S2(已平33%)';
      else if (partialClosed > 0) stageInfo = '|S1(已平部分)';
      
      prompt += `${p.symbol} ${p.side}${p.leverage}x|${pnl>=0?'+':''}${formatPercent(pnl)}%|${h}h|${stopLossStatus}`;
      if (stageInfo) prompt += stageInfo;
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
