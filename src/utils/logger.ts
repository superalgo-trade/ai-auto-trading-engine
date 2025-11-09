/**
 * 简洁的日志工具
 * 提供带颜色的传统日志输出格式
 */

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // 背景色
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * 检查是否由 PM2 管理（PM2 会自动添加时间戳）
 */
function isPM2Managed(): boolean {
  return !!(process.env.PM2_HOME || process.env.pm_id);
}

/**
 * 获取格式化的时间戳（中国时区）
 * 如果由 PM2 管理则不显示时间戳（PM2 会自动添加）
 */
function getTimestamp(): string {
  if (isPM2Managed()) {
    return '';
  }
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}] `;
}

/**
 * 格式化日志消息
 */
function formatMessage(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return arg;
    }
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

/**
 * 日志记录器类
 */
class Logger {
  private name: string;

  constructor(name: string = 'app') {
    this.name = name;
  }

  /**
   * INFO 级别日志（绿色）
   */
  info(...args: any[]): void {
    const timestamp = getTimestamp();
    const message = formatMessage(args);
    console.log(
      `${timestamp}` +
      `${colors.green}${colors.bright}INFO${colors.reset}  ` +
      `${colors.cyan}[${this.name}]${colors.reset} ` +
      `${message}`
    );
  }

  /**
   * WARN 级别日志（黄色）
   */
  warn(...args: any[]): void {
    const timestamp = getTimestamp();
    const message = formatMessage(args);
    console.warn(
      `${timestamp}` +
      `${colors.yellow}${colors.bright}WARN${colors.reset}  ` +
      `${colors.cyan}[${this.name}]${colors.reset} ` +
      `${colors.yellow}${message}${colors.reset}`
    );
  }

  /**
   * ERROR 级别日志（红色）
   */
  error(...args: any[]): void {
    const timestamp = getTimestamp();
    const message = formatMessage(args);
    console.error(
      `${timestamp}` +
      `${colors.red}${colors.bright}ERROR${colors.reset} ` +
      `${colors.cyan}[${this.name}]${colors.reset} ` +
      `${colors.red}${message}${colors.reset}`
    );
  }

  /**
   * DEBUG 级别日志（蓝色，仅在开发模式显示）
   */
  debug(...args: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = getTimestamp();
      const message = formatMessage(args);
      console.log(
        `${timestamp}` +
        `${colors.blue}${colors.bright}DEBUG${colors.reset} ` +
        `${colors.cyan}[${this.name}]${colors.reset} ` +
        `${colors.gray}${message}${colors.reset}`
      );
    }
  }

  /**
   * TRACE 级别日志（灰色，用于详细追踪）
   */
  trace(...args: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = getTimestamp();
      const message = formatMessage(args);
      console.log(
        `${timestamp}${colors.gray}TRACE [${this.name}] ${message}${colors.reset}`
      );
    }
  }

  /**
   * FATAL 级别日志（红色背景，致命错误）
   */
  fatal(...args: any[]): void {
    const timestamp = getTimestamp();
    const message = formatMessage(args);
    console.error(
      `${timestamp}` +
      `${colors.bgRed}${colors.white}${colors.bright}FATAL${colors.reset} ` +
      `${colors.cyan}[${this.name}]${colors.reset} ` +
      `${colors.red}${colors.bright}${message}${colors.reset}`
    );
  }

  /**
   * 子日志记录器
   */
  child(bindings: { name?: string; component?: string }): Logger {
    const childName = bindings.component || bindings.name || this.name;
    return new Logger(childName);
  }
}

/**
 * 创建日志记录器
 */
export function createLogger(options: { name?: string; level?: string } = {}): Logger {
  return new Logger(options.name || 'app');
}

/**
 * 默认导出
 */
export default createLogger;
