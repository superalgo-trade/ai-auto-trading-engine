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
 * 交易所工厂
 * 根据配置创建相应的交易所客户端
 */
import { createPinoLogger } from "@voltagent/logger";
import type { IExchangeClient, ExchangeConfig } from "./IExchangeClient";
import { GateExchangeClient } from "./GateExchangeClient";
import { BinanceExchangeClient } from "./BinanceExchangeClient";

const logger = createPinoLogger({
  name: "exchange-factory",
  level: "info",
});

/**
 * 全局交易所客户端实例（单例模式）
 */
let exchangeClientInstance: IExchangeClient | null = null;

/**
 * 从环境变量读取交易所配置
 */
function getExchangeConfigFromEnv(): ExchangeConfig {
  // 读取交易所类型（默认为gate）
  const exchangeName = (process.env.EXCHANGE_NAME?.toLowerCase() || 'gate') as 'gate' | 'binance';
  
  // 根据交易所类型读取相应的API密钥
  let apiKey: string | undefined;
  let apiSecret: string | undefined;
  let isTestnet: boolean;

  if (exchangeName === 'binance') {
    apiKey = process.env.BINANCE_API_KEY;
    apiSecret = process.env.BINANCE_API_SECRET;
    isTestnet = process.env.BINANCE_USE_TESTNET === 'true';
  } else {
    // 默认使用Gate.io
    apiKey = process.env.GATE_API_KEY;
    apiSecret = process.env.GATE_API_SECRET;
    isTestnet = process.env.GATE_USE_TESTNET === 'true';
  }

  // 验证API密钥是否设置
  if (!apiKey || !apiSecret) {
    const prefix = exchangeName === 'binance' ? 'BINANCE' : 'GATE';
    throw new Error(
      `${prefix}_API_KEY 和 ${prefix}_API_SECRET 必须在环境变量中设置`
    );
  }

  return {
    exchangeName,
    apiKey,
    apiSecret,
    isTestnet,
  };
}

/**
 * 创建交易所客户端实例
 */
export function createExchangeClient(config?: ExchangeConfig): IExchangeClient {
  // 如果已存在实例，直接返回
  if (exchangeClientInstance) {
    return exchangeClientInstance;
  }

  // 如果没有提供配置，从环境变量读取
  const exchangeConfig = config || getExchangeConfigFromEnv();

  logger.info(`初始化 ${exchangeConfig.exchangeName.toUpperCase()} 交易所客户端...`);
  logger.info(`使用${exchangeConfig.isTestnet ? '测试网' : '正式网'}环境`);

  // 根据交易所类型创建相应的客户端
  switch (exchangeConfig.exchangeName) {
    case 'binance':
      exchangeClientInstance = new BinanceExchangeClient(exchangeConfig);
      break;
    case 'gate':
    default:
      exchangeClientInstance = new GateExchangeClient(exchangeConfig);
      break;
  }

  return exchangeClientInstance;
}

/**
 * 重置交易所客户端实例（主要用于测试）
 */
export function resetExchangeClient(): void {
  exchangeClientInstance = null;
}

/**
 * 获取当前交易所客户端实例
 */
export function getExchangeClient(): IExchangeClient {
  if (!exchangeClientInstance) {
    return createExchangeClient();
  }
  return exchangeClientInstance;
}
