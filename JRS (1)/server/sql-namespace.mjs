// Only the trusted HR module's fixed SQL is rewritten, never user-supplied identifiers.
export const recruitmentSql = sql => sql.replace(/\bhr_([a-z_]+)/g, 'recruiting_$1');
export function namespacePool(driver) {
  return new Proxy(driver, {
    get(target, key) {
      if (key === 'query' || key === 'execute') return (sql, ...args) => target[key](recruitmentSql(sql), ...args);
      if (key === 'getConnection') return async () => namespacePool(await target.getConnection());
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
