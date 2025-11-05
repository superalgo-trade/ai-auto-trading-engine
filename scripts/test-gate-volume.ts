#!/usr/bin/env ts-node

/**
 * Gate.io 测试网成交量测试脚本
 * 用于直接获取指定币种的 K线数据和 volume 字段，验证 Gate.io 测试网数据质量
 */

import crypto from 'crypto';

// Gate.io 测试网配置
const GATE_TESTNET_BASE_URL = 'https://fx-api-testnet.gateio.ws';
const GATE_API_KEY = process.env.GATE_API_KEY || '';
const GATE_API_SECRET = process.env.GATE_API_SECRET || '';

// 测试的币种列表（可以从命令行参数获取）
const TEST_SYMBOLS = process.argv.slice(2).length > 0 
  ? process.argv.slice(2) 
  : ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'DOGE_USDT'];

interface GateKline {
  t: string;  // 时间戳（秒）
  v: number;  // 成交量（币）
  c: string;  // 收盘价
  h: string;  // 最高价
  l: string;  // 最低价
  o: string;  // 开盘价
  a?: string; // 成交额
}

interface GateTicker {
  currency_pair: string;
  last: string;
  lowest_ask?: string;
  highest_bid?: string;
  change_percentage: string;
  base_volume: string;  // 24h 基础货币成交量
  quote_volume: string; // 24h 计价货币成交量
  high_24h: string;
  low_24h: string;
}

/**
 * 生成 Gate.io API 签名
 */
function generateSignature(method: string, path: string, queryString: string, body: string, timestamp: number): string {
  const payloadHash = crypto.createHash('sha512').update(body).digest('hex');
  const signString = `${method}\n${path}\n${queryString}\n${payloadHash}\n${timestamp}`;
  return crypto.createHmac('sha512', GATE_API_SECRET).update(signString).digest('hex');
}

/**
 * 获取 Ticker 数据
 */
