'use strict';
const path = require('path');
const express = require('express');
const mongoSanitize = require('express-mongo-sanitize');
const oAuthServer = require('express-oauth-server');
const oAuthService = require('./auth/tokenService')

var app = express();

var staticPath = path.join(__dirname, '/');
var port = process.env.PORT || 3000;
// var mongoUri = 'mongodb+srv://tefohulu:$Hutama97@databasecluster.eyzgc.mongodb.net/database?retryWrites=true&w=majority';
var mongoUri = 'mongodb://localhost/database';

let mongoose = require("mongoose").set('debug', true);
let bodyParser = require("body-parser");
let apiRoutes = require("./api-routes");

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.use(mongoSanitize());

mongoose.connect(mongoUri, { useNewUrlParser: true });
var db = mongoose.connection;

if (!db)
    console.log("Error connecting db")
else
    console.log("Db connected successfully")

app.oauth = new oAuthServer({
    model: oAuthService,
    requireClientAuthentication: {password: false},
    continueMiddleware: true,
    debug: true
})

app.use(express.static(staticPath));

// Allows you to set port in the project properties.
app.set('port', port);
app.get('/', (req, res) => res.send('Hello World with Express'));

app.use('/api', apiRoutes(app));

var server = app.listen(app.get('port'), function () {
    console.log('Running RestHub on port ' + port);
});