const mongoose = require('mongoose');

const Profile = mongoose.model('Profile');
const Token = mongoose.model('VerificationToken');
const AccessToken = mongoose.model('AccessToken');
const RefreshToken = mongoose.model('RefreshToken');

const mailTransporter = require(global.appRoot + '/config/nodemailer');

/*
    POST /auth/account-lookup. Find if email is already registered or in census.
 */
exports.accountLookup = function (req, res) {
    Profile.findOne({
        $or: [{ email: req.body.email }, { emailPersonal: req.body.email }],
    }).exec(function (err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: 'Profile not found',
            });
        }
        if (!profile.password) {
            return res.status(310).json({
                message:
                    'Set up password please. Go to route /api/auth/set-password',
                email: profile.email,
            });
        }
        if (!profile.emailVerified) {
            return res.status(311).json({
                message: 'Email for this account is not verified yet.',
                email: profile.email,
            });
        }
        if (profile) {
            return res.status(200).json({
                message: 'Profile found',
            });
        }
    });
};

/*
    POST /auth/login. Login using email and password. OAuth handled by middleware.
    Email can be personal or university email? The expectation is university email is used, as it is often autofilled.
    This should return an access token.
 */
exports.login = function (req, res, cbFunc) {
    Profile.findOne({
        $or: [
            { email: req.body.username },
            { emailPersonal: req.body.username },
        ],
    }).exec(function (err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: 'Profile not found',
            });
        }
        if (!profile.emailVerified) {
            return res.status(401).json({
                message: 'Email for this account is not verified yet.',
            });
        }
        cbFunc();
    });
};

/*
    POST /auth/logout. Deletes the access token.
 */
exports.logout = function (req, res) {
    AccessToken.findOneAndDelete(
        { accessToken: res.locals.oauth.token.accessToken },
        function (err) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            return res.status(200).json({
                message: 'Logged out',
            });
        }
    );
};

exports.register = function (req, res) {
    Profile.findOne({ email: req.body.email }, function (err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (profile !== null && profile.password !== undefined) {
            return res.status(409).json({
                message:
                    'Email already registered. Please login using your email and password',
            });
        }
        if (profile !== null && profile.password === undefined) {
            return res.status(401).json({
                message:
                    'Set up password please. Go to route /api/auth/set-password',
            });
        }
        if (!profile) {
            return res.status(300).json({
                message: 'Redirect to route /api/auth/register/new',
            });
        }
    });
};

exports.registerNew = function (req, res) {
    Profile.findOne({ email: req.body.email }, async function (err, _profile) {
        if (err) {
            return res.status(400).json({
                message: err.message,
            });
        }
        if (_profile) {
            return res.status(409).json({
                message:
                    'Email already registered. Please login /auth/login or set password /auth/set-password.',
            });
        }
        if (!req.body.password) {
            return res.status(400).json({
                message: 'Password required.',
            });
        }

        let profile = new Profile({...req.body, emailVerified: false, roles: ['basic']});

        try {
            await profile.setPassword(req.body.password);
            await profile.save();
        } catch (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        await sendVerificationEmail(profile, req, res);
    });
};

/*
    POST /auth/set-password. Set password for the account.
    Email must be a valid UK university email address (ends with 'ac.uk').
    Verification email is sent afterwards.
 */
exports.setPassword = function (req, res) {
    if (!req.body.email.endsWith('ac.uk')) {
        return res.status(400).json({
            message: 'Email is not a valid UK university email address.',
        });
    }
    Profile.findOne({ email: req.body.email }, async function (err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: 'Profile not found',
            });
        }
        if (profile.password) {
            return res.status(409).json({
                message:
                    'Account had already been registered. Please login using your email and password',
            });
        }
        if (!profile.password) {
            if (!req.body.password) {
                return res.status(400).json({
                    message: 'New password required.',
                });
            }
            try {
                await profile.setPassword(req.body.password);
                await profile.save();
            } catch (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            await sendVerificationEmail(profile, req, res);
        }
    });
};

/*
    POST /auth/resend-verification. Resends verification email with the token.
    Email must be a valid UK university email address (ends with 'ac.uk').
 */
exports.resendVerificationEmail = function (req, res) {
    if (!req.body.email.endsWith('ac.uk')) {
        return res.status(400).json({
            message: 'Email is not a valid UK university email address.',
        });
    }
    Profile.findOne({ email: req.body.email }, async function (err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: 'Profile not found',
            });
        }
        if (profile.emailVerified) {
            return res.status(400).json({
                message:
                    'Account had already been verified by email. Please login using your email and password',
            });
        }
        await sendVerificationEmail(profile, req, res);
    });
};

