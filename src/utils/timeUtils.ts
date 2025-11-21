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
 * 时间工具模块 - 统一使用中国时间（UTC+8）
 */

/**
 * 获取当前时间的 ISO 字符串（UTC 格式）
 * ⚠️ 重要修复：统一使用 UTC 格式，避免时区混乱导致的持仓时间计算错误
 * 数据库中所有 timestamp 字段必须使用统一的 UTC ISO 格式
 * @returns UTC 时间的 ISO 格式字符串 (如: 2025-11-21T00:11:18.685Z)
 */
export function getChinaTimeISO(): string {
  // 🔧 核心修复：统一返回 UTC 格式，兼容币安和 Gate.io
  // 之前返回 +08:00 格式导致数据库中存在两种时间格式，造成持仓时间计算错误
  return new Date().toISOString();
}

/**
 * 格式化中国时间为易读格式
 * @param date 日期对象或 ISO 字符串
 * @returns 格式化的中国时间字符串，如 "2025-10-22 14:30:45"
 */
export function formatChinaTime(date?: Date | string): string {
  let d: Date;
  
  if (!date) {
    d = new Date();
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }
  
  // 使用 toLocaleString 方法直接获取中国时间
  const chinaTimeString = d.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 转换格式：从 "2025/10/23 08:30:45" 到 "2025-10-23 08:30:45"
  return chinaTimeString.replace(/\//g, '-');
}

/**
 * 获取中国时间的日期对象
 * @returns 中国时间的 Date 对象（注意：Date对象本身不存储时区，只是调整了时间值）
 */
export function getChinaTime(): Date {
  const now = new Date();
  
  // 使用 toLocaleString 获取中国时间字符串
  const chinaTimeString = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 解析并创建新的Date对象
  // 格式: "2025/10/23 08:30:45"
  const [datePart, timePart] = chinaTimeString.split(' ');
  const [year, month, day] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  // 创建UTC时间，但值对应中国时间
  return new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));
}

/**
 * 将 UTC 时间转换为中国时间字符串
 * @param utcDate UTC 时间
 * @returns 中国时间字符串
 */
export function utcToChinaTime(utcDate: Date | string): string {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return formatChinaTime(d);
}

/**
 * 获取中国时间戳（毫秒）
 * @returns 中国时间的时间戳
 */
export function getChinaTimestamp(): number {
  return getChinaTime().getTime();
}

