type LogLevel = "debug" | "info" | "warn" | "error";

type Logger = {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string | Error, ...args: unknown[]) => void;
};

function formatMessage(scope: string, level: LogLevel, message: string) {
  const timestamp = new Date().toISOString();
  return `${timestamp} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
}

export function createLogger(scope: string): Logger {
  return {
    debug(message, ...args) {
      if (process.env.DEBUG) {
        console.debug(formatMessage(scope, "debug", message), ...args);
      }
    },
    info(message, ...args) {
      console.info(formatMessage(scope, "info", message), ...args);
    },
    warn(message, ...args) {
      console.warn(formatMessage(scope, "warn", message), ...args);
    },
    error(message, ...args) {
      const msg =
        message instanceof Error
          ? `${message.name}: ${message.message}`
          : message;
      console.error(formatMessage(scope, "error", msg), ...args);
    },
  };
}
