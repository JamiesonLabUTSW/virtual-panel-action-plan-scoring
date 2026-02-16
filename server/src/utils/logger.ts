import pino from "pino";

const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug");

// Create logger with inline transport option (not pino.transport()) for
// compatibility with pino-http, which needs the logger's internal stream intact.
const logger = pino({
  level: LOG_LEVEL,
  transport:
    NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: false,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
  redact: {
    // biome-ignore lint/security/noSecrets: Array of field paths for PII redaction, not actual secrets
    paths: ["actionItems[*]", "proposal.content", "error.message", "req.headers.authorization"],
    remove: true,
  },
});

export { logger };
export default logger;
