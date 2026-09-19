// Development transport: prints the SMS instead of sending it. Enabled with
// SMS_PROVIDER=log so the whole flow (settings, cron, message log) can be
// exercised locally at zero cost.

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { MessageTransport, SendRequest, SendResult } from "../types";

export const logTransport: MessageTransport = {
  channel: "SMS",
  name: "log",
  isConfigured() {
    return env.SMS_PROVIDER === "log";
  },
  async send({ to, body, language }: SendRequest): Promise<SendResult> {
    logger.info("sms.log_transport", { to, language, body });
    return { providerId: `log-${Date.now()}` };
  },
};
