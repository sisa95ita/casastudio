import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule, type Params } from "nestjs-pino";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppConfiguration } from "../config/app-configuration";
import { resolveRequestId, setRequestIdHeader } from "../common/request/request-id";

/**
 * Configures structured request and application logging for the API.
 *
 * Production emits JSON logs; local development uses `pino-pretty` for readable
 * output while still redacting sensitive headers such as bearer tokens and
 * cookies before they can be serialized.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfiguration, true>): Params => {
        const nodeEnv = configService.get("nodeEnv", { infer: true });
        const logLevel = configService.get("logLevel", { infer: true });

        return {
          pinoHttp: {
            level: logLevel,
            genReqId: (request: IncomingMessage, response: ServerResponse) => {
              const requestId = resolveRequestId(request);

              setRequestIdHeader(response, requestId);

              return requestId;
            },
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.headers.set-cookie",
                "req.headers.x-api-key",
                "res.headers.set-cookie"
              ],
              censor: "[REDACTED]"
            },
            transport:
              nodeEnv === "production"
                ? undefined
                : {
                    target: "pino-pretty",
                    options: {
                      colorize: true,
                      singleLine: true,
                      translateTime: "SYS:standard"
                    }
                  }
          }
        };
      }
    })
  ]
})
export class StructuredLoggingModule {}
