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
 * Binance 交易所客户端实现 - 使用原生 fetch API
 */
import crypto from 'crypto';
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
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly config: ExchangeConfig;
  private timeOffset = 0;
  private readonly defaultRecvWindow = 60000;
  private lastSyncTime = 0;
  private syncPromise: Promise<void> | null = null;
  // 订单缓存：存储最近的订单信息 (orderId -> {contract, orderInfo, timestamp})
  private orderCache: Map<string, {contract: string, orderInfo: any, timestamp: number}> = new Map();
  private readonly MAX_CACHE_SIZE = 1000; // 最大缓存数量
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 缓存有效期：24小时

  constructor(config: ExchangeConfig) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    
    // 使用正式的测试网地址
    this.baseUrl = config.isTestnet 
      ? 'https://testnet.binancefuture.com' 
      : 'https://fapi.binance.com';

    if (config.isTestnet) {
      logger.info('使用 Binance U本位合约测试网');
    } else {
      logger.info('使用 Binance U本位合约正式网');
    }

    logger.info('Binance API 客户端初始化完成');

    // 初始化时同步服务器时间
    this.syncPromise = this.syncServerTime();
  }

  getExchangeName(): string {
    return "binance";
  }

  isTestnet(): boolean {
    return this.config.isTestnet;
  }

  normalizeContract(symbol: string): string {
    // 处理各种输入格式，转换为 Binance 格式 BTCUSDT
    let normalized = symbol.replace('_', '').replace('/', '').replace(':USDT', '');
    
    // 如果是简单的币种符号（如 BTC），添加 USDT 后缀
    if (!normalized.endsWith('USDT') && !normalized.includes('USDT')) {
      normalized = normalized + 'USDT';
    }
    
    return normalized;
  }

  extractSymbol(contract: string): string {
    // 从 BTCUSDT 或 BTC/USDT:USDT 提取 BTC
    const normalized = this.normalizeContract(contract);
    return normalized.replace('USDT', '');
  }

  /**
   * 清理过期的订单缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    // 找出过期的缓存
    for (const [orderId, cache] of this.orderCache.entries()) {
      if (now - cache.timestamp > this.CACHE_TTL) {
        keysToDelete.push(orderId);
      }
    }
    
    // 删除过期缓存
    for (const key of keysToDelete) {
      this.orderCache.delete(key);
    }
    
    // 如果缓存数量超过限制，删除最旧的条目
    if (this.orderCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.orderCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      for (const [orderId] of toDelete) {
        this.orderCache.delete(orderId);
      }
    }
  }

  /**
   * 同步服务器时间
   */
  private async syncServerTime(): Promise<void> {
    try {
      const t0 = Date.now();
      const response = await this.publicRequest('/fapi/v1/time');
      const t1 = Date.now();
      const serverTime = response.serverTime;
      
      // 计算往返时间和时间偏移
      const rtt = t1 - t0; // 往返时间
      const estimatedServerTime = serverTime + Math.floor(rtt / 2); // 估计当前服务器时间
      const localTime = t1;
      
      // 计算偏移量，并减去2秒的安全余量以避免时间戳超前
      const rawOffset = estimatedServerTime - localTime;
      this.timeOffset = rawOffset - 2000; // 减去2秒安全余量
      this.lastSyncTime = Date.now();
      
    //   logger.info(`服务器时间同步完成，原始偏差: ${rawOffset}ms，应用偏差: ${this.timeOffset}ms，RTT: ${rtt}ms`);
    } catch (error) {
      logger.error('同步服务器时间失败:', error as Error);
      throw error;
    }
  }

  /**
   * 确保时间已同步
   */
  private async ensureTimeSynced(): Promise<void> {
    // 如果正在同步，等待完成
    if (this.syncPromise) {
      await this.syncPromise;
      this.syncPromise = null;
      return;
    }
    
    // 如果超过2分钟未同步，重新同步（更频繁的同步）
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    if (timeSinceLastSync > 2 * 60 * 1000) {
    //   logger.info('时间同步已过期，重新同步...');
      await this.syncServerTime();
    }
  }

  /**
   * 获取当前服务器时间
   */
  private getServerTime(): number {
    return Date.now() + this.timeOffset;
  }

  /**
   * 生成签名
   */
  private generateSignature(data: any): string {
    const queryString = Object.keys(data)
      .map(key => `${key}=${data[key]}`)
      .join('&');
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * 处理API请求，包含重试、超时和错误处理逻辑
   */
  private async handleRequest(url: URL, options: RequestInit, retries = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutMs = 15000 + (attempt - 1) * 5000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        options.signal = controller.signal;
        const response = await fetch(url.toString(), options);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          
          // 如果是时间戳错误 (-1021)，重新同步时间并重试
          if (error.code === -1021 && attempt < retries) {
            logger.warn(`时间戳错误，重新同步服务器时间 (${attempt}/${retries})`);
            await this.syncServerTime();
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          if (attempt === retries) {
            logger.error(`API请求失败(${attempt}/${retries}):`, error as Error);
            throw new Error(`API请求失败: ${error.msg || error.message || response.statusText}`);
          }
          logger.warn(`API请求失败(${attempt}/${retries}):`, error);
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 3000)));
          continue;
        }

        return response.json();

      } catch (error: any) {
        clearTimeout(timeoutId);

        const isTimeout = error.name === 'AbortError' || 
                         error.message?.includes('timeout') ||
                         error.message?.includes('aborted');

        if (attempt === retries) {
          logger.error(`API请求失败(${attempt}/${retries}):`, error as Error);
          throw error;
        }

        // logger.warn(`${isTimeout ? '请求超时' : 'API请求失败'}(${attempt}/${retries}), 将在 ${isTimeout ? attempt * 2 : attempt} 秒后重试`);
        
        const delay = isTimeout ? 
          Math.min(2000 * attempt, 6000) : 
          Math.min(1000 * attempt, 3000);
          
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`API请求失败，已重试${retries}次`);
  }

  /**
   * 发送公共请求
   */
  private async publicRequest(endpoint: string, params: any = {}, retries = 3): Promise<any> {
    const url = new URL(this.baseUrl + endpoint);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    return this.handleRequest(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 AI-Auto-Trading Bot',
      }
    }, retries);
  }

  /**
   * 发送私有请求（需要签名）
   */
  private async privateRequest(endpoint: string, params: any = {}, method = 'GET', retries = 3): Promise<any> {
    // 确保时间已同步
    await this.ensureTimeSynced();
    
    // 使用专门的处理函数来处理带签名的请求
    return this.handleSignedRequest(endpoint, params, method, retries);
  }

  /**
   * 处理需要签名的请求（每次重试都重新生成签名）
   */
  private async handleSignedRequest(endpoint: string, params: any, method: string, retries: number): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // 每次重试都生成新的时间戳和签名
        const timestamp = this.getServerTime();
        const data = {
          ...params,
          timestamp,
          recvWindow: this.defaultRecvWindow
        };
        
        // 生成签名
        const signature = this.generateSignature(data);
        data.signature = signature;

        // 准备请求URL和选项
        const url = new URL(this.baseUrl + endpoint);
        const options: RequestInit = {
          method,
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'User-Agent': 'Mozilla/5.0 AI-Auto-Trading Bot',
          }
        };

        if (method === 'GET' || method === 'DELETE') {
          Object.keys(data).forEach(key => url.searchParams.append(key, data[key]));
        } else {
          options.body = new URLSearchParams(data);
          options.headers = {
            ...options.headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          };
        }

        // 执行单次请求
        const controller = new AbortController();
        const timeoutMs = 15000 + (attempt - 1) * 5000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          options.signal = controller.signal;
          const response = await fetch(url.toString(), options);
          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = await response.json();
            
            // 如果是时间戳错误 (-1021)，重新同步时间并重试
            if (error.code === -1021 && attempt < retries) {
              logger.warn(`时间戳错误，重新同步服务器时间 (${attempt}/${retries})`);
              await this.syncServerTime();
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
            
            if (attempt === retries) {
              logger.error(`API请求失败(${attempt}/${retries}):`, error as Error);
              throw new Error(`API请求失败: ${error.msg || error.message || response.statusText}`);
            }
            logger.warn(`API请求失败(${attempt}/${retries}):`, error);
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 3000)));
            continue;
          }

          return response.json();
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          const isTimeout = fetchError.name === 'AbortError' || 
                           fetchError.message?.includes('timeout') ||
                           fetchError.message?.includes('aborted');

          if (attempt === retries) {
            throw fetchError;
          }

        //   logger.warn(`${isTimeout ? '请求超时' : 'API请求失败'}(${attempt}/${retries}), 将在 ${attempt} 秒后重试`);
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 3000)));
        }
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
      }
    }

    throw new Error(`API请求失败，已重试${retries}次`);
  }

  async getFuturesTicker(contract: string, retries: number = 2): Promise<TickerInfo> {
    try {
      const symbol = this.normalizeContract(contract);
      const [ticker, markPrice] = await Promise.all([
        this.publicRequest('/fapi/v1/ticker/24hr', { symbol }, retries),
        this.publicRequest('/fapi/v1/premiumIndex', { symbol }, retries)
      ]);
      
      return {
        contract: contract,
        last: ticker.lastPrice,
        markPrice: markPrice.markPrice,
        indexPrice: markPrice.indexPrice,
        volume24h: ticker.volume,
        high24h: ticker.highPrice,
        low24h: ticker.lowPrice,
        change24h: ticker.priceChangePercent,
      };
    } catch (error) {
      logger.error(`获取 ${contract} 行情失败:`, error as Error);
      throw error;
    }
  }

  async getFuturesCandles(
    contract: string,
    interval: string = '1h',
    limit: number = 100,
    from?: number,
    to?: number,
    retries: number = 2
  ): Promise<CandleData[]> {
    try {
      const symbol = this.normalizeContract(contract);
      const params: any = {
        symbol,
        interval,
        limit
      };

      if (from) params.startTime = from;
      if (to) params.endTime = to;

      const response = await this.publicRequest('/fapi/v1/klines', params, retries);

      return response.map((k: any[]) => ({
        timestamp: k[0],
        open: k[1].toString(),
        high: k[2].toString(),
        low: k[3].toString(),
        close: k[4].toString(),
        volume: k[5].toString(),
      }));
    } catch (error) {
      logger.error(`获取 ${contract} K线数据失败:`, error as Error);
      throw error;
    }
  }

  async getFuturesAccount(retries: number = 2): Promise<AccountInfo> {
    try {
      const account = await this.privateRequest('/fapi/v2/account', {}, 'GET', retries);
      
      return {
        currency: 'USDT',
        total: account.totalWalletBalance,
        available: account.availableBalance,
        positionMargin: account.totalPositionInitialMargin || '0',
        orderMargin: account.totalOpenOrderInitialMargin || '0',
        unrealisedPnl: account.totalUnrealizedProfit,
      };
    } catch (error) {
      logger.error('获取账户信息失败:', error as Error);
      throw error;
    }
  }

  async getPositions(retries: number = 2): Promise<PositionInfo[]> {
    try {
      const positions = await this.privateRequest('/fapi/v2/positionRisk', {}, 'GET', retries);
      
    //   logger.info(`API 返回 ${positions.length} 个持仓记录`);
      
      // 详细记录每个持仓的原始数据
      const filteredPositions = positions.filter((p: any) => {
        const posAmount = parseFloat(p.positionAmt);
        const entryPrice = parseFloat(p.entryPrice);
        // 有时候 positionAmt 为 0 但 entryPrice 不为 0，说明订单还在处理中
        return posAmount !== 0 || entryPrice !== 0;
      });
      
    //   logger.info(`过滤后有效持仓数: ${filteredPositions.length}`);
      
      return filteredPositions.map((p: any) => {
        const posAmount = parseFloat(p.positionAmt);
        const entryPrice = parseFloat(p.entryPrice);
        const markPrice = parseFloat(p.markPrice);
        const leverage = parseInt(p.leverage);
        
        // 🔧 计算保证金（开仓价值）
        // Binance USDT永续合约：保证金 = |持仓数量 * 开仓价格| / 杠杆
        const notional = Math.abs(posAmount * entryPrice);
        const margin = leverage > 0 ? (notional / leverage) : notional;
        
        // 保留原始的 posAmount（带符号），供平仓时使用
        return {
          contract: p.symbol,
          size: posAmount.toString(), // 保留符号：正数=多头，负数=空头
          leverage: leverage.toString(),
          entryPrice: entryPrice.toString(),
          markPrice: markPrice.toString(),
          liqPrice: p.liquidationPrice,
          unrealisedPnl: p.unRealizedProfit,
          realisedPnl: '0',
          margin: margin.toString(),
        };
      });
    } catch (error) {
      logger.error('获取持仓失败:', error as Error);
      throw error;
    }
  }

  async placeOrder(params: OrderParams, retries: number = 2): Promise<OrderResponse> {
    try {
      const symbol = this.normalizeContract(params.contract);
      const orderType = params.price ? 'LIMIT' : 'MARKET';
      
      // 🔧 币安使用 quantity 字段（币种数量），需要处理精度
      let quantity = Math.abs(params.size);
      
      // 获取合约信息以确定精度
      try {
        const contractInfo = await this.getContractInfo(params.contract);
        const minQty = contractInfo.orderSizeMin;
        
        // 根据 minQty 确定小数位数
        const decimalPlaces = minQty >= 1 ? 0 : Math.abs(Math.floor(Math.log10(minQty)));
        const multiplier = Math.pow(10, decimalPlaces);
        
        // 修正精度（防止浮点数累积误差，如 956.8100000000001）
        quantity = Math.floor(quantity * multiplier) / multiplier;
        
        logger.debug(`下单数量精度修正: 原始=${Math.abs(params.size).toFixed(8)} -> 修正=${quantity.toFixed(8)} (精度=${decimalPlaces}位)`);
      } catch (error) {
        logger.warn('获取合约精度失败，使用默认精度处理:', error as Error);
        // 使用默认精度（3位小数）
        quantity = Math.floor(quantity * 1000) / 1000;
      }
      
      const data: any = {
        symbol,
        side: params.size > 0 ? 'BUY' : 'SELL',
        type: orderType,
        // 使用 toFixed 避免科学计数法，然后移除末尾的0
        quantity: parseFloat(quantity.toFixed(8)).toString()
      };

      if (params.price) {
        data.price = params.price.toString();
        data.timeInForce = params.tif || 'GTC';
      }

      if (params.reduceOnly) {
        data.reduceOnly = true;
      }

      const response = await this.privateRequest('/fapi/v1/order', data, 'POST', retries);
      
      const orderResponse = {
        id: response.orderId.toString(),
        contract: params.contract,
        size: params.size,
        price: response.avgPrice || response.price || '0',
        status: response.status === 'FILLED' ? 'finished' : 
                response.status === 'NEW' ? 'open' : 
                response.status.toLowerCase(),
        create_time: response.updateTime,
        fill_price: response.avgPrice || '0',
        left: (parseFloat(response.origQty || '0') - parseFloat(response.executedQty || '0')).toString()
      };
      
      // 缓存订单信息供后续查询使用
      this.orderCache.set(orderResponse.id, {
        contract: params.contract,
        orderInfo: orderResponse,
        timestamp: Date.now()
      });
      
      // 定期清理过期缓存
      this.cleanupCache();
      
      return orderResponse;
    } catch (error) {
      logger.error('下单失败:', error as Error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<OrderResponse> {
    try {
      // 首先检查缓存
      const cached = this.orderCache.get(orderId);
      
      if (cached) {
        // 从缓存中获取 contract，使用 Binance API 查询最新状态
        const symbol = this.normalizeContract(cached.contract);
        try {
          const response = await this.privateRequest('/fapi/v1/order', {
            symbol,
            orderId
          }, 'GET', 2);
          
          const orderResponse = {
            id: response.orderId.toString(),
            contract: cached.contract,
            size: (response.side === 'BUY' ? 1 : -1) * parseFloat(response.origQty || '0'),
            price: response.price || '0',
            status: response.status === 'FILLED' ? 'finished' : 
                    response.status === 'NEW' ? 'open' : 
                    response.status === 'CANCELED' ? 'cancelled' :
                    response.status.toLowerCase(),
            create_time: response.time,
            fill_price: response.avgPrice || '0',
            left: (parseFloat(response.origQty || '0') - parseFloat(response.executedQty || '0')).toString()
          };
          
          // 更新缓存
          this.orderCache.set(orderId, {
            contract: cached.contract,
            orderInfo: orderResponse,
            timestamp: Date.now()
          });
          
          return orderResponse;
        } catch (apiError) {
          // 如果 API 查询失败，返回缓存的信息
          logger.warn(`API查询订单失败，使用缓存信息: ${apiError}`);
          return cached.orderInfo;
        }
      }
      
      // 如果缓存中没有，尝试从未成交订单中查找
      const openOrders = await this.getOpenOrders();
      const order = openOrders.find(o => o.id === orderId);
      
      if (order) {
        return order;
      }
      
      // 如果都找不到，返回一个基本的响应（避免中断交易流程）
      logger.warn(`订单 ${orderId} 未在缓存或未成交订单中找到，返回默认状态`);
      return {
        id: orderId,
        contract: 'UNKNOWN',
        size: 0,
        price: '0',
        status: 'finished', // 假设已成交
        create_time: Date.now(),
        fill_price: '0',
        left: '0'
      };
    } catch (error) {
      logger.error('获取订单失败:', error as Error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    // Binance 需要 symbol 参数，但接口定义只有 orderId
    // 这里我们尝试获取所有未成交订单来查找 symbol
    try {
      const openOrders = await this.getOpenOrders();
      const order = openOrders.find(o => o.id === orderId);
      
      if (!order) {
        throw new Error(`Order ${orderId} not found. Cannot cancel without symbol.`);
      }
      
      const symbol = this.normalizeContract(order.contract);
      await this.privateRequest('/fapi/v1/order', {
        symbol,
        orderId
      }, 'DELETE');
    } catch (error) {
      logger.error('取消订单失败:', error as Error);
      throw error;
    }
  }

  async getOpenOrders(contract?: string, retries: number = 2): Promise<OrderResponse[]> {
    try {
      const params: any = {};
      if (contract) {
        params.symbol = this.normalizeContract(contract);
      }
      
      const orders = await this.privateRequest('/fapi/v1/openOrders', params, 'GET', retries);
      
      return orders.map((order: any) => ({
        id: order.orderId.toString(),
        contract: order.symbol,
        size: (order.side === 'BUY' ? 1 : -1) * parseFloat(order.origQty || '0'),
        price: order.price || '0',
        status: 'open',
        create_time: order.time,
        fill_price: order.avgPrice || '0',
        left: (parseFloat(order.origQty || '0') - parseFloat(order.executedQty || '0')).toString()
      }));
    } catch (error) {
      logger.error('获取未成交订单失败:', error as Error);
      throw error;
    }
  }

  async setLeverage(contract: string, leverage: number, retries: number = 2): Promise<void> {
    try {
      const symbol = this.normalizeContract(contract);
      await this.privateRequest('/fapi/v1/leverage', {
        symbol,
        leverage
      }, 'POST', retries);
      logger.info(`已设置 ${contract} 杠杆为 ${leverage}x`);
    } catch (error) {
      logger.error(`设置杠杆失败:`, error as Error);
      throw error;
    }
  }

  async getContractInfo(contract: string, retries: number = 2): Promise<ContractInfo> {
    try {
      const symbol = this.normalizeContract(contract);
      const response = await this.publicRequest('/fapi/v1/exchangeInfo', {}, retries);
      const symbolInfo = response.symbols.find((s: any) => s.symbol === symbol);
      
      if (!symbolInfo) {
        throw new Error(`Contract ${contract} not found`);
      }

      const lotSizeFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
      const priceFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
      
      return {
        name: symbolInfo.symbol,
        quantoMultiplier: '1',
        orderSizeMin: parseFloat(lotSizeFilter?.minQty || '0.001'),
        orderSizeMax: parseFloat(lotSizeFilter?.maxQty || '1000000'),
        orderPriceDeviate: '0.05',
        type: 'direct',
        leverage_min: '1',
        leverage_max: '125',
        maintenance_rate: '0.004',
        mark_type: 'index',
        mark_price: '0',
        index_price: '0',
        last_price: '0',
        maker_fee_rate: symbolInfo.maker || '0.0002',
        taker_fee_rate: symbolInfo.taker || '0.0004',
        order_price_round: priceFilter?.tickSize || '0.01',
        mark_price_round: priceFilter?.tickSize || '0.01',
        funding_rate: '0',
        funding_interval: 28800,
        funding_next_apply: Date.now() + 28800000,
        risk_limit_base: '1000000',
        risk_limit_step: '500000',
        risk_limit_max: '8000000',
        ref_discount_rate: '0',
        ref_rebate_rate: '0.15',
        orderbook_id: Date.now(),
        trade_id: Date.now(),
        trade_size: 0,
        position_size: 0,
        config_change_time: Date.now(),
        in_delisting: false,
        orders_limit: 200,
      };
    } catch (error) {
      logger.error(`获取合约信息失败:`, error as Error);
      throw error;
    }
  }

  async getOrderBook(contract: string, limit: number = 100, retries: number = 2): Promise<any> {
    try {
      const symbol = this.normalizeContract(contract);
      const response = await this.publicRequest('/fapi/v1/depth', {
        symbol,
        limit
      }, retries);
      
      // 将 Binance 的格式 [["价格", "数量"]] 转换为 Gate.io 的格式 [{p: "价格", s: "数量"}]
      // 以保持接口一致性
      return {
        bids: response.bids.map((bid: any[]) => ({
          p: bid[0].toString(),
          s: bid[1].toString()
        })),
        asks: response.asks.map((ask: any[]) => ({
          p: ask[0].toString(),
          s: ask[1].toString()
        }))
      };
    } catch (error) {
      logger.error('获取订单簿失败:', error as Error);
      throw error;
    }
  }

  async getMyTrades(contract?: string, limit: number = 100, retries: number = 2): Promise<TradeRecord[]> {
    try {
      const params: any = { limit };
      if (contract) {
        params.symbol = this.normalizeContract(contract);
      }
      
      const trades = await this.privateRequest('/fapi/v1/userTrades', params, 'GET', retries);
      
      return trades.map((trade: any) => ({
        id: trade.id.toString(),
        contract: trade.symbol,
        create_time: trade.time,
        order_id: trade.orderId.toString(),
        size: (trade.side === 'BUY' ? 1 : -1) * parseFloat(trade.qty),
        price: trade.price,
        role: trade.maker ? 'maker' : 'taker',
      }));
    } catch (error) {
      logger.error('获取成交记录失败:', error as Error);
      throw error;
    }
  }

  async getFundingRate(contract: string, retries: number = 2): Promise<any> {
    try {
      const symbol = this.normalizeContract(contract);
      const response = await this.publicRequest('/fapi/v1/premiumIndex', { symbol }, retries);
      
      return {
        funding_rate: response.lastFundingRate,
        next_funding_time: response.nextFundingTime
      };
    } catch (error) {
      logger.error('获取资金费率失败:', error as Error);
      throw error;
    }
  }

  async getAllContracts(): Promise<any[]> {
    try {
      const response = await this.publicRequest('/fapi/v1/exchangeInfo');
      return response.symbols.filter((s: any) => 
        s.status === 'TRADING' && 
        s.contractType === 'PERPETUAL' &&
        s.quoteAsset === 'USDT'
      );
    } catch (error) {
      logger.error('获取所有合约失败:', error as Error);
      throw error;
    }
  }

  async getPositionHistory(contract?: string, limit?: number, offset?: number): Promise<any[]> {
    // Binance doesn't have a direct position history endpoint, return empty array
    return [];
  }

  async getSettlementHistory(contract?: string, limit?: number, offset?: number): Promise<any[]> {
    // Binance doesn't have a direct settlement history endpoint, return empty array
    return [];
  }

  async getOrderHistory(contract?: string, limit?: number): Promise<any[]> {
    try {
      const params: any = {};
      if (contract) {
        params.symbol = this.normalizeContract(contract);
      }
      if (limit) {
        params.limit = limit;
      }
      return await this.privateRequest('/fapi/v1/allOrders', params);
    } catch (error) {
      logger.error('获取订单历史失败:', error as Error);
      throw error;
    }
  }

  getContractType(): 'inverse' | 'linear' {
    return 'linear'; // Binance USDT 永续合约是正向合约（USDT 本位）
  }

  async cancelAllOrders(contract?: string): Promise<any> {
    try {
      const params: any = {};
      if (contract) {
        params.symbol = this.normalizeContract(contract);
      }
      return await this.privateRequest('/fapi/v1/allOpenOrders', params, 'DELETE');
    } catch (error) {
      logger.error('取消所有订单失败:', error as Error);
      throw error;
    }
  }

  async calculateQuantity(
    amountUsdt: number,
    price: number,
    leverage: number,
    contract: string
  ): Promise<number> {
    // Binance 使用币种数量（币本位）
    // 计算公式：数量 = (保证金金额 * 杠杆) / 价格
    const quantity = (amountUsdt * leverage) / price;
    
    // 获取合约信息以确定精度
    try {
      const contractInfo = await this.getContractInfo(contract);
      const minQty = contractInfo.orderSizeMin;
      
      // 🔧 精度修复：根据 minQty 确定小数位数
      // minQty=0.001 -> 3位, 0.01 -> 2位, 0.1 -> 1位, 1 -> 0位
      const decimalPlaces = minQty >= 1 ? 0 : Math.abs(Math.floor(Math.log10(minQty)));
      const multiplier = Math.pow(10, decimalPlaces);
      
      // 向下取整到指定精度，避免浮点数精度问题
      const roundedQuantity = Math.floor(quantity * multiplier) / multiplier;
      
      // 确保不小于最小值
      const finalQuantity = Math.max(roundedQuantity, minQty);
      
      // 🔧 再次修正精度（防止浮点数累积误差）
      const finalRounded = Math.floor(finalQuantity * multiplier) / multiplier;
      
      logger.debug(`精度修正: 原始=${quantity.toFixed(8)} -> 四舍五入=${roundedQuantity.toFixed(8)} -> 最终=${finalRounded.toFixed(8)} (minQty=${minQty}, 精度=${decimalPlaces}位)`);
      
      return finalRounded;
    } catch (error) {
      logger.warn('获取合约信息失败，使用默认精度:', error as Error);
      // 使用默认精度（3位小数）
      return Math.floor(quantity * 1000) / 1000;
    }
  }

  async calculatePnl(
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    side: 'long' | 'short',
    contract: string
  ): Promise<number> {
    // Binance USDT 永续合约 PNL 计算（正向合约）
    // 多头：PNL = 数量 * (平仓价 - 开仓价)
    // 空头：PNL = 数量 * (开仓价 - 平仓价)
    
    if (side === 'long') {
      return quantity * (exitPrice - entryPrice);
    } else {
      return quantity * (entryPrice - exitPrice);
    }
  }
}
