const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const random = () => crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'jrs_candidate_session';
module.exports = { hash, random, SESSION_COOKIE };
