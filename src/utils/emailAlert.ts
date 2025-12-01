/**
 * ai-auto-trading - AI 加密货币自动交易系统
 * Copyright (C) 2025 losesky
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * 邮件告警服务
 * 用于发送系统异常告警通知
 */
import nodemailer from 'nodemailer';
import { createLogger } from './logger';

const logger = createLogger({
  name: 'email-alert',
  level: 'info'
});

export enum AlertLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface AlertMessage {
  level: AlertLevel;
  title: string;
  message: string;
  details?: any;
  timestamp?: string;
}

/**
 * 交易提醒信息接口
 */
export interface TradeNotification {
  type: 'open' | 'close';
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  price: number;
  leverage: number;
  // 开仓特有字段
  margin?: number;
  stopLoss?: number;
  takeProfit?: number;
  liquidationPrice?: number;
  marketState?: string;
  strategyType?: string;
  opportunityScore?: number;
  // 平仓特有字段
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  fee?: number;
  closeReason?: string;
  totalBalance?: number;
  orderId?: string;
  timestamp?: string;
}

/**
 * 邮件告警类
 */
class EmailAlertService {
  private transporter: nodemailer.Transporter | null = null;
  private enabled: boolean = false;
  private fromEmail: string = '';
  private toEmail: string = '';
  private lastAlertTime: Map<string, number> = new Map();
  private alertCooldown: number = 5 * 60 * 1000; // 5分钟冷却期，避免频繁发送

  /**
   * 初始化邮件服务
   */
  initialize() {
    // 检查环境变量配置
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const alertFrom = process.env.ALERT_EMAIL_FROM;
    const alertTo = process.env.ALERT_EMAIL_TO;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !alertFrom || !alertTo) {
      logger.info('邮件告警未配置，将仅记录日志');
      logger.info('如需启用邮件告警，请配置环境变量: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_FROM, ALERT_EMAIL_TO');
      return;
    }

