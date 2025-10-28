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

// AI Trading Monitor - 使用真实 API
class TradingMonitor {
    constructor() {
        this.cryptoPrices = new Map();
        this.accountData = null;
        this.init();
    }

    async init() {
        await this.loadInitialData();
        this.startDataUpdates();
        this.initTabs();
        this.initChat();
        this.duplicateTicker();
    }

    // 加载初始数据
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadAccountData(),
                this.loadPositionsData(),
                this.loadTradesData(),
                this.loadLogsData(),
                this.loadTickerPrices()
            ]);
        } catch (error) {
            console.error('加载初始数据失败:', error);
        }
    }

    // 加载账户数据
    async loadAccountData() {
        try {
            const response = await fetch('/api/account');
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            this.accountData = data;
            
            // 使用和 app.js 相同的算法计算总资产
            // API 返回的 totalBalance 不包含未实现盈亏
            // 显示的总资产需要加上未实现盈亏 * 2，以便实时反映持仓盈亏
            const totalBalanceWithPnl = data.totalBalance + data.unrealisedPnl * 2;
            
            // 更新总资产
        const accountValueEl = document.getElementById('account-value');
            if (accountValueEl) {
                accountValueEl.textContent = totalBalanceWithPnl.toFixed(2);
            }

            // 更新可用余额
            const availableBalanceEl = document.getElementById('available-balance');
            if (availableBalanceEl) {
                availableBalanceEl.textContent = data.availableBalance.toFixed(2);
            }

            // 更新未实现盈亏（带符号和颜色）
            const unrealisedPnlEl = document.getElementById('unrealised-pnl');
            if (unrealisedPnlEl) {
                const pnlValue = (data.unrealisedPnl >= 0 ? '+' : '') + data.unrealisedPnl.toFixed(2);
                unrealisedPnlEl.textContent = pnlValue;
                unrealisedPnlEl.className = 'detail-value ' + (data.unrealisedPnl >= 0 ? 'positive' : 'negative');
            }

            // 更新收益（总资产 - 初始资金）
        const valueChangeEl = document.getElementById('value-change');
        const valuePercentEl = document.getElementById('value-percent');

            if (valueChangeEl && valuePercentEl) {
                // 收益率 = (总资产(含未实现盈亏) - 初始资金) / 初始资金 * 100
                const totalPnl = totalBalanceWithPnl - data.initialBalance;
                const returnPercent = (totalPnl / data.initialBalance) * 100;
                const isPositive = totalPnl >= 0;
                
                valueChangeEl.textContent = `${isPositive ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`;
                valuePercentEl.textContent = `(${isPositive ? '+' : ''}${returnPercent.toFixed(2)}%)`;
                
                // 更新颜色
                valueChangeEl.className = 'change-amount ' + (isPositive ? '' : 'negative');
                valuePercentEl.className = 'change-percent ' + (isPositive ? '' : 'negative');
            }
            
        } catch (error) {
            console.error('加载账户数据失败:', error);
        }
    }

    // 加载持仓数据
    async loadPositionsData() {
        try {
            const response = await fetch('/api/positions');
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            const positionsBody = document.getElementById('positions-body');
            
            if (!data.positions || data.positions.length === 0) {
                if (positionsBody) {
                    positionsBody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无持仓</td></tr>';
                }
                return;
            }

            // 更新加密货币价格
            data.positions.forEach(pos => {
                this.cryptoPrices.set(pos.symbol, pos.currentPrice);
            });
            this.updateTickerPrices();

            // 更新持仓表格
            if (positionsBody) {
                positionsBody.innerHTML = data.positions.map(pos => {
                    const profitPercent = ((pos.unrealizedPnl / pos.openValue) * 100).toFixed(2);
                    return `
                        <tr>
                            <td>${pos.symbol}</td>
                            <td>${pos.quantity}</td>
                            <td>$${pos.entryPrice.toFixed(4)}</td>
                            <td>$${pos.openValue.toFixed(2)}</td>
                            <td>$${pos.currentPrice.toFixed(4)}</td>
                            <td class="${pos.unrealizedPnl >= 0 ? 'positive' : 'negative'}">
                                ${pos.unrealizedPnl >= 0 ? '+' : ''}$${pos.unrealizedPnl.toFixed(2)}
                            </td>
                            <td class="${pos.unrealizedPnl >= 0 ? 'positive' : 'negative'}">
                                ${pos.unrealizedPnl >= 0 ? '+' : ''}${profitPercent}%
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            // 更新终端消息
            if (data.positions.length > 0) {
                this.addTerminalLine(`POSITIONS: ${data.positions.length} active`);
            }
            
        } catch (error) {
            console.error('加载持仓数据失败:', error);
        }
    }

    // 加载交易记录 - 使用和 index.html 相同的布局
    async loadTradesData() {
        try {
            const response = await fetch('/api/trades?limit=10');
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            const container = document.getElementById('tradesContainer');
            const countEl = document.getElementById('tradesCount');
            
            if (!data.trades || data.trades.length === 0) {
                if (container) {
                    container.innerHTML = '<p class="no-data">暂无交易记录</p>';
                }
                if (countEl) {
                    countEl.textContent = '';
                }
                return;
            }
            
            if (countEl) {
                countEl.textContent = `(${data.trades.length})`;
            }
            
            if (container) {
                container.innerHTML = data.trades.map(trade => {
                    const date = new Date(trade.timestamp);
                    const timeStr = date.toLocaleString('zh-CN', {
                        timeZone: 'Asia/Shanghai',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    
                    // 对于平仓交易，显示盈亏
                    const pnlHtml = trade.type === 'close' && trade.pnl !== null && trade.pnl !== undefined
                        ? `<div class="trade-field">
                            <span class="label">盈亏</span>
                            <span class="value ${trade.pnl >= 0 ? 'profit' : 'loss'}">${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} USDT</span>
                           </div>`
                        : '';
                    
                    return `
                        <div class="trade-item">
                            <div class="trade-header">
                                <div class="trade-symbol">${trade.symbol}</div>
                                <div class="trade-time">${timeStr}</div>
                            </div>
                            <div class="trade-info">
                                <div class="trade-field">
                                    <span class="label">方向</span>
                                    <span class="value ${trade.side}">${trade.side === 'long' ? '做多' : trade.side === 'short' ? '做空' : '-'}</span>
                                </div>
                                <div class="trade-field">
                                    <span class="label">类型</span>
                                    <span class="value">${trade.type === 'open' ? '开仓' : '平仓'}</span>
                                </div>
                                <div class="trade-field">
                                    <span class="label">数量</span>
                                    <span class="value">${trade.quantity.toFixed(4)}</span>
                                </div>
                                <div class="trade-field">
                                    <span class="label">价格</span>
                                    <span class="value">${trade.price.toFixed(4)}</span>
                                </div>
                                <div class="trade-field">
                                    <span class="label">杠杆</span>
                                    <span class="value">${trade.leverage}x</span>
                                </div>
                                <div class="trade-field">
                                    <span class="label">手续费</span>
                                    <span class="value">${trade.fee.toFixed(4)}</span>
                                </div>
                                ${pnlHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            }
            
        } catch (error) {
            console.error('加载交易记录失败:', error);
        }
    }

    // 加载 AI 决策日志 - 显示最新一条完整内容
    async loadLogsData() {
        try {
            const response = await fetch('/api/logs?limit=1');
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            const decisionContent = document.getElementById('decision-content');
            const decisionMeta = document.getElementById('decision-meta');
            
            if (data.logs && data.logs.length > 0) {
                const log = data.logs[0]; // 只取最新一条
                
                // 更新决策元信息
                if (decisionMeta) {
                    const timestamp = new Date(log.timestamp).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    
                    decisionMeta.innerHTML = `
                        <span class="decision-time">${timestamp}</span>
                        <span class="decision-iteration">#${log.iteration}</span>
                    `;
                }
                
                // 更新决策详细内容
                if (decisionContent) {
                    const decision = log.decision || log.actionsTaken || '暂无决策内容';
                    // 保留换行和格式，转换为HTML
                    const formattedDecision = decision
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/\n/g, '<br>');
                    
                    decisionContent.innerHTML = `<div class="decision-text">${formattedDecision}</div>`;
                }
            } else {
                if (decisionContent) {
                    decisionContent.innerHTML = '<p class="no-data">暂无 AI 决策记录</p>';
                }
                if (decisionMeta) {
                    decisionMeta.innerHTML = '<span class="decision-time">无数据</span>';
                }
            }
            
        } catch (error) {
            console.error('加载日志失败:', error);
            const decisionContent = document.getElementById('decision-content');
            if (decisionContent) {
                decisionContent.innerHTML = `<p class="error">加载失败: ${error.message}</p>`;
            }
        }
    }

    // 加载顶部 Ticker 价格（从 API 获取）
    async loadTickerPrices() {
        try {
            const response = await fetch('/api/prices?symbols=BTC,ETH,SOL,BNB,DOGE,XRP');
            const data = await response.json();
            
            if (data.error) {
                console.error('获取价格失败:', data.error);
                return;
            }
            
            // 更新价格缓存
            Object.entries(data.prices).forEach(([symbol, price]) => {
                this.cryptoPrices.set(symbol, price);
            });
            
            // 更新显示
            this.updateTickerPrices();
        } catch (error) {
            console.error('加载 Ticker 价格失败:', error);
        }
    }

    // 更新价格滚动条
    updateTickerPrices() {
        this.cryptoPrices.forEach((price, symbol) => {
                const priceElements = document.querySelectorAll(`[data-symbol="${symbol}"]`);
                priceElements.forEach(el => {
                const decimals = price < 1 ? 4 : 2;
                el.textContent = '$' + price.toFixed(decimals);
            });
        });
    }

    // 启动数据更新
    startDataUpdates() {
        // 每3秒更新账户和持仓（实时数据）
        setInterval(async () => {
            await Promise.all([
                this.loadAccountData(),
                this.loadPositionsData()
            ]);
        }, 3000);

        // 每10秒更新价格（实时价格）
        setInterval(async () => {
            await this.loadTickerPrices();
        }, 10000);

        // 每30秒更新交易记录和日志
        setInterval(async () => {
            await Promise.all([
                this.loadTradesData(),
                this.loadLogsData()
            ]);
        }, 30000);
    }

    // 复制ticker内容实现无缝滚动
    duplicateTicker() {
        const ticker = document.getElementById('ticker');
        if (ticker) {
            const tickerContent = ticker.innerHTML;
            ticker.innerHTML = tickerContent + tickerContent + tickerContent;
        }
    }

    // 初始化选项卡（简化版，只有一个选项卡）
    initTabs() {
        // 已经只有一个选项卡，不需要切换功能
    }

    // 初始化聊天功能（已移除）
    initChat() {
        // 聊天功能已移除
    }
}

// 初始化监控系统
document.addEventListener('DOMContentLoaded', () => {
    const monitor = new TradingMonitor();
});
