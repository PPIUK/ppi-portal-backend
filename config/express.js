'use strict';
/*
    express.js

    TAGIGIT - PPI UK
*/

/*
    Module dependencies.
*/

const mongoSanitize = require('express-mongo-sanitize');
const bodyParser = require('body-parser');
const cors = require('cors');

const oAuthServer = require('express-oauth-server');
const oAuthService = require(global.appRoot + '/routes/auth/tokenService');

module.exports = function (app, logger) {
    // setup body-parser middleware
    app.use(
        bodyParser.urlencoded({
            extended: true,
        })
    );
    app.use(bodyParser.json());

    // setup mongo sanitizer
    app.use(mongoSanitize());

    // app.options('*', cors());
    const corsOptions = {
        origin: ['http://localhost:3001', 'portal.ppiuk.org'],
        credentials: true,
        exposedHeaders: ['Content-Disposition'],
    }
    // allow CORS
    app.use(cors(corsOptions));

    // debug logging
    app.use((req, res, next) => {
        res.on('finish', () => {
            logger.debug(`${req.method} ${req.path} ${res.statusCode}
            \tRequest Body: ${JSON.stringify(req.body)}\t
            \tRequest QueryParams: ${JSON.stringify(req.query)}`);
        });
        next();
    });

    // setup OAuth
    app.oauth = new oAuthServer({
        model: oAuthService,
        requireClientAuthentication: { refresh_token: false, password: false },
        refreshTokenLifetime: 86400,
        continueMiddleware: true,
        debug: true,
    });

    // setup ports
    app.set('port', process.env.PORT || 3000);
};
