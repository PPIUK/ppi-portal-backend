const mongoose = require('mongoose');
const dedent = require('dedent');
const crypto = require('crypto');

const Profile = mongoose.model('Profile');
const Token = mongoose.model('VerificationToken');
const AccessToken = mongoose.model('AccessToken');
const RefreshToken = mongoose.model('RefreshToken');

const mailTransporter = require(global.appRoot + '/config/nodemailer');

const profileController = require('./profileController');

const logger = require('../../config/winston');

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

        if (profile.roles.includes('blocked')) {
            return res.status(403).json({
                message:
                    'Your account has been blocked. Please contact us for more detail.',
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

        profileController.validateUniEmail(req, res);

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
    profileController.profileFilesUpload(req, res, async function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }
        const emailQuery = req.body.email
            ? { email: req.body.email }
            : { emailPersonal: req.body.emailPersonal };
        Profile.findOne(emailQuery, async function (err, _profile) {
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
            if (req.body.email) {
                profileController.validateUniEmail(req, res);
            }
            if (!req.body.password) {
                return res.status(400).json({
                    message: 'Password required.',
                });
            }
            if (req.body.branch === 'All') {
                return res.status(400).json({
                    message: `Cannot set own branch to 'All'`,
                });
            }

            if (req.files) {
                if ('studentProof' in req.files) {
                    req.body.studentProof = mongoose.Types.ObjectId(
                        req.files['studentProof'][0].id
                    );
                }
                if ('profilePicture' in req.files) {
                    req.body.profilePicture = mongoose.Types.ObjectId(
                        req.files['profilePicture'][0].id
                    );
                }
            }

            let profile = new Profile({
                ...req.body,
                emailVerified: false,
                roles: ['basic'],
            });

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
    });
};

/*
    POST /auth/set-password. Set password for the account.
    Email must be a valid UK university email address (ends with 'ac.uk' or '.edu').
    Verification email is sent afterwards.
 */
exports.setPassword = function (req, res) {
    if (!req.body.email.endsWith('ac.uk') || !req.body.email.endsWith('.edu')) {
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
    Email must be a valid UK university email address (ends with 'ac.uk' or '.edu').
 */
exports.resendVerificationEmail = function (req, res) {
    if (!req.body.email.endsWith('ac.uk') || !req.body.email.endsWith('.edu')) {
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
                'https://' +
                process.env.BASE_URI +
                '/api/auth/reset-password/' +
                token.token;

            // TODO: modify as needed, add templating?
            let message = {
                from:
                    'PPI UK Member Portal - No Reply <ppiunitedkingdom@gmail.com>', // sender address
                to: profile.email, // list of receivers
                cc: profile.emailPersonal,
                subject: 'Reset your password', // Subject line
                text: dedent`PPI UK Member Portal received your password reset request!
                
                Please click the link below to reset your password
                ${link}

                Automated Bot - please do not reply :)
            `,
            };

            mailTransporter.sendMail(message, (err) => {
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

            return res
                .status(301)
                .redirect(`/reset-password/${req.params.token}`);
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
            logger.info(`Resetting password for ${token.userId}`);
            if (!profile) {
                return res.status(404).json({
                    message: 'Profile for this token is not found.',
                });
            }

            await profile.setPassword(req.body.password);
            profile.emailVerified = true;
            await profile.save({ validateBeforeSave: false });

            return res.status(200).json({
                message: 'Password reset successful.',
            });
        } catch (err) {
            logger.error(err);
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
            'https://' +
            process.env.BASE_URI +
            '/api/auth/verify-email/' +
            token.token;

        // TODO: modify as needed, add templating?
        let message = {
            from:
                'PPI UK Member Portal - No Reply <ppiunitedkingdom@gmail.com>', // sender address
            replyTo: 'no-reply@example.com',
            to: profile.email, // list of receivers
            subject: 'Verify your PPI UK Portal account!', // Subject line
            text: link, // plain text body
            html: `<a href="${link}">Click here</a> to verify your account!<br/>Use this link if the above does not work:<br/>${link}`, // html body
        };

        if (!profile.email) {
            message.to = profile.emailPersonal;
            message.html +=
                '<br/><br/> You have not submitted your university email address. ' +
                'You need to update your university email through the portal once you have access to it, ' +
                'no later than 31 September 2021';
        }

        mailTransporter.sendMail(message, (err) => {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            let email = profile.email ? profile.email : profile.emailPersonal;
            return res.status(201).json({
                message:
                    'Account registered. A verification email has been sent to ' +
                    email +
                    '.',
            });
        });
    });
}

module.exports.sendVerificationEmail = sendVerificationEmail;

// TODO: remove
exports.createAccessToken = function (req, res) {
    Profile.findOne(
        { temporaryToken: req.body.token },
        { password: 0 },
        function (err, profile) {
            if (err) {
                logger.error(`Error in createAccessToken: ${err}`);
                return res.status(500).json({
                    message: err.message,
                });
            }
            const exp = new Date();
            exp.setHours(exp.getHours() + 1);

            const token = crypto.randomBytes(40).toString('hex');
            let accessToken = new AccessToken();
            accessToken.accessToken = token;
            accessToken.accessTokenExpiresAt = exp;
            accessToken.user = profile._id;
            accessToken.client = 'api';
            accessToken.save(function (err) {
                if (err) {
                    logger.error(`Error in createAccessToken: ${err}`);
                    return res.status(500).json({
                        message: err.message,
                    });
                }
            });

            const rToken = crypto.randomBytes(40).toString('hex');
            let refreshToken = new RefreshToken();
            refreshToken.refreshToken = rToken;
            refreshToken.refreshTokenExpiresAt = exp;
            refreshToken.user = profile._id;
            refreshToken.client = 'api';
            refreshToken.save(function (err) {
                if (err) {
                    logger.error(`Error in createAccessToken: ${err}`);
                    return res.status(500).json({
                        message: err.message,
                    });
                }
            });

            return res.status(200).json({
                access_token: token,
                token_type: 'Bearer',
                expires_in: 3599,
                refresh_token: rToken,
            });
        }
    );
};