/*
    GET /auth/verify-email/:token
    Verifies the email. emailVerified field changes to true.
 */
exports.verifyEmail = function (req, res) {
    if (!req.params.token) {
        return res.status(400).json({
            message: 'Please include token',
        });
    }

    Token.findOne({ token: req.params.token }, async function (err, token) {
        try {
            if (!token) {
                return res.status(404).json({
                    message:
                        'Valid token is not found. Your token may be expired.',
                });
            }

            let profile = await Profile.findOne({ _id: token.userId });
            if (!profile) {
                return res.status(404).json({
                    message: 'Profile for this token is not found.',
                });
            }

            if (profile.emailVerified) {
                return res.status(400).json({
                    message:
                        'Account had already been verified. Please log in.',
                });
            }

            profile.emailVerified = true;
            await profile.save();
            return res.status(200).json({
                message: 'This account is now verified. Please log in.',
            });
        } catch (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
    });
};

/*
    POST /auth/forgot
    Sends a token to email for password reset.
    Currently will only send the email to the university email address.
 */
exports.forgotPassword = function (req, res) {
    Profile.findOne({
        $or: [{ email: req.body.email }, { emailPersonal: req.body.email }],
    }).exec(function (err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: 'Profile not found',
            });
        }

        const token = profile.generateVerificationToken();

        token.save(function (err) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            let link =
                process.env.BASE_URI +
                '/api/auth/reset-password/' +
                token.token;

            // TODO: modify as needed, add templating?
            let message = {
                from: '"Fred Foo 👻" <foo@example.com>', // sender address
                to: profile.email, // list of receivers
                subject: 'Reset your password', // Subject line
                text: link, // plain text body
                html: link, // html body
            };

            transporter.sendMail(message, (err) => {
                if (err) {
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                return res.status(201).json({
                    message:
                        'Password reset requested. An email has been sent to ' +
                        profile.email +
                        '.',
                });
            });
        });
    });
};

/*
    GET /auth/reset-password/:token
    Checks if the token is valid, if it is, the reset password form should be shown to user.
 */
exports.allowResetPassword = function (req, res) {
    if (!req.params.token) {
        return res.status(400).json({
            message: 'Please include token',
        });
    }
    Token.findOne({ token: req.params.token }, async function (err, token) {
        try {
            if (!token) {
                return res.status(404).json({
                    message:
                        'Valid token is not found. Your token may be expired.',
                });
            }

            let profile = await Profile.findOne({ _id: token.userId });
            if (!profile) {
                return res.status(404).json({
                    message: 'Profile for this token is not found.',
                });
            }

            return res.status(200).json({
                message: 'Token is valid. Redirect to password reset form.',
            });
        } catch (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
    });
};

/*
    POST /auth/reset-password/:token
    Resets the password, provided that the token is valid and matches the email.
 */
exports.resetPassword = function (req, res) {
    if (!req.params.token) {
        return res.status(400).json({
            message: 'Please include token',
        });
    }
    if (!req.body.password) {
        return res.status(400).json({
            message: 'New password required.',
        });
    }
    Token.findOne({ token: req.params.token }, async function (err, token) {
        try {
            if (!token) {
                return res.status(404).json({
                    message:
                        'Valid token is not found. Your token may be expired.',
                });
            }

            let profile = await Profile.findOne({ _id: token.userId });
            if (!profile) {
                return res.status(404).json({
                    message: 'Profile for this token is not found.',
                });
            }
            if (profile.email !== req.body.email) {
                return res.status(401).json({
                    message: 'Token and email address mismatch.',
                });
            }
            await profile.setPassword(req.body.password);
            await profile.save();

            return res.status(200).json({
                message: 'Password reset successful.',
            });
        } catch (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
    });
};

async function sendVerificationEmail(profile, req, res) {
    const token = profile.generateVerificationToken();

    token.save(function (err) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        let link =
            process.env.BASE_URI + '/api/auth/verify-email/' + token.token;

        // TODO: modify as needed, add templating?
        let message = {
            from: 'PPI UK Friendly Bot <ppiunitedkingdom@gmail.com>', // sender address
            replyTo: 'no-reply@example.com',
            to: profile.email, // list of receivers
            subject: 'Verify your PPI UK Portal account!', // Subject line
            text: link, // plain text body
            html: `<a href="${link}">Click here</a> to verify your account!\n\nUse this link if the above does not work:\n${link}`, // html body
        };

        mailTransporter.sendMail(message, (err) => {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            return res.status(201).json({
                message:
                    'Account registered. A verification email has been sent to ' +
                    profile.email +
                    '.',
            });
        });
    });
}
