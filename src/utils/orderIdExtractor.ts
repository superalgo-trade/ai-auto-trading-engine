/**
 * 订单ID提取工具 - 统一处理不同交易所的订单ID字段
 * 
 * 不同交易所使用不同的字段名：
 * - Gate.io: id, order_id
 * - Binance: algoId, orderId, clientOrderId
 * 
 * 此工具函数提供统一的ID提取接口，避免代码重复
 */

/**
 * 从订单对象中提取订单ID（兼容多种字段名）
 * 
 * @param order 订单对象（可能来自不同交易所）
 * @returns 订单ID字符串，如果没有ID则返回undefined
 */
export function extractOrderId(order: any): string | undefined {
  if (!order) return undefined;
  
  // 优先级顺序：
  // 1. algoId - 币安条件单（Algo Order）
  // 2. id - Gate.io 通用ID
  // 3. orderId - 币安普通订单ID
  // 4. order_id - 某些API返回的下划线格式
  // 5. clientOrderId - 客户端订单ID（备用）
  const orderId = order.algoId || order.id || order.orderId || order.order_id || order.clientOrderId;
  
  return orderId?.toString();
}

/**
 * 批量从订单列表中提取订单ID
 * 
 * @param orders 订单对象数组
 * @returns 订单ID数组（过滤掉undefined）
 */
export function extractOrderIds(orders: any[]): string[] {
  if (!Array.isArray(orders)) return [];
  
  return orders
    .map(order => extractOrderId(order))
    .filter((id): id is string => !!id);
}

/**
 * 创建订单ID映射表（ID -> 订单对象）
 * 
 * @param orders 订单对象数组
 * @returns Map对象，key为订单ID，value为订单对象
 */
export function createOrderIdMap(orders: any[]): Map<string, any> {
  if (!Array.isArray(orders)) return new Map();
  
  const map = new Map<string, any>();
  
  for (const order of orders) {
    const orderId = extractOrderId(order);
    if (orderId) {
      map.set(orderId, order);
    }
  }
  
  return map;
}
