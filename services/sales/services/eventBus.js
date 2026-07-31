const crypto = require('crypto');
const { getRedisClient, getRedisSubscriber, isRedisEnabled } = require('./redisClient');

// Map<"companyCode_employeeId", Set<res>>
const clients = new Map();
const instanceId = crypto.randomUUID();
let subscriberReady = false;

function key(companyCode, employeeId) {
  return `${companyCode}__${employeeId}`;
}

function emitLocalToEmployee(companyCode, employeeId, data) {
  const clientKey = key(companyCode, employeeId);
  const set = clients.get(clientKey);
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (err) {
      set.delete(res);
    }
  }
}

function emitLocalToCompany(companyCode, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const [clientKey, set] of clients) {
    if (!clientKey.startsWith(`${companyCode}__`)) continue;
    for (const res of set) {
      try {
        res.write(payload);
      } catch (err) {
        set.delete(res);
      }
    }
  }
}

async function publish(channel, data) {
  const redis = getRedisClient();
  if (!redis || !isRedisEnabled()) return;

  try {
    await redis.publish(channel, JSON.stringify({
      sourceInstanceId: instanceId,
      data,
    }));
  } catch (err) {
    console.warn(`[SSE redis publish] ${err.message}`);
  }
}

function ensureRedisSubscriber() {
  if (subscriberReady || !isRedisEnabled()) return;

  const subscriber = getRedisSubscriber();
  if (!subscriber) return;

  subscriberReady = true;

  subscriber.psubscribe('events:company:*', 'events:employee:*:*', (err) => {
    if (err) {
      console.warn(`[SSE redis subscribe] ${err.message}`);
    }
  });

  subscriber.on('pmessage', (_pattern, channel, message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.sourceInstanceId === instanceId) return;

      if (channel.startsWith('events:company:')) {
        const companyCode = channel.slice('events:company:'.length);
        emitLocalToCompany(companyCode, parsed.data);
        return;
      }

      if (channel.startsWith('events:employee:')) {
        const [, , companyCode, employeeId] = channel.split(':');
        emitLocalToEmployee(companyCode, employeeId, parsed.data);
      }
    } catch (err) {
      console.warn(`[SSE redis pmessage] ${err.message}`);
    }
  });
}

function addClient(companyCode, employeeId, res) {
  ensureRedisSubscriber();
  const clientKey = key(companyCode, employeeId);
  if (!clients.has(clientKey)) clients.set(clientKey, new Set());
  clients.get(clientKey).add(res);
  console.log(`[SSE] Client connected: ${clientKey} (total: ${clients.get(clientKey).size})`);
}

function removeClient(companyCode, employeeId, res) {
  const clientKey = key(companyCode, employeeId);
  const set = clients.get(clientKey);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(clientKey);
  }
  console.log(`[SSE] Client disconnected: ${clientKey}`);
}

function emitToEmployee(companyCode, employeeId, data, options = {}) {
  emitLocalToEmployee(companyCode, employeeId, data);
  if (!options.skipRedis) {
    publish(`events:employee:${companyCode}:${employeeId}`, data);
  }
}

function emitToCompany(companyCode, data, options = {}) {
  emitLocalToCompany(companyCode, data);
  if (!options.skipRedis) {
    publish(`events:company:${companyCode}`, data);
  }
}

module.exports = { addClient, removeClient, emitToEmployee, emitToCompany };
