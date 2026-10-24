'use strict';

const mongoose = require('mongoose');

const CONTROL_EVENT_CATEGORIES = [
  'control_input', 'device_status', 'controller_selection',
  'voice_status', 'robot_status', 'telemetry', 'command_result'
];

const controlEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  sessionId: { type: String, required: true, index: true },
  actorId: { type: String, required: true },
  requestId: { type: String, required: true },
  source: { type: String, required: true },
  category: { type: String, enum: CONTROL_EVENT_CATEGORIES, required: true },
  eventName: { type: String, required: true },
  outcome: { type: String, default: null },
  occurredAt: { type: Date, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
}, {
  collection: 'control_events',
  timestamps: { createdAt: 'receivedAt', updatedAt: false },
  strict: 'throw',
  versionKey: false,
  minimize: false
});

controlEventSchema.index({ sessionId: 1, occurredAt: -1, _id: -1 });
controlEventSchema.index({ sessionId: 1, eventId: 1 }, { unique: true });

const ControlEvent = mongoose.models.ControlEvent || mongoose.model('ControlEvent', controlEventSchema);

module.exports = { ControlEvent, CONTROL_EVENT_CATEGORIES };
