const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true
  },
  leadId: {
    type: String,
    required: false
  },
  type: {
    type: String,
    enum: ['task', 'meeting', 'call'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  activityDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
