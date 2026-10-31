const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, ROOT } = require('../server/config/config');
function loadCoordinatorConfig() {
    const config = loadConfig();
    const text = fs.readFileSync(path.join(ROOT, '.local-backup/JRS_TEAM_DATABASE_CREDENTIALS.txt'), 'utf8');
    const clean = value => value.trim().replace(/^[`'"]|[`'"]$/g, '');
    const section = text.match(/^Schema coordinator only:\s*\r?\n([^\r\n]+)/mi);
    const match = section?.[1].match(/username:\s*([^|\r\n]+)\|\s*password:\s*([^\r\n]+)/i);
    if (!match) throw new Error('Coordinator credentials unavailable.');
    for (const [label, expected] of [['Host', config.db.host], ['Port', String(config.db.port)], ['Database', config.db.database]]) {
        const value = text.match(new RegExp('^' + label + ':\\s*(.+)$', 'mi'))?.[1];
        if (!value || clean(value) !== expected) throw new Error('Coordinator target does not match current database.');
    }
    return { ...config, db: { ...config.db, user: clean(match[1]), password: clean(match[2]) } };
}
module.exports = { loadCoordinatorConfig };