    try {
      // 创建邮件传输器
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465, // 465端口使用SSL，587端口使用TLS
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      this.fromEmail = alertFrom;
      this.toEmail = alertTo;
      this.enabled = true;

      logger.info(`✅ 邮件告警服务已初始化 (发送至: ${alertTo})`);
    } catch (error: any) {
      logger.error('邮件告警服务初始化失败:', error);
    }
  }

  /**
   * 发送告警邮件
   */
  async sendAlert(alert: AlertMessage): Promise<boolean> {
    // 添加时间戳
    if (!alert.timestamp) {
      alert.timestamp = new Date().toISOString();
    }

    // 记录到日志
    const logMessage = `[${alert.level}] ${alert.title}: ${alert.message}`;
    if (alert.level === AlertLevel.CRITICAL || alert.level === AlertLevel.ERROR) {
      logger.error(logMessage, alert.details);
    } else if (alert.level === AlertLevel.WARNING) {
      logger.warn(logMessage, alert.details);
    } else {
      logger.info(logMessage, alert.details);
    }

    // 如果邮件服务未启用，仅记录日志
    if (!this.enabled || !this.transporter) {
      return false;
    }

    // 检查冷却期（避免同类告警频繁发送）
    const alertKey = `${alert.level}-${alert.title}`;
    const lastTime = this.lastAlertTime.get(alertKey) || 0;
    const now = Date.now();
    
    if (now - lastTime < this.alertCooldown) {
      logger.debug(`告警 ${alertKey} 在冷却期内，跳过发送`);
      return false;
    }

    try {
      // 构建邮件内容
      const subject = `[${alert.level}] ${alert.title} - AI自动交易系统`;
      const html = this.buildEmailHtml(alert);

      // 发送邮件
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: this.toEmail,
        subject: subject,
        html: html
      });

      // 更新最后发送时间
      this.lastAlertTime.set(alertKey, now);
      
      logger.info(`✅ 告警邮件已发送: ${alert.title}`);
      return true;
    } catch (error: any) {
      logger.error('发送告警邮件失败:', error);
      return false;
    }
  }

  /**
   * 构建HTML邮件内容
   */
  private buildEmailHtml(alert: AlertMessage): string {
    const levelColor = {
      [AlertLevel.INFO]: '#2196F3',
      [AlertLevel.WARNING]: '#FF9800',
      [AlertLevel.ERROR]: '#F44336',
      [AlertLevel.CRITICAL]: '#9C27B0'
    }[alert.level];

    let detailsHtml = '';
    if (alert.details) {
      // 检查是否是交易提醒（包含特定字段）
      const isTradeNotification = alert.details && typeof alert.details === 'object' && 
        ('交易类型' in alert.details || '币种' in alert.details);
      
      if (isTradeNotification) {
        // 使用表格格式显示交易信息
        const rows = Object.entries(alert.details)
          .map(([key, value]) => {
            let displayValue = String(value);
            let valueStyle = '';
            
            // 为盈亏添加颜色
            if (key === '盈亏' && typeof value === 'string') {
              if (value.includes('+')) {
                valueStyle = 'color: #4CAF50; font-weight: bold;';
              } else if (value.includes('-')) {
                valueStyle = 'color: #F44336; font-weight: bold;';
              }
            }
            
            return `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 500; color: #666; white-space: nowrap;">${key}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; ${valueStyle}">${displayValue}</td>
              </tr>
            `;
          })
          .join('');
        
        detailsHtml = `
          <div style="margin-top: 20px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              ${rows}
            </table>
          </div>
        `;
      } else {
        // 常规告警使用原格式
        const detailsStr = typeof alert.details === 'object' 
          ? JSON.stringify(alert.details, null, 2) 
          : String(alert.details);
        detailsHtml = `
          <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #333;">详细信息：</h3>
            <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 12px;">${detailsStr}</pre>
          </div>
        `;
      }
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${levelColor}; color: white; padding: 20px; border-radius: 4px; }
          .content { padding: 20px; background: white; }
          .footer { margin-top: 20px; padding: 10px; text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${alert.level}</h1>
            <h2 style="margin: 10px 0 0 0;">${alert.title}</h2>
          </div>
          <div class="content">
            <p><strong>告警时间：</strong> ${alert.timestamp}</p>
            <p><strong>告警级别：</strong> ${alert.level}</p>
            <p><strong>告警消息：</strong></p>
            <p style="padding: 10px; background: #f9f9f9; border-left: 4px solid ${levelColor};">
              ${alert.message}
            </p>
            ${detailsHtml}
          </div>
          <div class="footer">
            <p>此邮件由 AI 自动交易系统自动发送，请勿直接回复</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 测试邮件配置
   */
  async testEmail(): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      logger.warn('邮件服务未启用，无法测试');
      return false;
    }

    try {
      await this.sendAlert({
        level: AlertLevel.INFO,
        title: '邮件告警测试',
        message: '这是一封测试邮件，如果您收到此邮件，说明邮件告警配置正确。',
        details: { test: true, timestamp: new Date().toISOString() }
      });
      return true;
    } catch (error) {
      logger.error('邮件测试失败:', error);
      return false;
    }
  }

  /**
   * 发送交易提醒邮件
   */
  async sendTradeNotification(trade: TradeNotification): Promise<boolean> {
    // 添加时间戳
    if (!trade.timestamp) {
      trade.timestamp = new Date().toISOString();
    }

    // 构建邮件标题和内容
    const isOpen = trade.type === 'open';
    const direction = trade.side === 'long' ? '做多' : '做空';
    const title = isOpen 
      ? `开仓提醒: ${trade.symbol} ${direction}` 
      : `平仓提醒: ${trade.symbol} ${direction}`;

    // 构建详细信息
    const details = {
      交易类型: isOpen ? '开仓' : '平仓',
      币种: trade.symbol,
      方向: direction,
      数量: trade.quantity.toFixed(4),
      杠杆: `${trade.leverage}x`,
      ...(isOpen ? {
        入场价: trade.price.toFixed(2),
        保证金: trade.margin ? `${trade.margin.toFixed(2)} USDT` : 'N/A',
        止损价: trade.stopLoss ? trade.stopLoss.toFixed(2) : '未设置',
        止盈价: trade.takeProfit ? trade.takeProfit.toFixed(2) : '未设置',
        强平价: trade.liquidationPrice ? trade.liquidationPrice.toFixed(2) : 'N/A',
        市场状态: trade.marketState || 'N/A',
        策略类型: trade.strategyType || 'N/A',
        机会评分: trade.opportunityScore !== undefined ? `${trade.opportunityScore.toFixed(0)}/100` : 'N/A',
      } : {
        入场价: trade.entryPrice?.toFixed(2) || 'N/A',
        平仓价: trade.exitPrice?.toFixed(2) || trade.price.toFixed(2),
        盈亏: trade.pnl !== undefined ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} USDT` : 'N/A',
        盈亏率: trade.pnlPercent !== undefined ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : 'N/A',
        手续费: trade.fee !== undefined ? `${trade.fee.toFixed(2)} USDT` : 'N/A',
        平仓原因: this.formatCloseReason(trade.closeReason),
        账户余额: trade.totalBalance !== undefined ? `${trade.totalBalance.toFixed(2)} USDT` : 'N/A',
      }),
      订单ID: trade.orderId || 'N/A',
      时间: trade.timestamp,
    };

    // 构建消息文本
    const message = Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // 根据盈亏情况选择告警级别
    let level = AlertLevel.INFO;
    if (!isOpen && trade.pnl !== undefined) {
      if (trade.pnl < -100) {
        level = AlertLevel.ERROR; // 大额亏损
      } else if (trade.pnl < 0) {
        level = AlertLevel.WARNING; // 小额亏损
      }
    }

    // 发送告警邮件
    return await this.sendAlert({
      level,
      title,
      message,
      details,
      timestamp: trade.timestamp,
    });
  }

  /**
   * 格式化平仓原因
   */
  private formatCloseReason(reason?: string): string {
    const reasonMap: Record<string, string> = {
      'stop_loss_triggered': '止损触发',
      'take_profit_triggered': '止盈触发',
      'manual_close': 'AI手动',
      'ai_decision': 'AI主动',
      'trend_reversal': '趋势反转',
      'forced_close': '系统强制',
      'partial_close': '分批止盈',
      'peak_drawdown': '峰值回撤',
      'time_limit': '持仓到期',
    };
    return reasonMap[reason || ''] || reason || 'N/A';
  }
}

// 导出单例
export const emailAlertService = new EmailAlertService();
