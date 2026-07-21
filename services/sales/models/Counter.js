const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  companyCode: {
    type: String,
    required: true
  },
  entity: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 0
  }
});

CounterSchema.index({ companyCode: 1, entity: 1 }, { unique: true });

module.exports = mongoose.model('Counter', CounterSchema);
