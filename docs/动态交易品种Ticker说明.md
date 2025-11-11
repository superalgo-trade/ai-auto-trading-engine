# 动态交易品种 Ticker 说明

## 📋 修改概述

将前端页面中写死的加密货币 Ticker 改为动态从后端配置加载，实现交易品种列表的灵活配置。

## 🔧 修改内容

### 1. 后端 API 修改 (`src/api/routes.ts`)

新增了一个 API 接口用于获取交易品种列表：

```typescript
/**
 * 获取交易品种列表
 */
app.get("/api/trading-symbols", async (c) => {
  try {
    const DEFAULT_TRADING_SYMBOLS = 'BTC,ETH,SOL,XRP,BNB,BCH';
    const tradingSymbolsStr = process.env.TRADING_SYMBOLS || DEFAULT_TRADING_SYMBOLS;
    const symbols = tradingSymbolsStr.split(",").map(s => s.trim());
    
    return c.json({ symbols });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
```

### 2. 前端 HTML 修改 (`public/index.html`)

移除了所有写死的 ticker 项目，改为动态加载：

**修改前：**

```html
<div class="ticker-content" id="ticker">
  <div class="ticker-item">
    <span class="crypto-name">BTC</span>
    <span class="crypto-price" data-symbol="BTC">$0.00</span>
  </div>
  <!-- ... 12+ 个写死的币种 ... -->
</div>
```

**修改后：**

```html
<div class="ticker-content" id="ticker">
  <!-- 动态加载交易品种 -->
</div>
```

### 3. 前端 JavaScript 修改 (`public/monitor-script.js`)

重写了 `loadTickerPrices` 函数，实现动态加载：

```javascript
async loadTickerPrices() {
    try {
        // 1. 先获取交易品种列表
        const symbolsResponse = await fetch('/api/trading-symbols');
        const symbolsData = await symbolsResponse.json();
        
        // 2. 如果 ticker 为空，动态创建 ticker 项
        const tickerContainer = document.getElementById('ticker');
        if (tickerContainer && tickerContainer.children.length === 0) {
            symbolsData.symbols.forEach(symbol => {
                const tickerItem = document.createElement('div');
                tickerItem.className = 'ticker-item';
                tickerItem.innerHTML = `
                    <span class="crypto-name">${symbol}</span>
                    <span class="crypto-price" data-symbol="${symbol}">$0.00</span>
                `;
                tickerContainer.appendChild(tickerItem);
            });
            
            // 重新触发滚动效果
            this.duplicateTicker();
        }
        
        // 3. 获取并更新价格数据
        const pricesResponse = await fetch('/api/prices');
        const pricesData = await pricesResponse.json();
        
        Object.entries(pricesData.prices).forEach(([symbol, price]) => {
            this.cryptoPrices.set(symbol, price);
        });
        
        this.updateTickerPrices();
    } catch (error) {
        console.error('加载 Ticker 价格失败:', error);
    }
}
```

## 🎯 使用方法

现在只需要在 `.env` 文件中修改 `TRADING_SYMBOLS` 配置，前端页面就会自动显示对应的交易品种：

```bash
# 示例 1：只交易主流币
TRADING_SYMBOLS=BTC,ETH,SOL

# 示例 2：扩展到更多币种
TRADING_SYMBOLS=BTC,ETH,SOL,DOGE,XRP,HYPE,SUI,ADA,AVAX,LTC,LINK,BNB,BCH

# 示例 3：自定义任意币种组合
TRADING_SYMBOLS=BTC,ETH,BNB,DOGE,XRP
```

## ✅ 优势

1. **灵活配置**：无需修改前端代码，只需更改 `.env` 配置即可调整显示的交易品种
2. **统一管理**：交易品种配置在一处（`.env`），前后端保持一致
3. **易于维护**：添加新币种时无需修改多处代码
4. **向后兼容**：如果没有配置 `TRADING_SYMBOLS`，会使用默认的币种列表

## 🔄 工作流程

1. 页面加载时，JavaScript 调用 `/api/trading-symbols` 获取配置的交易品种列表
2. 动态创建对应的 ticker 项目
3. 调用 `/api/prices` 获取所有币种的实时价格
4. 更新 ticker 显示价格
5. 每 10 秒自动刷新价格数据

## 🧪 测试建议

1. 修改 `.env` 中的 `TRADING_SYMBOLS` 配置
2. 重启服务：`npm run dev` 或 `npm start`
3. 刷新浏览器页面
4. 检查 ticker 是否显示配置的币种
5. 确认价格数据正常更新

## 📝 注意事项

- 确保配置的币种在交易所中可交易
- 币种符号需要使用交易所支持的格式（如 `BTC`、`ETH` 等）
- 建议不要配置过多币种（建议 10-15 个以内），避免影响页面性能和 API 请求频率
