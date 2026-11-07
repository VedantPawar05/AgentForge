export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export interface LogBindings {
  service?: string;
  requestId?: string;
  correlationId?: string;
  workspaceId?: string;
  userId?: string;
  runId?: string;
  taskId?: string;
  [key: string]: unknown;
}

export interface LogRecord extends LogBindings {
  level: LogLevel;
  levelValue: number;
  time: number;
  msg: string;
  err?: {
    message: string;
    name?: string;
    stack?: string;
    code?: string;
  };
}

export type LogOutputFn = (log: LogRecord) => void;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "apikey",
  "api_key",
  "secret",
  "privatekey",
  "private_key",
  "clerk_secret_key",
  "runner_token",
  "runnertoken",
  "x-runner-token",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
]);

function sanitizeBindings(
  bindings: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(bindings)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (val && typeof val === "object" && !(val instanceof Error)) {
      sanitized[key] = sanitizeBindings(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export class Logger {
  private level: LogLevel;
  private minLevelValue: number;
  private bindings: LogBindings;
  private outputFn: LogOutputFn;

  constructor(
    options: {
      level?: LogLevel;
      bindings?: LogBindings;
      outputFn?: LogOutputFn;
    } = {},
  ) {
    this.level = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
    this.minLevelValue = LOG_LEVEL_VALUES[this.level] ?? 20;
    this.bindings = options.bindings ? sanitizeBindings(options.bindings) : {};
    this.outputFn =
      options.outputFn ??
      ((log: LogRecord) => {
        const line = JSON.stringify(log);
        if (log.levelValue >= 40) {
          process.stderr.write(line + "\n");
        } else {
          process.stdout.write(line + "\n");
        }
      });
  }

  public child(extraBindings: LogBindings): Logger {
    return new Logger({
      level: this.level,
      bindings: { ...this.bindings, ...sanitizeBindings(extraBindings) },
      outputFn: this.outputFn,
    });
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
    this.minLevelValue = LOG_LEVEL_VALUES[level] ?? 20;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  private log(
    level: LogLevel,
    msgOrContext: string | Record<string, unknown>,
    msg?: string,
  ): void {
    const levelValue = LOG_LEVEL_VALUES[level];
    if (levelValue < this.minLevelValue) {
      return;
    }

    let message = "";
    let extraContext: Record<string, unknown> = {};
    let errObject: LogRecord["err"];

    if (typeof msgOrContext === "string") {
      message = msgOrContext;
    } else if (typeof msgOrContext === "object" && msgOrContext !== null) {
      if (msgOrContext instanceof Error) {
        errObject = {
          message: msgOrContext.message,
          name: msgOrContext.name,
          stack: msgOrContext.stack,
          code: (msgOrContext as any).code,
        };
        message = msg || msgOrContext.message;
      } else {
        const { err, error, ...rest } = msgOrContext;
        extraContext = sanitizeBindings(rest);
        message = msg || (typeof rest.msg === "string" ? rest.msg : "");

        const rawErr = err || error;
        if (rawErr instanceof Error) {
          errObject = {
            message: rawErr.message,
            name: rawErr.name,
            stack: rawErr.stack,
            code: (rawErr as any).code,
          };
        } else if (rawErr && typeof rawErr === "object") {
          errObject = rawErr as any;
        }
      }
    }

    const record: LogRecord = {
      level,
      levelValue,
      time: Date.now(),
      msg: message,
      ...this.bindings,
      ...extraContext,
      ...(errObject ? { err: errObject } : {}),
    };

    this.outputFn(record);
  }

  public debug(
    msgOrContext: string | Record<string, unknown>,
    msg?: string,
  ): void {
    this.log("debug", msgOrContext, msg);
  }

  public info(
    msgOrContext: string | Record<string, unknown>,
    msg?: string,
  ): void {
    this.log("info", msgOrContext, msg);
  }

  public warn(
    msgOrContext: string | Record<string, unknown>,
    msg?: string,
  ): void {
    this.log("warn", msgOrContext, msg);
  }

  public error(
    msgOrContext: string | Record<string, unknown>,
    msg?: string,
  ): void {
    this.log("error", msgOrContext, msg);
  }

  public fatal(
    msgOrContext: string | Record<string, unknown>,
    msg?: string,
  ): void {
    this.log("fatal", msgOrContext, msg);
  }
}

export const logger = new Logger({
  bindings: { service: "agentforge" },
});
