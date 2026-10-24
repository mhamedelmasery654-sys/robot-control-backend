'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const WebSocket = require('ws');
const { attachWebSocketServer } = require('../src/websocket');

test('WebSocket persists only authenticated event messages and returns an acknowledgement', async (t) => {
  const stored = [];
  const server = http.createServer((req, res) => res.end());
  const wss = attachWebSocketServer(server, {
    publicOrigins: ['http://localhost:8765'],
    authService: { verifyToken: (token) => token === 'valid-token' ? { sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 } : (() => { throw new Error('invalid token'); })() },
    userRepository: { findById: async () => ({ id: 'user-1', email: 'operator@example.test', role: 'operator' }) },
    sessionService: { getAccessible: async () => ({ id: 'session-1', status: 'active' }) },
    eventService: { append: async (_user, _session, event) => {
      stored.push(event);
      return { duplicate: false, event: { eventId: 'event-1', receivedAt: new Date() } };
    } }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  const address = server.address();
  const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/ws`, { origin: 'http://localhost:8765' });
  await once(client, 'open');
  client.send(JSON.stringify({ type: 'auth', token: 'valid-token', sessionId: 'session-1' }));
  const [readyMessage] = await once(client, 'message');
  assert.equal(JSON.parse(readyMessage.toString()).type, 'ready');

  client.send(JSON.stringify({ type: 'event', event: { source: 'gamepad', category: 'control_input', eventName: 'button.pressed', data: { buttonsPressed: ['A'] } } }));
  const [ackMessage] = await once(client, 'message');
  const ack = JSON.parse(ackMessage.toString());
  assert.equal(ack.type, 'event_ack');
  assert.equal(ack.eventId, 'event-1');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].category, 'control_input');
  client.close();
});
