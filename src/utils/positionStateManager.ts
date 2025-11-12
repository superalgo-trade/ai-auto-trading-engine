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
 * 持仓状态管理器
 * 用于追踪正在开仓/平仓的操作，避免健康检查误判
 */

interface PositionOperation {
  symbol: string;
  side: 'long' | 'short';
  operation: 'opening' | 'closing';
  startTime: number;
}

class PositionStateManager {
  private operations: Map<string, PositionOperation> = new Map();
  
  // 操作超时时间（毫秒），超过此时间认为操作已完成或失败
  private readonly OPERATION_TIMEOUT = 30000; // 30秒
  
  /**
   * 生成持仓的唯一键
   */
  private getKey(symbol: string, side: 'long' | 'short'): string {
    return `${symbol}_${side}`;
  }
  
  /**
   * 标记开始开仓操作
   */
  startOpening(symbol: string, side: 'long' | 'short'): void {
    const key = this.getKey(symbol, side);
    this.operations.set(key, {
      symbol,
      side,
      operation: 'opening',
      startTime: Date.now(),
    });
  }
  
  /**
   * 标记开仓操作完成
   */
  finishOpening(symbol: string, side: 'long' | 'short'): void {
    const key = this.getKey(symbol, side);
    this.operations.delete(key);
  }
  
  /**
   * 标记开始平仓操作
   */
  startClosing(symbol: string, side: 'long' | 'short'): void {
    const key = this.getKey(symbol, side);
    this.operations.set(key, {
      symbol,
      side,
      operation: 'closing',
      startTime: Date.now(),
    });
  }
  
  /**
   * 标记平仓操作完成
   */
  finishClosing(symbol: string, side: 'long' | 'short'): void {
    const key = this.getKey(symbol, side);
    this.operations.delete(key);
  }
  
  /**
   * 检查是否正在开仓
   */
  isOpening(symbol: string, side: 'long' | 'short'): boolean {
    const key = this.getKey(symbol, side);
    const op = this.operations.get(key);
    
    if (!op || op.operation !== 'opening') {
      return false;
    }
    
    // 检查是否超时
    if (Date.now() - op.startTime > this.OPERATION_TIMEOUT) {
      // 超时，自动清理
      this.operations.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查是否正在平仓
   */
  isClosing(symbol: string, side: 'long' | 'short'): boolean {
    const key = this.getKey(symbol, side);
    const op = this.operations.get(key);
    
    if (!op || op.operation !== 'closing') {
      return false;
    }
    
    // 检查是否超时
    if (Date.now() - op.startTime > this.OPERATION_TIMEOUT) {
      // 超时，自动清理
      this.operations.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取所有正在进行的操作
   */
  getActiveOperations(): PositionOperation[] {
    const now = Date.now();
    const active: PositionOperation[] = [];
    
    // 清理超时的操作，返回活跃的操作
    for (const [key, op] of this.operations.entries()) {
      if (now - op.startTime > this.OPERATION_TIMEOUT) {
        this.operations.delete(key);
      } else {
        active.push(op);
      }
    }
    
    return active;
  }
  
  /**
   * 清理所有状态（用于测试或重置）
   */
  clear(): void {
    this.operations.clear();
  }
}

// 导出单例
export const positionStateManager = new PositionStateManager();
