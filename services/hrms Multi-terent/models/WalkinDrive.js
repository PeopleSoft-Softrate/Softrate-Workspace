const mongoose = require('mongoose');

const WalkinDriveSchema = new mongoose.Schema({
  startDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  jdPdfUrl: {
    type: String,
    required: true
  },
  whatsappGroupLink: {
    type: String,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

function _walkinDriveProxyTarget() {}

function _getWalkinDriveModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["WalkinDrive"];
}

module.exports = new Proxy(_walkinDriveProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "WalkinDrive";
    if (prop === 'schema') return WalkinDriveSchema;
    if (prop === '_name') return "WalkinDrive";
    if (prop === '_schema') return WalkinDriveSchema;
    const actualModel = _getWalkinDriveModel();
    if (!actualModel) throw new Error("Model WalkinDrive not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getWalkinDriveModel();
    if (!actualModel) throw new Error("Model WalkinDrive not found for current tenant");
    return new actualModel(...args);
  }
});
