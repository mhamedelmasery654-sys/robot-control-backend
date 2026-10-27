'use strict';

const { randomUUID } = require('node:crypto');

const TURN_DURATION_MS = 2 * 60 * 1000;
const MAX_VISITORS = 50;
const MAX_MESSAGE_BYTES = 2048;
const SIMULATION_SPEED = 0.9;

function attachDemoSimulator(wss) {
  const visitors = new Map();
  const waiting = [];
  let holderId = null;
  let holderUntil = 0;
  let lastTick = Date.now();
  const control = {
    x: 0,
    z: 0,
    yaw: 0,
    forward: 0,
    turn: 0,
    speed: SIMULATION_SPEED,
    lights: false,
    device: 0,
    screenIndex: 0
  };

  function resetMotion() {
    control.forward = 0;
    control.turn = 0;
  }

  function takeNextTurn(now = Date.now()) {
    while (!holderId && waiting.length) {
      const nextId = waiting.shift();
      const next = visitors.get(nextId);
      if (!next || next.socket.readyState !== 1) continue;
      next.wantsTurn = true;
      holderId = nextId;
      holderUntil = now + TURN_DURATION_MS;
      resetMotion();
    }
  }

  function snapshotFor(visitor, now) {
    const queuePosition = visitor.id === holderId ? 0 : (visitor.wantsTurn ? waiting.indexOf(visitor.id) + 1 : null);
    return {
      type: 'snapshot',
      self: { id: visitor.id, isHolder: visitor.id === holderId, queuePosition },
      visitorCount: visitors.size,
      queueLength: waiting.length,
      holderRemainingMs: holderId ? Math.max(0, holderUntil - now) : 0,
      control: { ...control }
    };
  }

  function send(visitor, message) {
    if (visitor.socket.readyState === 1) visitor.socket.send(JSON.stringify(message));
  }

  function broadcast(now = Date.now()) {
    for (const visitor of visitors.values()) send(visitor, snapshotFor(visitor, now));
  }

  function release(visitor, now = Date.now()) {
    const queueIndex = waiting.indexOf(visitor.id);
    if (queueIndex !== -1) waiting.splice(queueIndex, 1);
    visitor.wantsTurn = false;
    if (visitor.id === holderId) {
      holderId = null;
      holderUntil = 0;
      resetMotion();
      takeNextTurn(now);
    }
    broadcast(now);
  }

  function onConnection(socket) {
    if (visitors.size >= MAX_VISITORS) {
      socket.close(1013, 'Demo is full; try again later.');
      return;
    }
    const visitor = {
      id: randomUUID(),
      socket,
      wantsTurn: true,
      windowAt: Date.now(),
      messagesInWindow: 0,
      alive: true
    };
    visitors.set(visitor.id, visitor);
    if (!holderId) {
      holderId = visitor.id;
      holderUntil = Date.now() + TURN_DURATION_MS;
    } else waiting.push(visitor.id);

    socket.on('pong', () => { visitor.alive = true; });
    socket.on('message', (buffer) => {
      const now = Date.now();
      if (buffer.length > MAX_MESSAGE_BYTES) return socket.close(1009, 'Message is too large.');
      if (now - visitor.windowAt > 5000) {
        visitor.windowAt = now;
        visitor.messagesInWindow = 0;
      }
      visitor.messagesInWindow += 1;
      if (visitor.messagesInWindow > 35) return socket.close(1008, 'Demo message rate exceeded.');

      let message;
      try { message = JSON.parse(buffer.toString('utf8')); }
      catch { return send(visitor, { type: 'error', code: 'INVALID_JSON' }); }
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return send(visitor, { type: 'error', code: 'INVALID_MESSAGE' });
      }

      if (message.type === 'join') {
        if (!visitor.wantsTurn && visitor.id !== holderId) {
          visitor.wantsTurn = true;
          if (!holderId) {
            holderId = visitor.id;
            holderUntil = now + TURN_DURATION_MS;
          } else waiting.push(visitor.id);
        }
      } else if (message.type === 'release') {
        release(visitor, now);
        return;
      } else {
        if (visitor.id !== holderId || now >= holderUntil) {
          send(visitor, { type: 'error', code: 'NOT_YOUR_TURN' });
          return;
        }
        if (message.type === 'drive') {
          if (!Number.isFinite(message.forward) || !Number.isFinite(message.turn)) {
            return send(visitor, { type: 'error', code: 'INVALID_DRIVE' });
          }
          control.forward = Math.max(-1, Math.min(1, message.forward));
          control.turn = Math.max(-1, Math.min(1, message.turn));
        } else if (message.type === 'lights') {
          if (typeof message.enabled !== 'boolean') return send(visitor, { type: 'error', code: 'INVALID_LIGHT_STATE' });
          control.lights = message.enabled;
        } else if (message.type === 'device') {
          if (!Number.isInteger(message.index) || message.index < 0 || message.index > 2) return send(visitor, { type: 'error', code: 'INVALID_DEVICE' });
          control.device = message.index;
        } else if (message.type === 'screen') {
          if (!Number.isInteger(message.index) || message.index < 0 || message.index > 3) return send(visitor, { type: 'error', code: 'INVALID_SCREEN' });
          control.screenIndex = message.index;
        } else {
          send(visitor, { type: 'error', code: 'UNSUPPORTED_MESSAGE' });
          return;
        }
      }
      broadcast(now);
    });

    socket.on('close', () => {
      const wasHolder = visitor.id === holderId;
      const queueIndex = waiting.indexOf(visitor.id);
      if (queueIndex !== -1) waiting.splice(queueIndex, 1);
      visitors.delete(visitor.id);
      if (wasHolder) {
        holderId = null;
        holderUntil = 0;
        control.lights = false;
        resetMotion();
        takeNextTurn();
      }
      broadcast();
    });
    socket.on('error', () => {});
    broadcast();
  }

  wss.on('connection', onConnection);
  const ticker = setInterval(() => {
    const now = Date.now();
    const dt = Math.max(0, Math.min(0.25, (now - lastTick) / 1000));
    lastTick = now;
    if (holderId && now >= holderUntil) {
      const expired = visitors.get(holderId);
      if (expired) expired.wantsTurn = false;
      holderId = null;
      holderUntil = 0;
      resetMotion();
      takeNextTurn(now);
    }
    if (holderId && (control.forward || control.turn)) {
      control.yaw = (control.yaw + control.turn * 1.55 * dt) % (Math.PI * 2);
      control.x = Math.max(-1.7, Math.min(1.7, control.x + Math.sin(control.yaw) * control.forward * control.speed * dt));
      control.z = Math.max(-1.25, Math.min(1.25, control.z + Math.cos(control.yaw) * control.forward * control.speed * dt));
    }
    broadcast(now);
  }, 100);
  const heartbeat = setInterval(() => {
    for (const visitor of visitors.values()) {
      if (!visitor.alive) {
        visitor.socket.terminate();
        continue;
      }
      visitor.alive = false;
      visitor.socket.ping();
    }
  }, 25_000);
  wss.on('close', () => {
    clearInterval(ticker);
    clearInterval(heartbeat);
  });

  return { releaseAll: () => { for (const visitor of visitors.values()) visitor.socket.close(1001, 'Server shutting down.'); } };
}

module.exports = { attachDemoSimulator, TURN_DURATION_MS };

