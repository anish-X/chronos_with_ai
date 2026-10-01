import { z } from 'zod';
import type { TaskDefinition } from '@chronos/core';

const reminderInputSchema = z.object({
  message: z.string().min(1),
  channel: z.enum(['console', 'webhook']).default('console'),
  webhookUrl: z.string().url().optional(),
}).strict();

const reminderOutputSchema = z.object({
  sent: z.boolean(),
});

type ReminderInput = z.input<typeof reminderInputSchema>;
type ReminderOutput = z.output<typeof reminderOutputSchema>;

export const reminderTask: TaskDefinition<ReminderInput, ReminderOutput> = {
  name: 'reminder',
  description: 'Sends a reminder notification via console or webhook',
  inputSchema: reminderInputSchema,
  outputSchema: reminderOutputSchema,
  async execute(input): Promise<ReminderOutput> {
    const { message, channel, webhookUrl } = input;

    if (channel === 'console') {
      console.log(`🔔 ${message}`);
      return { sent: true };
    }

    if (channel === 'webhook') {
      if (!webhookUrl) {
        throw new Error('webhookUrl is required for webhook channel');
      }
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
      return { sent: true };
    }

    throw new Error(`Unknown channel: ${channel}`);
  },
};