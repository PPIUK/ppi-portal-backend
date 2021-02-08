'use strict';

/*
    PPI UK Portal Application Backend

    Backend REST API for PPI UK portal
*/

/*
    server.js - entry point for application server

    TAGIGIT - PPI UK
*/

/*
    Server Dependencies & Configuration
*/

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const privateKey = fs.readFileSync('dev.localhost.key', 'utf-8');
const certificate  = fs.readFileSync('dev.localhost.crt', 'utf-8');
const credentials = {key: privateKey, cert: certificate};
const express = require('express');

const mongoose = require('mongoose').set(
    'debug',
    process.env.NODE_ENV == 'development'
);

var app = express();

// approot
global.appRoot = path.resolve(__dirname);

// logger
const logger = require('./config/winston');
logger.info('Server is starting...');

/*
    Import all Mongo Models
*/

logger.info('Loading models...');
const modelDir = path.join(global.appRoot, 'models');
fs.readdirSync(modelDir).forEach((file) => require(path.join(modelDir, file)));
logger.info('Successfully loaded models!');

/*
    Configure Express Server & Import Routes
*/

logger.info('Starting express server...');
require('./config/express')(app, logger);
app.use('/api', require('./routes')(app));

/*
    Connect to DB & Start Server
*/

module.exports = new Promise((resolve, reject) => {
    mongoose.connection
        .on('error', (err) => {
            logger.error(err);
            reject(err);
        })
        .once('open', () => {
            let port = app.get('port');
            app.listen(port);
            // var httpServer = http.createServer(app);
            // var httpsServer = https.createServer(credentials, app);
            // httpServer.listen(3002);
            // httpsServer.listen(port);
            logger.info(`Server started on port: ${port}`);
            resolve(app);
        });
    mongoose.connect(process.env.DBURL, {
        keepAlive: 1,
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
});
