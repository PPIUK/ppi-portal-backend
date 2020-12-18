'use strict';
/*
    winston.js
    
    TAGIGIT - PPI UK
*/

/*
    Module dependencies
*/

const winston = require('winston');

/*
    Setup winston logging
*/

// setup transports
let transports = [
    new winston.transports.File({
        filename: 'error.log',
        level: 'error',
        format: winston.format.uncolorize(),
    }), // error logs only
    new winston.transports.File({
        filename: 'combined.log',
        format: winston.format.uncolorize(),
    }), // combined log
];

if (!process.env.NODE_ENV || process.env.NODE_ENV == 'development')
    // to console if we are not in development
    transports.push(new winston.transports.Console());

// export logger
module.exports = winston.createLogger({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss' }),
        winston.format.align(),
        winston.format.printf(
            (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
    ),
    level: process.env.LOG_LEVEL || 'info',
    transports: transports,
});
