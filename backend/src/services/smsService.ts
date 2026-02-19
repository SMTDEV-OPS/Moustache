import { logger } from "../config/logger";

export interface SendSMSOptions {
  to: string;
  message: string;
  provider?: "TWILIO" | "MSG91" | "OTHER";
}

export interface SMSProvider {
  send(options: SendSMSOptions): Promise<{ messageId: string; status: string }>;
}

/**
 * Placeholder SMS provider implementation
 * This will be replaced with actual provider implementations later
 */
class PlaceholderSMSProvider implements SMSProvider {
  async send(options: SendSMSOptions): Promise<{ messageId: string; status: string }> {
    logger.info("SMS send called (placeholder)", {
      to: options.to,
      messageLength: options.message.length,
    });

    // TODO: Replace with actual SMS provider API call
    // Example for Twilio:
    // const client = require('twilio')(accountSid, authToken);
    // const message = await client.messages.create({
    //   body: options.message,
    //   from: twilioPhoneNumber,
    //   to: options.to
    // });
    // return { messageId: message.sid, status: message.status };

    // Example for Msg91:
    // const response = await fetch('https://api.msg91.com/api/v2/sendsms', {
    //   method: 'POST',
    //   headers: {
    //     'authkey': MSG91_AUTH_KEY,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     sender: MSG91_SENDER_ID,
    //     route: '4',
    //     country: '91',
    //     sms: [{
    //       message: options.message,
    //       to: [options.to]
    //     }]
    //   })
    // });
    // const result = await response.json();
    // return { messageId: result.request_id, status: 'sent' };

    // Placeholder response
    return {
      messageId: `sms-placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: "sent",
    };
  }
}

// Get SMS provider instance (placeholder for now)
let smsProvider: SMSProvider | null = null;

export function getSMSProvider(): SMSProvider {
  if (!smsProvider) {
    // TODO: Initialize based on configuration
    // const providerType = process.env.SMS_PROVIDER || "PLACEHOLDER";
    // switch (providerType) {
    //   case "TWILIO":
    //     smsProvider = new TwilioSMSProvider();
    //     break;
    //   case "MSG91":
    //     smsProvider = new Msg91SMSProvider();
    //     break;
    //   default:
    //     smsProvider = new PlaceholderSMSProvider();
    // }
    smsProvider = new PlaceholderSMSProvider();
  }
  return smsProvider;
}

/**
 * Send SMS using configured provider
 */
export async function sendSMS(options: SendSMSOptions): Promise<{ messageId: string; status: string }> {
  const provider = getSMSProvider();
  return provider.send(options);
}

