const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  targetAudience: {
    type: String,
    enum: ['employee', 'intern', 'all', 'specific_user'],
    required: true
  },
  targetUserId: {
    type: String,
    required: false
  },
  read: {
    type: Boolean,
    default: false
  },
  readBy: {
    type: [String],
    default: []
  },
  deletedBy: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Multi-Tenant Proxy Wrapper
function _NotificationProxyTarget() {}

function _getNotificationModel() {
  const { getTenantConnection } = require('../db');
  const { getModelsForConnection } = require('../utilities/modelLoader');
  const { tenantLocalStorage } = require('../utilities/tenantContext');
  const store = tenantLocalStorage ? tenantLocalStorage.getStore() : null;
  const dbName = store && store.dbName ? store.dbName : 'hrdb';
  const connection = getTenantConnection(dbName);
  const models = getModelsForConnection(connection);
  return models["Notification"];
}

module.exports = new Proxy(_NotificationProxyTarget, {
  get(target, prop) {
    if (prop === 'name') return "Notification";
    if (prop === 'schema') return notificationSchema;
    if (prop === '_name') return "Notification";
    if (prop === '_schema') return notificationSchema;
    const actualModel = _getNotificationModel();
    if (!actualModel) throw new Error("Model Notification not found for current tenant");
    if (typeof actualModel[prop] === 'function') return actualModel[prop].bind(actualModel);
    return actualModel[prop];
  },
  construct(target, args) {
    const actualModel = _getNotificationModel();
    if (!actualModel) throw new Error("Model Notification not found for current tenant");
    return new actualModel(...args);
  }
});
