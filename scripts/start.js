const fs = require('fs');
const path = require('path');

const dbFile = process.env.DB_FILE || 'finance.db';
const dir = path.dirname(path.resolve(dbFile));
fs.mkdirSync(dir, { recursive: true });

require('../server');
