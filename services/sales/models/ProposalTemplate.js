const mongoose = require('mongoose');

const proposalTemplateSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  companyCode: {
    type: String,
    required: true,
    index: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  pages: {
    type: Array,
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProposalTemplate', proposalTemplateSchema);
