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
 * Binance 交易所客户端实现
 */
import * as ccxt from "ccxt";
import { createPinoLogger } from "@voltagent/logger";
import { RISK_PARAMS } from "../config/riskParams";
import type {
  IExchangeClient,
  ExchangeConfig,
  TickerInfo,
  CandleData,
  AccountInfo,
  PositionInfo,
  OrderParams,
  OrderResponse,
  ContractInfo,
  TradeRecord,
} from "./IExchangeClient";

const logger = createPinoLogger({
  name: "binance-exchange",
  level: "info",
});

export class BinanceExchangeClient implements IExchangeClient {
  private readonly exchange: any;
  private readonly config: ExchangeConfig;

  constructor(config: ExchangeConfig) {
    this.config = config;

    // 初始化币安USDT永续合约交易所
    this.exchange = new ccxt.binanceusdm({
      apiKey: config.apiKey,
      secret: config.apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'future',
        recvWindow: 60000,
      },
    });

    // 设置测试网或正式网
    if (config.isTestnet) {
      this.exchange.setSandboxMode(true);
      logger.info("使用 Binance 测试网");
    } else {
      logger.info("使用 Binance 正式网");
    }

    logger.info("Binance API 客户端初始化完成");
  }

  getExchangeName(): string {
    return "binance";
  }

  isTestnet(): boolean {
    return this.config.isTestnet;
  }

  normalizeContract(symbol: string): string {
    // Binance 使用斜杠格式：BTC/USDT:USDT
    // 第一个USDT表示报价货币，第二个USDT表示结算货币
    return `${symbol}/USDT:USDT`;
  }

  extractSymbol(contract: string): string {
    // 从 BTC/USDT:USDT 提取 BTC
    return contract.split('/')[0];
  }

  async getFuturesTicker(contract: string, retries: number = 2): Promise<TickerInfo> {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const ticker = await this.exchange.fetchTicker(contract);
        
        return {
          contract: contract,
          last: ticker.last?.toString() || "0",
          markPrice: ticker.info?.markPrice || ticker.last?.toString() || "0",
          indexPrice: ticker.info?.indexPrice,
          volume24h: ticker.baseVolume?.toString(),
          high24h: ticker.high?.toString(),
          low24h: ticker.low?.toString(),
          change24h: ticker.percentage?.toString(),
        };
      } catch (error) {
        lastError = error;
        if (i < retries) {
          logger.warn(`获取 ${contract} 价格失败，重试 ${i + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
        }
      }
    }
    
    logger.error(`获取 ${contract} 价格失败（${retries}次重试）:`, lastError);
    throw lastError;
  }

  async getFuturesCandles(
    contract: string,
    interval: string = "5m",
    limit: number = 100,
    retries: number = 2
  ): Promise<CandleData[]> {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const ohlcv = await this.exchange.fetchOHLCV(contract, interval, undefined, limit);
        
        return ohlcv.map((candle: any) => ({
          timestamp: candle[0],
          open: candle[1].toString(),
          high: candle[2].toString(),
          low: candle[3].toString(),
          close: candle[4].toString(),
          volume: candle[5].toString(),
        }));
      } catch (error) {
        lastError = error;
        if (i < retries) {
          logger.warn(`获取 ${contract} K线数据失败，重试 ${i + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
        }
      }
    }
    
    logger.error(`获取 ${contract} K线数据失败（${retries}次重试）:`, lastError);
    throw lastError;
  }

  async getFuturesAccount(retries: number = 2): Promise<AccountInfo> {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const balance = await this.exchange.fetchBalance();
        const usdtBalance = balance['USDT'] || {};
        
        return {
          currency: "USDT",
          total: usdtBalance.total?.toString() || "0",
          available: usdtBalance.free?.toString() || "0",
          positionMargin: (usdtBalance.used || 0).toString(),
          orderMargin: "0",
          unrealisedPnl: balance.info?.totalUnrealizedProfit || "0",
        };
      } catch (error) {
        lastError = error;
        if (i < retries) {
          logger.warn(`获取账户余额失败，重试 ${i + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
        }
      }
    }
    
    logger.error(`获取账户余额失败（${retries}次重试）:`, lastError);
    throw lastError;
  }

  async getPositions(retries: number = 2): Promise<PositionInfo[]> {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const positions = await this.exchange.fetchPositions();
        
        // 过滤：只保留有持仓的和允许的币种
        const allowedSymbols = RISK_PARAMS.TRADING_SYMBOLS;
        const activePositions = positions.filter((p: any) => {
          if (!p.contracts || p.contracts === 0) return false;
          const symbol = this.extractSymbol(p.symbol);
          return allowedSymbols.includes(symbol);
        });
        
        return activePositions.map((p: any) => ({
          contract: p.symbol,
          size: p.contracts?.toString() || "0",
          leverage: p.leverage?.toString() || "1",
          entryPrice: p.entryPrice?.toString() || "0",
          markPrice: p.markPrice?.toString() || "0",
          liqPrice: p.liquidationPrice?.toString() || "0",
          unrealisedPnl: p.unrealizedPnl?.toString() || "0",
          realisedPnl: "0", // Binance 不直接提供已实现盈亏
          margin: p.initialMargin?.toString() || "0",
        }));
      } catch (error) {
        lastError = error;
        if (i < retries) {
          logger.warn(`获取持仓失败，重试 ${i + 1}/${retries}...`);
          await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
        }
      }
    }
    
    logger.error(`获取持仓失败（${retries}次重试）:`, lastError);
    throw lastError;
  }

  async placeOrder(params: OrderParams): Promise<OrderResponse> {
    try {
      // 获取市场信息以验证参数
      const market = await this.exchange.market(params.contract);
      
      // 调整数量到合约乘数
      let adjustedSize = params.size;
      const absSize = Math.abs(params.size);
      
      // 检查最小/最大数量限制
      if (market.limits?.amount?.min && absSize < market.limits.amount.min) {
        logger.warn(`订单数量 ${absSize} 小于最小限制 ${market.limits.amount.min}，调整为最小值`);
        adjustedSize = params.size > 0 ? market.limits.amount.min : -market.limits.amount.min;
      }
      
      if (market.limits?.amount?.max && absSize > market.limits.amount.max) {
        logger.warn(`订单数量 ${absSize} 超过最大限制 ${market.limits.amount.max}，调整为最大值`);
        adjustedSize = params.size > 0 ? market.limits.amount.max : -market.limits.amount.max;
      }

      // 确定订单类型和方向
      const orderType = (params.price && params.price > 0) ? 'limit' : 'market';
      const side = adjustedSize > 0 ? 'buy' : 'sell';
      const amount = Math.abs(adjustedSize);

      // 构建订单参数
      const orderParams: any = {
        reduceOnly: params.reduceOnly || false,
      };

      // 如果是限价单，设置timeInForce
      if (orderType === 'limit') {
        orderParams.timeInForce = params.tif?.toUpperCase() || 'GTC';
      }

      // 止损止盈（Binance需要单独下单）
      if (params.stopLoss && params.stopLoss > 0) {
        logger.info(`设置止损价格: ${params.stopLoss}`);
        // 这里暂时记录，实际需要在开仓后单独下止损单
      }
      
      if (params.takeProfit && params.takeProfit > 0) {
        logger.info(`设置止盈价格: ${params.takeProfit}`);
        // 这里暂时记录，实际需要在开仓后单独下止盈单
      }

      logger.info(`下单: ${side} ${amount} ${params.contract} @ ${params.price || 'market'}`);
      
      const order = await this.exchange.createOrder(
        params.contract,
        orderType,
        side,
        amount,
        params.price,
        orderParams
      );

      return {
        id: order.id || "",
        contract: order.symbol,
        size: adjustedSize,
        price: order.price?.toString() || "0",
        status: order.status || "unknown",
        ...order,
      };
    } catch (error: any) {
      logger.error("下单失败:", error);
      
      // 处理资金不足错误
      if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        throw new Error(`资金不足，无法开仓 ${params.contract}: ${error.message}`);
      }
      
      throw new Error(`下单失败: ${error.message} (${params.contract}, size: ${params.size})`);
    }
  }

  async getContractInfo(contract: string): Promise<ContractInfo> {
    try {
      const market = await this.exchange.market(contract);
      
      return {
        name: market.id,
        quantoMultiplier: market.contractSize?.toString() || "1",
        orderSizeMin: market.limits?.amount?.min || 1,
        orderSizeMax: market.limits?.amount?.max || 1000000,
        orderPriceDeviate: market.limits?.price?.toString(),
        ...market,
      };
    } catch (error) {
      logger.error(`获取 ${contract} 合约信息失败:`, error as any);
      throw error;
    }
  }

  async setLeverage(contract: string, leverage: number): Promise<any> {
    try {
      logger.info(`设置 ${contract} 杠杆为 ${leverage}x`);
      const result = await this.exchange.setLeverage(leverage, contract);
      return result;
    } catch (error: any) {
      logger.warn(`设置 ${contract} 杠杆失败:`, error.message);
      return null;
    }
  }

  async cancelAllOrders(contract?: string): Promise<any> {
    try {
      if (contract) {
        return await this.exchange.cancelAllOrders(contract);
      } else {
        // 取消所有合约的订单
        const openOrders = await this.exchange.fetchOpenOrders();
        const cancelPromises = openOrders.map((order: any) => 
          this.exchange.cancelOrder(order.id, order.symbol)
        );
        return await Promise.all(cancelPromises);
      }
    } catch (error) {
      logger.error("取消所有订单失败:", error as any);
      throw error;
    }
  }

  async getMyTrades(contract?: string, limit: number = 10): Promise<TradeRecord[]> {
    try {
      let trades;
      if (contract) {
        trades = await this.exchange.fetchMyTrades(contract, undefined, limit);
      } else {
        // Binance 需要指定symbol才能获取交易记录
        // 这里我们获取所有允许的币种的交易记录
        const symbols = RISK_PARAMS.TRADING_SYMBOLS.map(s => this.normalizeContract(s));
        const tradePromises = symbols.map(symbol => 
          this.exchange.fetchMyTrades(symbol, undefined, Math.ceil(limit / symbols.length))
            .catch(() => []) // 忽略单个币种的错误
        );
        const allTrades = await Promise.all(tradePromises);
        trades = allTrades.flat().slice(0, limit);
      }
      
      return trades.map((trade: any) => ({
        id: trade.id?.toString() || "",
        contract: trade.symbol,
        size: trade.amount?.toString() || "0",
        price: trade.price?.toString() || "0",
        fee: trade.fee?.cost?.toString() || "0",
        timestamp: trade.timestamp || Date.now(),
        ...trade,
      }));
    } catch (error) {
      logger.error(`获取我的历史成交记录失败:`, error as any);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<any> {
    try {
      // Binance 需要同时提供 symbol 和 orderId
      // 这里我们先获取所有未成交订单，然后过滤
      const openOrders = await this.exchange.fetchOpenOrders();
      const order = openOrders.find((o: any) => o.id === orderId);
      if (order) return order;
      
      // 如果未成交订单中没有，查询历史订单
      // 注意：ccxt 的 fetchOrder 需要 symbol，这里简化处理
      logger.warn(`无法获取订单 ${orderId} 详情：Binance API 需要提供 symbol`);
      return null;
    } catch (error) {
      logger.error(`获取订单 ${orderId} 详情失败:`, error as any);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<any> {
    try {
      // Binance 需要同时提供 symbol 和 orderId
      const openOrders = await this.exchange.fetchOpenOrders();
      const order = openOrders.find((o: any) => o.id === orderId);
      if (!order) {
        throw new Error(`订单 ${orderId} 不存在或已完成`);
      }
      return await this.exchange.cancelOrder(orderId, order.symbol);
    } catch (error) {
      logger.error(`取消订单 ${orderId} 失败:`, error as any);
      throw error;
    }
  }

  async getOpenOrders(contract?: string): Promise<any[]> {
    try {
      if (contract) {
        return await this.exchange.fetchOpenOrders(contract);
      } else {
        return await this.exchange.fetchOpenOrders();
      }
    } catch (error) {
      logger.error("获取未成交订单失败:", error as any);
      throw error;
    }
  }

  async getFundingRate(contract: string): Promise<any> {
    try {
      const fundingRate = await this.exchange.fetchFundingRate(contract);
      return fundingRate;
    } catch (error) {
      logger.error(`获取 ${contract} 资金费率失败:`, error as any);
      throw error;
    }
  }

  async getAllContracts(): Promise<any[]> {
    try {
      await this.exchange.loadMarkets();
      const markets = this.exchange.markets;
      return Object.values(markets).filter((m: any) => m.future && m.settle === 'USDT');
    } catch (error) {
      logger.error("获取合约列表失败:", error as any);
      throw error;
    }
  }

  async getOrderBook(contract: string, limit: number = 10): Promise<any> {
    try {
      const orderBook = await this.exchange.fetchOrderBook(contract, limit);
      return orderBook;
    } catch (error) {
      logger.error(`获取 ${contract} 订单簿失败:`, error as any);
      throw error;
    }
  }

  async getPositionHistory(contract?: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      // Binance 不直接提供历史仓位记录接口
      // 可以通过账户历史记录来间接获取
      logger.warn("Binance 不支持直接获取历史仓位记录");
      return [];
    } catch (error) {
      logger.error(`获取历史仓位记录失败:`, error as any);
      throw error;
    }
  }

  async getSettlementHistory(contract?: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      // Binance 不直接提供结算历史接口
      logger.warn("Binance 不支持直接获取历史结算记录");
      return [];
    } catch (error) {
      logger.error(`获取历史结算记录失败:`, error as any);
      throw error;
    }
  }

  async getOrderHistory(contract?: string, limit: number = 10): Promise<any[]> {
    try {
      if (contract) {
        return await this.exchange.fetchClosedOrders(contract, undefined, limit);
      } else {
        // 获取所有允许币种的订单历史
        const symbols = RISK_PARAMS.TRADING_SYMBOLS.map(s => this.normalizeContract(s));
        const orderPromises = symbols.map(symbol => 
          this.exchange.fetchClosedOrders(symbol, undefined, Math.ceil(limit / symbols.length))
            .catch(() => [])
        );
        const allOrders = await Promise.all(orderPromises);
        return allOrders.flat().slice(0, limit);
      }
    } catch (error) {
      logger.error(`获取订单历史失败:`, error as any);
      throw error;
    }
  }

  /**
   * 获取合约计价类型
   * Binance USDT-M 使用正向合约（USDT本位）
   */
  getContractType(): 'inverse' | 'linear' {
    return 'linear';
  }

  /**
   * 计算开仓所需数量（Binance 正向合约）
   * Binance USDT-M 合约直接以币的数量计价
   * 
   * 公式：
   * - 名义价值 = amountUsdt * leverage
   * - 数量(币) = 名义价值 / price
   * 
   * @param amountUsdt 保证金金额 (USDT)
   * @param price 当前价格
   * @param leverage 杠杆倍数
   * @param contract 合约名称（未使用，保持接口一致）
   * @returns 币的数量（小数）
   */
  async calculateQuantity(
    amountUsdt: number,
    price: number,
    leverage: number,
    contract: string
  ): Promise<number> {
    // Binance: 名义价值 = amountUsdt * leverage
    const notionalValue = amountUsdt * leverage;
    
    // 数量(币) = 名义价值 / price
    // Binance 支持小数数量，不需要取整
    return notionalValue / price;
  }

  /**
   * 计算盈亏（Binance 正向合约）
   * 
   * 公式：
   * - 做多: (exitPrice - entryPrice) * quantity
   * - 做空: (entryPrice - exitPrice) * quantity
   * 
   * @param entryPrice 开仓价
   * @param exitPrice 平仓价
   * @param quantity 币的数量
   * @param side 方向
   * @param contract 合约名称（未使用，保持接口一致）
   * @returns 盈亏 (USDT)
   */
  async calculatePnl(
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    side: 'long' | 'short',
    contract: string
  ): Promise<number> {
    const priceChange = side === 'long' 
      ? (exitPrice - entryPrice) 
      : (entryPrice - exitPrice);
    
    // Binance 正向合约：直接计算，不需要 quantoMultiplier
    return priceChange * quantity;
  }
}
