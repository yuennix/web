import type { Response } from "express";

interface SseClient {
  res: Response;
  address?: string;
}

const clients = new Set<SseClient>();

export function addSseClient(res: Response, address?: string): SseClient {
  const client: SseClient = { res, address };
  clients.add(client);
  return client;
}

export function removeSseClient(client: SseClient): void {
  clients.delete(client);
}

export function broadcastNewEmail(toAddress: string, emailId: number): void {
  const payload = JSON.stringify({ id: emailId, to: toAddress });
  const message = `event: new-email\ndata: ${payload}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

export function sendHeartbeat(): void {
  const message = `: heartbeat\n\n`;
  for (const client of clients) {
    try {
      client.res.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

setInterval(sendHeartbeat, 25000);
