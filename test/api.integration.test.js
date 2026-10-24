'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

const user = { id: 'e2cb3acb-1f3c-4865-b3ea-598747a749d7', email: 'operator@example.test', role: 'operator', mustChangePassword: false };
const sessionId = '8d71f632-5716-485a-b112-43a5ce53c021';

function makeApp() {
  const calls = [];
  const app = createApp({
    config: { NODE_ENV: 'test', publicOrigins: ['http://localhost:8765'] },
    authService: {
      verifyToken: (token) => token === 'test-token' ? { sub: user.id } : (() => { throw new Error('bad token'); })(),
      register: async () => ({ user, token: 'test-token' }), login: async () => ({ user, token: 'test-token' }), getProfile: async () => user
    },
    userRepository: { findById: async (id) => id === user.id ? user : null },
    sessionService: {
      create: async () => ({ id: sessionId, ownerId: user.id, status: 'active' }),
      list: async () => [],
      getAccessible: async () => ({ id: sessionId, ownerId: user.id, status: 'active' }),
      close: async () => ({ id: sessionId, status: 'closed' })
    },
    eventService: {
      append: async (actor, id, event, requestId) => {
        calls.push({ actor, id, event, requestId });
        return { duplicate: false, event: { eventId: event.eventId || '57e0e12e-5215-4c2e-99de-56dd370d2c15', category: event.category, occurredAt: new Date(), receivedAt: new Date() } };
      },
      list: async () => ({ items: [], nextCursor: null })
    },
    healthService: { readiness: async () => ({ ready: true, dependencies: { postgres: 'up', mongodb: 'up' } }) },
    adminService: { listUsers: async () => ({ items: [], page: 1, limit: 25, total: 0 }), listAudit: async () => [] }
  });
  return { app, calls };
}

test('liveness endpoint works without database credentials', async () => {
  const { app } = makeApp();
  const response = await request(app).get('/api/v1/health/live');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.ok(response.body.requestId);
});

test('serves the backend status page and OpenAPI contract', async () => {
  const { app } = makeApp();
  const page = await request(app).get('/');
  const spec = await request(app).get('/openapi.yaml');
  assert.equal(page.status, 200);
  assert.match(page.text, /Standalone logging service/);
  assert.equal(spec.status, 200);
  assert.match(spec.text, /Robot Control Backend API/);
});

test('event capture requires a bearer token', async () => {
  const { app } = makeApp();
  const response = await request(app).post(`/api/v1/sessions/${sessionId}/events`).send({});
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
});

test('authenticated event is accepted and tagged with its request context', async () => {
  const { app, calls } = makeApp();
  const response = await request(app)
    .post(`/api/v1/sessions/${sessionId}/events`)
    .set('Authorization', 'Bearer test-token')
    .send({ source: 'gamepad', category: 'control_input', eventName: 'button.pressed', data: { buttonsPressed: ['A'] } });
  assert.equal(response.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].actor.id, user.id);
  assert.equal(calls[0].id, sessionId);
  assert.equal(calls[0].event.data.buttonsPressed[0], 'A');
  assert.ok(calls[0].requestId);
});

test('authenticated event rejects unknown payload fields', async () => {
  const { app, calls } = makeApp();
  const response = await request(app)
    .post(`/api/v1/sessions/${sessionId}/events`)
    .set('Authorization', 'Bearer test-token')
    .send({ source: 'voice', category: 'voice_status', eventName: 'voice.recognized', data: { status: 'recognized', transcript: 'drive forward' } });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('operator token cannot access admin API', async () => {
  const { app } = makeApp();
  const response = await request(app).get('/api/v1/admin/users').set('Authorization', 'Bearer test-token');
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});
