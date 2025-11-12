import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

type LogLevel = "INFO" | "DEBUG" | "WARN" | "ERROR";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
};

class RunLogger {
  readonly runId: string;
  readonly filePath: string;
  private stream: fs.WriteStream;

  constructor(filePath: string, runId: string) {
    this.filePath = filePath;
    this.runId = runId;
    this.stream = fs.createWriteStream(this.filePath, { flags: "a" });
  }

  log(level: LogLevel, message: string, context?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    this.stream.write(`${this.serialize(entry)}\n`);
  }

  close() {
    if (!this.stream.closed) {
      this.stream.end();
    }
  }

  private serialize(entry: LogEntry) {
    return JSON.stringify(entry, (_key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      if (value && typeof value === "object") {
        if (value instanceof Map) {
          return {
            dataType: "Map",
            value: Array.from(value.entries()),
          };
        }
        if (value instanceof Set) {
          return {
            dataType: "Set",
            value: Array.from(value.values()),
          };
        }
      }
      return value;
    });
  }
}

let activeLogger: RunLogger | null = null;

type InitOptions = {
  logDir?: string;
  runLabel?: string;
};

export function initRunLogger({ logDir = "logs", runLabel }: InitOptions = {}) {
  const baseDir = path.resolve(process.cwd(), logDir);
  fs.mkdirSync(baseDir, { recursive: true });

  const runId = runLabel ?? `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const filePath = path.join(baseDir, `atlas-run-${runId}.log`);

  const logger = new RunLogger(filePath, runId);
  activeLogger = logger;
  logger.log("INFO", "Logger initialized", { filePath, runId });
  return logger;
}

export function getRunLogger() {
  if (!activeLogger) {
    throw new Error("Run logger has not been initialized");
  }
  return activeLogger;
}

export function withLogger<T>(level: LogLevel, message: string, context?: unknown) {
  if (!activeLogger) {
    // Fallback to console when logger is unavailable.
    // eslint-disable-next-line no-console
    console.log(`[${level}] ${message}`, context ?? "");
    return;
  }
  activeLogger.log(level, message, context);
}

export function logInfo(message: string, context?: unknown) {
  withLogger("INFO", message, context);
}

export function logDebug(message: string, context?: unknown) {
  withLogger("DEBUG", message, context);
}

export function logWarn(message: string, context?: unknown) {
  withLogger("WARN", message, context);
}

export function logError(message: string, context?: unknown) {
  withLogger("ERROR", message, context);
}

export function shutdownLogger() {
  if (activeLogger) {
    activeLogger.log("INFO", "Logger shutting down");
    activeLogger.close();
    activeLogger = null;
  }
}

export type RunLoggerHandle = RunLogger;
