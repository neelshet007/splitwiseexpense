type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const sensitiveKeys = [
    'password',
    'confirmpassword',
    'passwordhash',
    'token',
    'tokenhash',
    'secret',
    'authorization',
    'cookie',
    'set-cookie',
    'refreshtoken',
    'accesstoken',
    'chatid',
    'chat_id',
    'telegramchatid',
    'bottoken',
    'apikey',
    'secretkey'
  ];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function log(level: LogLevel, message: string, meta?: any) {
  if (process.env.NODE_ENV === 'test') return;
  if (level === 'debug' && process.env.NODE_ENV === 'production') return;

  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    level,
    message,
    ...(meta ? { meta: sanitize(meta) } : {})
  };

  const output = JSON.stringify(payload);
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (msg: string, meta?: any) => log('info', msg, meta),
  warn: (msg: string, meta?: any) => log('warn', msg, meta),
  error: (msg: string, meta?: any) => log('error', msg, meta),
  debug: (msg: string, meta?: any) => log('debug', msg, meta)
};
