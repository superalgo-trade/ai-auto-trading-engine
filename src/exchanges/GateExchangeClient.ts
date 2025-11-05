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
 * Gate.io 交易所客户端实现
 */
// @ts-ignore - gate-api 的类型定义可能不完整
import * as GateApi from "gate-api";
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
  name: "gate-exchange",
  level: "info",
});

export class GateExchangeClient implements IExchangeClient {
  private readonly client: any;
  private readonly futuresApi: any;
  private readonly spotApi: any;
  private readonly settle = "usdt";
  private readonly config: ExchangeConfig;

  constructor(config: ExchangeConfig) {
    this.config = config;
    
    // @ts-ignore
    this.client = new GateApi.ApiClient();
    
    // 设置API地址（必须在setApiKeySecret之前设置）
    if (config.isTestnet) {
      this.client.basePath = "https://api-testnet.gateapi.io/api/v4";
      logger.info("使用 Gate.io 测试网");
    } else {
      this.client.basePath = "https://api.gateio.ws/api/v4";
      logger.info("使用 Gate.io 正式网");
    }
    
    // 设置API密钥和密钥（必须在设置basePath之后）
    this.client.setApiKeySecret(config.apiKey, config.apiSecret);

    // @ts-ignore
    this.futuresApi = new GateApi.FuturesApi(this.client);
    // @ts-ignore
    this.spotApi = new GateApi.SpotApi(this.client);

    logger.info("Gate.io API 客户端初始化完成");
  }

  getExchangeName(): string {
    return "gate";
  }

  isTestnet(): boolean {
    return this.config.isTestnet;
  }

  normalizeContract(symbol: string): string {
    // Gate.io 使用下划线格式：BTC_USDT
    return `${symbol}_USDT`;
  }

  extractSymbol(contract: string): string {
    // 从 BTC_USDT 提取 BTC
    return contract.split('_')[0];
  }

