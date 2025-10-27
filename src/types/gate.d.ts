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
 * Gate API 类型扩展
 * 由于 gate-api 包的类型定义可能不完整或不准确，这里提供补充
 */

declare module "gate-api" {
  export interface FuturesAccount {
    currency?: string;
    total?: string;
    available?: string;
    position_margin?: string;
    positionMargin?: string;
    order_margin?: string;
    orderMargin?: string;
    unrealised_pnl?: string;
    unrealisedPnl?: string;
    [key: string]: any;
  }

  export interface Position {
    contract?: string;
    size?: string;
    leverage?: string;
    entry_price?: string;
    entryPrice?: string;
    mark_price?: string;
    markPrice?: string;
    liq_price?: string;
    liqPrice?: string;
    unrealised_pnl?: string;
    unrealisedPnl?: string;
    realised_pnl?: string;
    realisedPnl?: string;
    margin?: string;
    [key: string]: any;
  }

  export interface FuturesTicker {
    contract?: string;
    last?: string;
    mark_price?: string;
    markPrice?: string;
    index_price?: string;
    indexPrice?: string;
    high_24h?: string;
    high24h?: string;
    low_24h?: string;
    low24h?: string;
    volume_24h?: string;
    volume24h?: string;
    change_percentage?: string;
    changePercentage?: string;
    [key: string]: any;
  }
}

