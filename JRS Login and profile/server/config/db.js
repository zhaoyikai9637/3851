const mysql = require('mysql2/promise');
function createPool(config) { return mysql.createPool(config.db); }
async function transaction(pool, action) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await action(connection);
        await connection.commit();
        return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}
module.exports = { createPool, transaction };