async function getTicker(symbol: string): Promise<GateTicker | null> {
  try {
    const url = `${GATE_TESTNET_BASE_URL}/api/v4/futures/usdt/tickers?contract=${symbol}`;
    console.log(`\n📊 获取 Ticker: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ticker 请求失败: ${response.status} ${response.statusText}`);
      console.error(`错误详情: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Ticker 原始数据:`, JSON.stringify(data, null, 2));
    
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (error) {
    console.error(`❌ 获取 Ticker 失败:`, error);
    return null;
  }
}

/**
 * 获取 K线数据
 */
async function getKlines(symbol: string, interval: string = '1h', limit: number = 5): Promise<GateKline[] | null> {
  try {
    const url = `${GATE_TESTNET_BASE_URL}/api/v4/futures/usdt/candlesticks?contract=${symbol}&interval=${interval}&limit=${limit}`;
    console.log(`\n📈 获取 K线: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ K线 请求失败: ${response.status} ${response.statusText}`);
      console.error(`错误详情: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ K线 原始数据:`, JSON.stringify(data, null, 2));
    
    if (Array.isArray(data)) {
      return data;
    }
    return null;
  } catch (error) {
    console.error(`❌ 获取 K线 失败:`, error);
    return null;
  }
}

/**
 * 获取合约信息
 */
async function getContractInfo(symbol: string): Promise<any> {
  try {
    const url = `${GATE_TESTNET_BASE_URL}/api/v4/futures/usdt/contracts/${symbol}`;
    console.log(`\n📋 获取合约信息: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ 合约信息请求失败: ${response.status} ${response.statusText}`);
      console.error(`错误详情: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ 合约信息:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error(`❌ 获取合约信息失败:`, error);
    return null;
  }
}

/**
 * 分析成交量数据
 */
function analyzeVolumeData(ticker: GateTicker | null, klines: GateKline[] | null, symbol: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ${symbol} 成交量分析`);
  console.log(`${'='.repeat(80)}`);

  // Ticker 成交量
  if (ticker) {
    console.log(`\n【Ticker 24h 成交量】`);
    console.log(`  基础货币成交量 (base_volume): ${ticker.base_volume || '0'}`);
    console.log(`  计价货币成交量 (quote_volume): ${ticker.quote_volume || '0'}`);
    console.log(`  当前价格 (last): ${ticker.last}`);
    console.log(`  24h 涨跌幅: ${ticker.change_percentage}%`);
  } else {
    console.log(`\n❌ 未获取到 Ticker 数据`);
  }

  // K线成交量
  if (klines && klines.length > 0) {
    console.log(`\n【K线成交量】`);
    console.log(`  共 ${klines.length} 条 K线数据:`);
    
    let totalVolume = 0;
    let nonZeroCount = 0;
    
    klines.forEach((kline, index) => {
      const timestamp = new Date(parseInt(kline.t) * 1000).toISOString();
      const volume = kline.v || 0;
      totalVolume += volume;
      if (volume > 0) nonZeroCount++;
      
      console.log(`  [${index + 1}] ${timestamp}`);
      console.log(`      开: ${kline.o}, 高: ${kline.h}, 低: ${kline.l}, 收: ${kline.c}`);
      console.log(`      成交量 (v): ${volume}${volume === 0 ? ' ⚠️  为0!' : ' ✓'}`);
      if (kline.a) {
        console.log(`      成交额 (a): ${kline.a}`);
      }
    });
    
    console.log(`\n  统计:`);
    console.log(`    总成交量: ${totalVolume}`);
    console.log(`    非零K线数: ${nonZeroCount}/${klines.length}`);
    console.log(`    零成交量K线数: ${klines.length - nonZeroCount}/${klines.length}`);
    
    if (nonZeroCount === 0) {
      console.log(`\n  ⚠️  警告: 所有 K线成交量均为 0！这是 Gate.io 测试网数据质量问题。`);
    } else if (nonZeroCount < klines.length) {
      console.log(`\n  ⚠️  部分 K线成交量为 0，数据不完整。`);
    } else {
      console.log(`\n  ✅ 所有 K线成交量均有效。`);
    }
  } else {
    console.log(`\n❌ 未获取到 K线 数据`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Gate.io 测试网成交量测试脚本`);
  console.log(`${'='.repeat(80)}`);
  console.log(`测试网地址: ${GATE_TESTNET_BASE_URL}`);
  console.log(`测试币种: ${TEST_SYMBOLS.join(', ')}`);
  console.log(`测试时间: ${new Date().toISOString()}`);

  for (const symbol of TEST_SYMBOLS) {
    console.log(`\n\n${'#'.repeat(80)}`);
    console.log(`🔍 测试币种: ${symbol}`);
    console.log(`${'#'.repeat(80)}`);

    // 1. 获取合约信息
    await getContractInfo(symbol);

    // 2. 获取 Ticker
    const ticker = await getTicker(symbol);

    // 3. 获取多个时间周期的 K线
    console.log(`\n--- 1小时 K线 (最近5根) ---`);
    const klines1h = await getKlines(symbol, '1h', 5);

    console.log(`\n--- 15分钟 K线 (最近5根) ---`);
    const klines15m = await getKlines(symbol, '15m', 5);

    console.log(`\n--- 5分钟 K线 (最近5根) ---`);
    const klines5m = await getKlines(symbol, '5m', 5);

    // 4. 分析成交量数据
    analyzeVolumeData(ticker, klines1h, symbol);

    // 等待一下，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`✅ 测试完成`);
  console.log(`${'='.repeat(80)}`);
  console.log(`\n【结论】`);
  console.log(`如果所有币种的 K线 volume 字段都为 0，则确认是 Gate.io 测试网的数据质量问题。`);
  console.log(`建议:`);
  console.log(`  1. 在测试环境下，可以使用 Ticker 的 24h 成交量作为替代`);
  console.log(`  2. 在生产环境中，K线 volume 字段应该有有效数据`);
  console.log(`  3. 如果需要测试完整功能，建议使用币安测试网或 Gate.io 正式网`);
  console.log(`\n`);
}

// 运行测试
main().catch(error => {
  console.error(`\n❌ 测试脚本执行失败:`, error);
  process.exit(1);
});