  async getFuturesTicker(contract: string, retries: number = 2): Promise<TickerInfo> {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const result = await this.futuresApi.listFuturesTickers(this.settle, {
          contract,
        });
        const ticker = result.body[0];
        return {
          contract: ticker.contract,
          last: ticker.last || "0",
          markPrice: ticker.markPrice || ticker.last || "0",
          indexPrice: ticker.indexPrice,
          volume24h: ticker.volume24h,
          high24h: ticker.high24h,
          low24h: ticker.low24h,
          change24h: ticker.changePercentage,
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
        const result = await this.futuresApi.listFuturesCandlesticks(
          this.settle,
          contract,
          {
            interval: interval as any,
            limit,
          }
        );
        return result.body.map((candle: any) => ({
          timestamp: Number.parseInt(candle.t) * 1000,
          open: candle.o,
          high: candle.h,
          low: candle.l,
          close: candle.c,
          volume: candle.v,
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
        const result = await this.futuresApi.listFuturesAccounts(this.settle);
        const account = result.body;
        return {
          currency: account.currency,
          total: account.total || "0",
          available: account.available || "0",
          positionMargin: account.positionMargin || "0",
          orderMargin: account.orderMargin || "0",
          unrealisedPnl: account.unrealisedPnl || "0",
        };
      } catch (error: any) {
        lastError = error;
        
        // 401 错误通常是认证问题，不需要重试
        if (error?.status === 401 || error?.response?.status === 401) {
          logger.error(`❌ Gate.io API 认证失败 (401)`);
          logger.error(`请检查：`);
          logger.error(`1. API Key 和 Secret 是否正确`);
          logger.error(`2. 是否使用了正确的测试网/正式网密钥`);
          logger.error(`3. API 密钥是否有期货交易权限`);
          logger.error(`当前使用: ${this.config.isTestnet ? '测试网' : '正式网'}`);
          logger.error(`API Key: ${this.config.apiKey.substring(0, 8)}...`);
          throw error;
        }
        
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
        const result = await this.futuresApi.listPositions(this.settle);
        const allPositions = result.body;
        
        // 过滤：只保留允许的币种
        const allowedSymbols = RISK_PARAMS.TRADING_SYMBOLS;
        const filteredPositions = allPositions?.filter((p: any) => {
          const symbol = p.contract?.split('_')[0];
          return symbol && allowedSymbols.includes(symbol);
        }) || [];
        
        return filteredPositions.map((p: any) => ({
          contract: p.contract,
          size: p.size || "0",
          leverage: p.leverage || "1",
          entryPrice: p.entryPrice || "0",
          markPrice: p.markPrice || "0",
          liqPrice: p.liqPrice || "0",
          unrealisedPnl: p.unrealisedPnl || "0",
          realisedPnl: p.realisedPnl || "0",
          margin: p.margin || "0",
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
    let adjustedSize = params.size;
    
    try {
      // 获取合约信息以验证数量
      const contractInfo = await this.getContractInfo(params.contract);
      
      const absSize = Math.abs(params.size);
      const API_MAX_SIZE = 10000000;
      
      // 检查最小数量限制
      if (contractInfo.orderSizeMin && absSize < contractInfo.orderSizeMin) {
        logger.warn(`订单数量 ${absSize} 小于最小限制 ${contractInfo.orderSizeMin}，调整为最小值`);
        adjustedSize = params.size > 0 ? contractInfo.orderSizeMin : -contractInfo.orderSizeMin;
      }
      
      // 检查最大数量限制
      const maxSize = contractInfo.orderSizeMax 
        ? Math.min(contractInfo.orderSizeMax, API_MAX_SIZE)
        : API_MAX_SIZE;
        
      if (absSize > maxSize) {
        logger.warn(`订单数量 ${absSize} 超过最大限制 ${maxSize}，调整为最大值`);
        adjustedSize = params.size > 0 ? maxSize : -maxSize;
      }

      // 验证价格偏离
      let adjustedPrice = params.price;
      if (params.price && params.price > 0) {
        const ticker = await this.getFuturesTicker(params.contract);
        const markPrice = Number.parseFloat(ticker.markPrice || ticker.last || "0");
        
        if (markPrice > 0) {
          const priceDeviation = Math.abs(params.price - markPrice) / markPrice;
          const maxDeviation = 0.015;
          
          if (priceDeviation > maxDeviation) {
            if (params.size > 0) {
              adjustedPrice = markPrice * (1 + maxDeviation);
            } else {
              adjustedPrice = markPrice * (1 - maxDeviation);
            }
            logger.warn(
              `订单价格 ${params.price.toFixed(6)} 偏离标记价格 ${markPrice} 超过 ${maxDeviation * 100}%，调整为 ${adjustedPrice.toFixed(6)}`
            );
          }
        }
      }

      // 格式化价格
      const formatPrice = (price: number | undefined): string => {
        if (!price || price === 0) return "0";
        const roundedPrice = Math.round(price * 100000000) / 100000000;
        let priceStr = roundedPrice.toString();
        if (priceStr.includes('.')) {
          priceStr = priceStr.replace(/\.?0+$/, "");
        }
        return priceStr;
      };

      const order: any = {
        contract: params.contract,
        size: adjustedSize,
        price: formatPrice(adjustedPrice),
      };
      
      const formattedPrice = formatPrice(adjustedPrice);
      if (formattedPrice !== "0") {
        order.tif = params.tif || "gtc";
      } else {
        order.tif = "ioc";
      }

      if (params.reduceOnly === true) {
        order.isReduceOnly = true;
      }

      if (params.autoSize !== undefined) {
        order.autoSize = params.autoSize;
      }

      if (params.stopLoss !== undefined && params.stopLoss > 0) {
        order.stopLoss = params.stopLoss.toString();
        logger.info(`设置止损价格: ${params.stopLoss}`);
      }
      
      if (params.takeProfit !== undefined && params.takeProfit > 0) {
        order.takeProfit = params.takeProfit.toString();
        logger.info(`设置止盈价格: ${params.takeProfit}`);
      }

      logger.info(`下单: ${JSON.stringify(order)}`);
      const result = await this.futuresApi.createFuturesOrder(
        this.settle,
        order
      );
      
      const orderResult = result.body;
      return {
        id: orderResult.id,
        contract: orderResult.contract,
        size: orderResult.size,
        price: orderResult.price || "0",
        status: orderResult.status,
        ...orderResult,
      };
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        apiError: error.response?.body || error.response?.data,
      };
      logger.error("下单失败:", errorDetails);
      
      if (errorDetails.apiError?.label === "INSUFFICIENT_AVAILABLE") {
        const msg = errorDetails.apiError.message || "可用保证金不足";
        throw new Error(`资金不足，无法开仓 ${params.contract}: ${msg}`);
      }
      
      const detailedMessage = errorDetails.apiError?.message || errorDetails.apiError?.label || error.message;
      throw new Error(`下单失败: ${detailedMessage} (${params.contract}, size: ${adjustedSize})`);
    }
  }

  async getContractInfo(contract: string): Promise<ContractInfo> {
    try {
      const result = await this.futuresApi.getFuturesContract(
        this.settle,
        contract
      );
      const info = result.body;
      return {
        name: info.name,
        quantoMultiplier: info.quantoMultiplier || "0.0001",
        orderSizeMin: Number.parseFloat(info.orderSizeMin || "1"),
        orderSizeMax: Number.parseFloat(info.orderSizeMax || "1000000"),
        orderPriceDeviate: info.orderPriceDeviate,
        ...info,
      };
    } catch (error) {
      logger.error(`获取 ${contract} 合约信息失败:`, error as any);
      throw error;
    }
  }

  async setLeverage(contract: string, leverage: number): Promise<any> {
    try {
      logger.info(`设置 ${contract} 杠杆为 ${leverage}x`);
      const result = await this.futuresApi.updatePositionLeverage(
        this.settle,
        contract,
        leverage.toString()
      );
      return result.body;
    } catch (error: any) {
      logger.warn(`设置 ${contract} 杠杆失败（可能已有持仓）:`, error.message);
      return null;
    }
  }

  async cancelAllOrders(contract?: string): Promise<any> {
    try {
      const options: any = {};
      if (contract) {
        options.contract = contract;
      }
      
      const result = await this.futuresApi.cancelPriceTriggeredOrderList(
        this.settle,
        options
      );
      return result.body;
    } catch (error) {
      logger.error("取消所有订单失败:", error as any);
      throw error;
    }
  }

  async getMyTrades(contract?: string, limit: number = 10): Promise<TradeRecord[]> {
    try {
      const options: any = { limit };
      if (contract) {
        options.contract = contract;
      }
      
      const result = await this.futuresApi.getMyFuturesTrades(
        this.settle,
        options
      );
      
      return result.body.map((trade: any) => ({
        id: trade.id,
        contract: trade.contract,
        size: trade.size || "0",
        price: trade.price || "0",
        fee: trade.fee || "0",
        timestamp: Number.parseInt(trade.createTime) * 1000,
        ...trade,
      }));
    } catch (error) {
      logger.error(`获取我的历史成交记录失败:`, error as any);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<any> {
    try {
      const result = await this.futuresApi.getFuturesOrder(
        this.settle,
        orderId
      );
      return result.body;
    } catch (error) {
      logger.error(`获取订单 ${orderId} 详情失败:`, error as any);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<any> {
    try {
      const result = await this.futuresApi.cancelFuturesOrder(
        this.settle,
        orderId
      );
      return result.body;
    } catch (error) {
      logger.error(`取消订单 ${orderId} 失败:`, error as any);
      throw error;
    }
  }

  async getOpenOrders(contract?: string): Promise<any[]> {
    try {
      const result = await this.futuresApi.listFuturesOrders(this.settle, "open", {
        contract,
      });
      return result.body;
    } catch (error) {
      logger.error("获取未成交订单失败:", error as any);
      throw error;
    }
  }

  async getFundingRate(contract: string): Promise<any> {
    try {
      const result = await this.futuresApi.listFuturesFundingRateHistory(
        this.settle,
        contract,
        { limit: 1 }
      );
      return result.body[0];
    } catch (error) {
      logger.error(`获取 ${contract} 资金费率失败:`, error as any);
      throw error;
    }
  }

  async getAllContracts(): Promise<any[]> {
    try {
      const result = await this.futuresApi.listFuturesContracts(this.settle);
      return result.body;
    } catch (error) {
      logger.error("获取合约列表失败:", error as any);
      throw error;
    }
  }

  async getOrderBook(contract: string, limit: number = 10): Promise<any> {
    try {
      const result = await this.futuresApi.listFuturesOrderBook(
        this.settle,
        contract,
        { limit }
      );
      return result.body;
    } catch (error) {
      logger.error(`获取 ${contract} 订单簿失败:`, error as any);
      throw error;
    }
  }

  async getPositionHistory(contract?: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const options: any = { limit, offset };
      if (contract) {
        options.contract = contract;
      }
      
      const result = await this.futuresApi.listFuturesLiquidatedOrders(
        this.settle,
        options
      );
      return result.body;
    } catch (error) {
      logger.error(`获取历史仓位记录失败:`, error as any);
      throw error;
    }
  }

  async getSettlementHistory(contract?: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const options: any = { limit, offset };
      if (contract) {
        options.contract = contract;
      }
      
      const result = await this.futuresApi.listFuturesSettlementHistory(
        this.settle,
        options
      );
      return result.body;
    } catch (error) {
      logger.error(`获取历史结算记录失败:`, error as any);
      throw error;
    }
  }

  async getOrderHistory(contract?: string, limit: number = 10): Promise<any[]> {
    try {
      const options: any = { limit };
      if (contract) {
        options.contract = contract;
      }
      
      const result = await this.futuresApi.listFuturesOrders(
        this.settle,
        "finished",
        options
      );
      return result.body;
    } catch (error) {
      logger.error(`获取订单历史失败:`, error as any);
      throw error;
    }
  }

  /**
   * 获取合约计价类型
   * Gate.io 使用反向合约（币本位）
   */
  getContractType(): 'inverse' | 'linear' {
    return 'inverse';
  }

  /**
   * 计算开仓所需数量（Gate.io 反向合约）
   * Gate.io 使用"张数"作为单位，每张合约代表一定数量的币
   * 例如：BTC_USDT: 1张 = 0.0001 BTC
   * 
   * 公式：quantity = (amountUsdt * leverage) / (quantoMultiplier * price)
   * 
   * @param amountUsdt 保证金金额 (USDT)
   * @param price 当前价格
   * @param leverage 杠杆倍数
   * @param contract 合约名称
   * @returns 张数（整数）
   */
  async calculateQuantity(
    amountUsdt: number,
    price: number,
    leverage: number,
    contract: string
  ): Promise<number> {
    const { getQuantoMultiplier } = await import('../utils/contractUtils.js');
    const quantoMultiplier = await getQuantoMultiplier(contract);
    
    // 计算张数
    let quantity = (amountUsdt * leverage) / (quantoMultiplier * price);
    
    // Gate.io 要求张数必须是整数，向下取整
    return Math.floor(quantity);
  }

  /**
   * 计算盈亏（Gate.io 反向合约）
   * 
   * 公式：
   * - 做多: (exitPrice - entryPrice) * quantity * quantoMultiplier
   * - 做空: (entryPrice - exitPrice) * quantity * quantoMultiplier
   * 
   * @param entryPrice 开仓价
   * @param exitPrice 平仓价
   * @param quantity 张数
   * @param side 方向
   * @param contract 合约名称
   * @returns 盈亏 (USDT)
   */
  async calculatePnl(
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    side: 'long' | 'short',
    contract: string
  ): Promise<number> {
    const { getQuantoMultiplier } = await import('../utils/contractUtils.js');
    const quantoMultiplier = await getQuantoMultiplier(contract);
    
    const priceChange = side === 'long' 
      ? (exitPrice - entryPrice) 
      : (entryPrice - exitPrice);
    
    return priceChange * quantity * quantoMultiplier;
  }
}
