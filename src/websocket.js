'use strict';

const { WebSocketServer } = require('ws');
const { randomUUID } = require('node:crypto');
const { eventSchema } = require('./validators/event.validator');
const { attachDemoSimulator } = require('./demoSimulator');

function attachWebSocketServer(server, { authService, userRepository, sessionService, eventService, publicOrigins }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
  const demoWss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024, perMessageDeflate: false });
  attachDemoSimulator(demoWss);

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/v1/demo/ws') {
      const origin = request.headers.origin;
      if (!origin || !publicOrigins.includes(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      demoWss.handleUpgrade(request, socket, head, (websocket) => demoWss.emit('connection', websocket, request));
      return;
    }
    if (url.pathname !== '/api/v1/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const origin = request.headers.origin;
    if (origin && !publicOrigins.includes(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (websocket) => wss.emit('connection', websocket, request));
  });

  wss.on('connection', (websocket) => {
    let context = null;
    let messageWindow = Date.now();
    let messageCount = 0;
    const authTimeout = setTimeout(() => websocket.close(1008, 'Authentication required'), 5000);

    websocket.on('message', async (buffer) => {
      if (Date.now() - messageWindow > 10000) { messageWindow = Date.now(); messageCount = 0; }
      messageCount += 1;
      if (messageCount > 100) return websocket.close(1008, 'Rate limit exceeded');
      let message;
      try { message = JSON.parse(buffer.toString('utf8')); }
      catch { return sendError(websocket, 'INVALID_JSON', 'Send a JSON message.'); }

      try {
        if (!context) {
          if (message.type !== 'auth' || typeof message.token !== 'string' || typeof message.sessionId !== 'string') {
            return websocket.close(1008, 'Authentication required');
          }
          const claims = authService.verifyToken(message.token);
          const user = await userRepository.findById(claims.sub);
          if (!user) return websocket.close(1008, 'Account unavailable');
          const session = await sessionService.getAccessible({ id: user.id, role: user.role }, message.sessionId);
          if (session.status !== 'active') return websocket.close(1008, 'Session closed');
          context = { user: { id: user.id, email: user.email, role: user.role }, sessionId: session.id, tokenExpiresAt: claims.exp };
          clearTimeout(authTimeout);
          websocket.send(JSON.stringify({ type: 'ready', sessionId: session.id }));
          return;
        }

        if (context.tokenExpiresAt && Date.now() >= context.tokenExpiresAt * 1000) {
          return websocket.close(1008, 'Authentication expired');
        }
        if (message.type !== 'event') return sendError(websocket, 'UNSUPPORTED_MESSAGE', 'Only event messages are accepted.');
        const parsed = eventSchema.safeParse(message.event);
        if (!parsed.success) return sendError(websocket, 'VALIDATION_ERROR', 'Event fields are invalid.');
        const result = await eventService.append(context.user, context.sessionId, parsed.data, randomUUID());
        websocket.send(JSON.stringify({ type: 'event_ack', eventId: result.event.eventId, duplicate: result.duplicate, receivedAt: result.event.receivedAt || null }));
      } catch (error) {
        sendError(websocket, error.code || 'EVENT_REJECTED', error.statusCode && error.statusCode < 500 ? error.message : 'Event could not be stored.');
      }
    });

    websocket.on('close', () => clearTimeout(authTimeout));
    websocket.on('error', () => clearTimeout(authTimeout));
  });

  wss.demoServer = demoWss;
  return wss;
}

function sendError(websocket, code, message) {
  if (websocket.readyState === 1) websocket.send(JSON.stringify({ type: 'error', code, message }));
}

module.exports = { attachWebSocketServer };

