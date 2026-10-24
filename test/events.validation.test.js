'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { eventSchema } = require('../src/validators/event.validator');

test('accepts bounded joystick and button event values', () => {
  const parsed = eventSchema.safeParse({
    eventId: '1f966c32-903d-4836-85fb-20f7b025a1c2',
    source: 'gamepad', category: 'control_input', eventName: 'stick.changed',
    data: { buttonsPressed: ['A', 'R1'], axes: { axis_0: 0.2, axis_1: -0.7 }, triggers: { left: 0, right: 1 } }
  });
  assert.equal(parsed.success, true);
});

test('rejects out-of-range axis and motor telemetry', () => {
  const axis = eventSchema.safeParse({ source: 'gamepad', category: 'control_input', eventName: 'stick.changed', data: { axes: { axis_0: 1.5 } } });
  const telemetry = eventSchema.safeParse({ source: 'robot_bridge', category: 'telemetry', eventName: 'telemetry.update', data: { leftMotorPwm: 300 } });
  assert.equal(axis.success, false);
  assert.equal(telemetry.success, false);
});

test('rejects raw audio/transcription fields instead of persisting them', () => {
  const voice = eventSchema.safeParse({ source: 'voice', category: 'voice_status', eventName: 'voice.recognized', data: { status: 'recognized', language: 'ar', transcript: 'move forward' } });
  const generic = eventSchema.safeParse({ source: 'system', category: 'device_status', eventName: 'device.connected', data: { deviceType: 'controller', connected: true }, rawAudio: 'base64' });
  assert.equal(voice.success, false);
  assert.equal(generic.success, false);
});

test('rejects event names that could carry sentence text', () => {
  const parsed = eventSchema.safeParse({ source: 'voice', category: 'voice_status', eventName: 'move the robot forward', data: { status: 'recognized' } });
  assert.equal(parsed.success, false);
});
