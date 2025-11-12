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
}

// 导出单例
export const emailAlertService = new EmailAlertService();
