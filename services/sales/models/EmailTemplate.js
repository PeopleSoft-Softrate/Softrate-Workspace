const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
  companyCode: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
