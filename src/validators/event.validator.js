'use strict';

const { z } = require('zod');

const source = z.enum(['web', 'gamepad', 'remote', 'voice', 'robot_bridge', 'system']);
const eventId = z.string().uuid().optional();
const occurredAt = z.string().datetime({ offset: true }).optional();
const eventName = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/);
const outcome = z.enum(['accepted', 'rejected', 'started', 'completed', 'failed', 'stopped']).optional();
const button = z.string().min(1).max(32).regex(/^[A-Za-z0-9_+.-]+$/);
const axisMap = z.record(z.string().regex(/^axis_[0-9]{1,2}$/), z.number().finite().min(-1).max(1)).refine((value) => Object.keys(value).length <= 16, 'At most 16 axes');
const sensorMap = z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,31}$/), z.number().finite().min(-100000).max(100000)).refine((value) => Object.keys(value).length <= 24, 'At most 24 sensor readings');
const common = { eventId, occurredAt, source, eventName, outcome };

const eventSchema = z.discriminatedUnion('category', [
  z.object({ ...common, category: z.literal('control_input'), data: z.object({
    buttonsPressed: z.array(button).max(32).optional(), axes: axisMap.optional(),
    triggers: z.object({ left: z.number().finite().min(0).max(1).optional(), right: z.number().finite().min(0).max(1).optional() }).strict().optional(),
    dpad: z.enum(['center', 'up', 'down', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right']).optional(),
    controlMode: z.enum(['keyboard', 'gamepad', 'touch', 'remote']).optional()
  }).strict() }).strict(),
  z.object({ ...common, category: z.literal('device_status'), data: z.object({
    deviceType: z.enum(['controller', 'robot_bridge', 'serial', 'esp32', 'arduino', 'remote', 'display', 'other']),
    connected: z.boolean(), ready: z.boolean().optional(), statusCode: z.string().max(40).regex(/^[A-Za-z0-9_.-]*$/).optional()
  }).strict() }).strict(),
  z.object({ ...common, category: z.literal('controller_selection'), data: z.object({
    deviceId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/).optional(), active: z.boolean(), slot: z.number().int().min(0).max(32).optional()
  }).strict() }).strict(),
  z.object({ ...common, category: z.literal('voice_status'), data: z.object({
    status: z.enum(['idle', 'recording', 'transcribing', 'recognized', 'rejected', 'failed', 'cancelled']),
    language: z.enum(['ar', 'en', 'other']).optional(), durationMs: z.number().int().min(0).max(120000).optional(),
    reasonCode: z.string().max(48).regex(/^[A-Za-z0-9_.-]*$/).optional()
  }).strict() }).strict(),
  z.object({ ...common, category: z.literal('robot_status'), data: z.object({
    connected: z.boolean(), armed: z.boolean().optional(), mode: z.enum(['idle', 'manual', 'autonomous', 'failsafe', 'error']).optional(),
    firmwareVersion: z.string().max(32).regex(/^[A-Za-z0-9_.+-]*$/).optional()
  }).strict() }).strict(),
  z.object({ ...common, category: z.literal('telemetry'), data: z.object({
    speedLevel: z.number().finite().min(0).max(10).optional(), leftMotorPwm: z.number().int().min(-255).max(255).optional(),
    rightMotorPwm: z.number().int().min(-255).max(255).optional(), distanceCm: z.number().finite().min(0).max(100000).optional(),
    batteryVoltage: z.number().finite().min(0).max(100).optional(), sensors: sensorMap.optional()
  }).strict() }).strict(),
  z.object({ ...common, category: z.literal('command_result'), data: z.object({
    commandType: z.enum(['drive', 'stop', 'speed', 'beep', 'led', 'sensor_query', 'emergency_stop', 'other']),
    status: z.enum(['accepted', 'executed', 'rejected', 'failed', 'timed_out']), durationMs: z.number().int().min(0).max(600000).optional(),
    reasonCode: z.string().max(48).regex(/^[A-Za-z0-9_.-]*$/).optional()
  }).strict() }).strict()
]);

const eventListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional()
}).strict();

module.exports = { eventSchema, eventListQuerySchema };
