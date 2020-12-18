'use strict';

/*
    Module Dependencies
*/

const nodemailer = require('nodemailer');

/*
    Create transport
*/

// create transport + verify
let transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'ppiunitedkingdom@gmail.com',
        pass: process.env.MAILPASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
});

transport.verify(function (err) {
    if (err) throw new Error('Invalid email configuration!');
});

// export transport
module.exports = transport;
