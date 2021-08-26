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
    host:
        process.env.NODE_ENV === 'production'
            ? 'smtp.gmail.com'
            : 'smtp.ethereal.email',
    port: process.env.NODE_ENV === 'production' ? 465 : 587,
    secure: process.env.NODE_ENV === 'production' ? true : false,
    auth: {
        user:
            process.env.NODE_ENV === 'production'
                ? 'ppiunitedkingdom@gmail.com'
                : process.env.ETHEREAL_USER,
        pass:
            process.env.NODE_ENV === 'production'
                ? process.env.MAILPASS
                : process.env.ETHEREAL_PASS,
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
