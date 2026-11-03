import mysql from 'mysql2/promise';

const transient = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR']);
export function connectionInterrupted(error) {
  return [error, error?.original, error?.parent, error?.cause].some(item => transient.has(item?.code));
}
export function safeRead(sql) {
  const text = typeof sql === 'string' ? sql : sql?.query || sql?.sql || '';
  return /^\s*SELECT\b/i.test(text) && !/\b(FOR\s+UPDATE|FOR\s+SHARE|LOCK\s+IN\s+SHARE\s+MODE|INTO)\b|\b(GET_LOCK|RELEASE_LOCK|LAST_INSERT_ID)\s*\(/i.test(text);
}
export async function recoverRead(operation) {
  try { return await operation(); }
  catch (error) {
    if (!connectionInterrupted(error)) throw error;
    return operation(); // One retry only. Callers must never replay writes or a write transaction.
  }
}
export function resilientPool(driver) {
  return new Proxy(driver, { get(target, key) {
    if (key === 'query' || key === 'execute') return (sql, ...args) => safeRead(sql)
      ? recoverRead(() => target[key](sql, ...args)) : target[key](sql, ...args);
    if (key === 'getConnection') return () => recoverRead(async () => {
      const connection = await target.getConnection();
      try { await connection.ping(); return connection; }
      catch (error) { connection.destroy(); throw error; }
    });
    const value = target[key];
    return typeof value === 'function' ? value.bind(target) : value;
  }});
}
export function createDatabasePool(options) {
  return resilientPool(mysql.createPool({ ...options, enableKeepAlive: true, keepAliveInitialDelay: 0,
    connectTimeout: 10000, maxIdle: Math.min(2, Math.max(0, (options.connectionLimit || 8) - 1)), idleTimeout: 30000 }));
}
export function resilientSequelize(db) {
  const query = db.query.bind(db);
  db.query = (sql, options = {}) => !options.transaction && safeRead(sql)
    ? recoverRead(() => query(sql, { ...options, retry: { max: 0 } }))
    : query(sql, { ...options, retry: { max: 0 } });
  return db;
}
