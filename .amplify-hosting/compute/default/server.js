'use strict';
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const path = require('path');
process.chdir(__dirname);
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('./server/index.js');
