// 1. 必须在所有 require 之前置顶（关闭底层 TLS 严格校验）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// 2. Aiven 数据库连接池：移除 ca 文件依赖，纯配置放行自签名证书
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10
});

// 3. 检查数据库连通性
async function initDB() {
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        console.log('✅ Aiven MySQL DB Connected successfully.');
    } catch (err) {
        console.error('❌ DB connection failed:', err.message);
    }
}
initDB();

// 4. 发送验证码 API
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ valid: false, error: 'Email is required.' });

    try {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            `INSERT INTO password_resets (email, code, expires_at) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE code = ?, expires_at = ?`,
            [email, code, expiresAt, code, expiresAt]
        );

        console.log(`\n-----------------------------------------`);
        console.log(`📩 [MAIL PREVIEW] OTP for ${email}: ${code}`);
        console.log(`-----------------------------------------\n`);

        res.json({ valid: true, message: 'Verification code generated.' });
    } catch (err) {
        res.status(500).json({ valid: false, error: err.message });
    }
});

// 5. 校验 OTP 码 API
app.post('/api/check-email', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ valid: false, error: 'Missing parameters.' });

    try {
        const [rows] = await pool.query(
            'SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > NOW()',
            [email, code]
        );

        if (rows.length === 0) {
            return res.status(400).json({ valid: false, error: 'Invalid or expired verification code.' });
        }

        res.json({ valid: true, message: 'Code verified successfully.' });
    } catch (err) {
        res.status(500).json({ valid: false, error: err.message });
    }
});

// 6. 设置新密码 API
app.post('/api/set-new-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ valid: false, error: 'Missing parameters.' });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            `INSERT INTO users (email, password) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE password = ?`,
            [email, hashedPassword, hashedPassword]
        );

        await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);

        res.json({ valid: true, message: 'Password reset successfully.' });
    } catch (err) {
        res.status(500).json({ valid: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Backend running at http://127.0.0.1:${PORT}`);
});