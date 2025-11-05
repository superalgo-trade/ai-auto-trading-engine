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
 * 工具函数导出
 */
export * from './timeUtils';

/**
 * 解析持仓或订单的 size 字段
 * 支持整数和小数，兼容 Gate.io（张数）和 Binance（币数量）
 * @param sizeValue - size 字段的值（可能是字符串或数字）
 * @returns 解析后的数值
 */
export function parsePositionSize(sizeValue: string | number | undefined | null): number {
  if (sizeValue === undefined || sizeValue === null || sizeValue === '') {
    return 0;
  }
  
  const parsed = Number.parseFloat(sizeValue.toString());
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 检查持仓或订单是否有效（size 不为 0）
 * @param sizeValue - size 字段的值
 * @returns 是否有效
 */
export function isValidPosition(sizeValue: string | number | undefined | null): boolean {
  return parsePositionSize(sizeValue) !== 0;
}
