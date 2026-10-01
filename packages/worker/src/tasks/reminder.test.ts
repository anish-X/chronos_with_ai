import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reminderTask } from './reminder.js';

describe('ReminderTask', () => {
  const originalConsoleLog = console.log;
  let consoleLogs: string[] = [];

  beforeEach(() => {
    consoleLogs = [];
    console.log = vi.fn((msg: string) => {
      consoleLogs.push(msg);
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.unstubAllGlobals();
  });

  it('validates input schema - rejects empty message', async () => {
    const result = await reminderTask.inputSchema.safeParseAsync({
      message: '',
      channel: 'console',
    });
    expect(result.success).toBe(false);
  });

  it('validates input schema - accepts valid console input', async () => {
    const result = await reminderTask.inputSchema.safeParseAsync({
      message: 'Hello world',
      channel: 'console',
    });
    expect(result.success).toBe(true);
  });

  it('validates input schema - rejects invalid webhook URL', async () => {
    const result = await reminderTask.inputSchema.safeParseAsync({
      message: 'Test',
      channel: 'webhook',
      webhookUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('validates input schema - accepts valid webhook input', async () => {
    const result = await reminderTask.inputSchema.safeParseAsync({
      message: 'Test',
      channel: 'webhook',
      webhookUrl: 'https://example.com/webhook',
    });
    expect(result.success).toBe(true);
  });

  it('executes console channel - logs message and returns sent: true', async () => {
    const result = await reminderTask.execute({
      message: 'Test reminder',
      channel: 'console',
    });

    expect(result).toEqual({ sent: true });
    expect(consoleLogs).toContain('🔔 Test reminder');
  });

  it('executes webhook channel - POSTs to webhookUrl', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await reminderTask.execute({
      message: 'Webhook test',
      channel: 'webhook',
      webhookUrl: 'https://example.com/webhook',
    });

    expect(result).toEqual({ sent: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Webhook test' }),
      })
    );
  });

  it('throws when webhook channel missing webhookUrl', async () => {
    await expect(
      reminderTask.execute({
        message: 'Test',
        channel: 'webhook',
      })
    ).rejects.toThrow('webhookUrl is required for webhook channel');
  });

  it('throws on webhook HTTP error', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Internal Server Error' }));

    await expect(
      reminderTask.execute({
        message: 'Test',
        channel: 'webhook',
        webhookUrl: 'https://example.com/webhook',
      })
    ).rejects.toThrow('Webhook failed: 500 Internal Server Error');
  });

  it('throws on unknown channel', async () => {
    await expect(
      reminderTask.execute({
        message: 'Test',
        channel: 'email' as any,
      })
    ).rejects.toThrow('Unknown channel: email');
  });
});