import axios from 'axios';
import { createHmac } from 'crypto';
import { pool } from '../db/index.js';

export interface WebhookPayload {
  event: 'started' | 'progress' | 'completed' | 'failed';
  timestamp: string;
  job_id: string;
  url: string;
  status: string;
  progress: number;
  data?: any;
  error?: string | null;
}

export async function getWebhooksForClient(clientId: string, event: string) {
  const result = await pool.query(
    'SELECT * FROM webhooks WHERE client_id = $1 AND is_active = true AND $2 = ANY(events)',
    [clientId, event]
  );
  return result.rows;
}

export function signPayload(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

export async function deliverWebhook(webhook: any, payload: WebhookPayload): Promise<boolean> {
  const payloadStr = JSON.stringify(payload);
  const signature = signPayload(payloadStr, webhook.secret);
  
  const maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES || '3');
  const timeout = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '5000');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event
        },
        timeout,
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Log successful delivery
      await pool.query(
        `INSERT INTO webhook_deliveries (webhook_id, job_id, event, payload, response_status, attempt)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [webhook.id, payload.job_id, payload.event, payloadStr, response.status, attempt]
      );

      return true;
    } catch (error) {
      console.error(`Webhook delivery attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const responseStatus = (error as any).response?.status;
        const responseBody = (error as any).response?.data;

        await pool.query(
          `INSERT INTO webhook_deliveries (webhook_id, job_id, event, payload, response_status, response_body, attempt)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [webhook.id, payload.job_id, payload.event, payloadStr, responseStatus, JSON.stringify(responseBody), attempt]
        );
      }
    }
  }

  return false;
}

export async function triggerWebhooks(clientId: string, payload: WebhookPayload) {
  const webhooks = await getWebhooksForClient(clientId, payload.event);
  
  // Fire and forget - don't block on webhook delivery
  const promises = webhooks.map(webhook => deliverWebhook(webhook, payload));
  await Promise.allSettled(promises);
}
