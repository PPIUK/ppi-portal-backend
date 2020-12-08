Profile = require('../profileModel');
Token = require('./verificationTokenModel');
AccessToken = require('./accessTokenModel');
RefreshToken = require('./refreshTokenModel')

/*
    POST /auth/account-lookup. Find if email is already registered or in census.
 */
exports.accountLookup = function (req, res) {
    Profile.findOne({$or: [
            {email: req.body.email},
            {emailPersonal: req.body.email}
    ]}).exec(function(err, profile){
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: "Profile not found"
            });
        }
        if (!profile.password) {
            return res.status(310).json({
                message: "Set up password please. Go to route /api/auth/set-password",
                email: profile.email
            })
        }
        if (!profile.emailVerified) {
            return res.status(311).json({
                message: "Email for this account is not verified yet.",
                email: profile.email
            })
        }
        if (profile) {
            return res.status(200).json({
                message: "Profile found"
            });
        }
    });
}

/*
    POST /auth/login. Login using email and password. OAuth handled by middleware.
    Email can be personal or university email? The expectation is university email is used, as it is often autofilled.
    This should return an access token.
 */
exports.login = function (req, res, cbFunc) {
    Profile.findOne({$or: [
            {email: req.body.username},
            {emailPersonal: req.body.username}
    ]}).exec(function(err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: "Profile not found"
            });
        }
        if (!profile.emailVerified) {
            return res.status(401).json({
                message: "Email for this account is not verified yet."
            })
        }
        cbFunc();
    });
}

/*
    POST /auth/logout. Deletes the access token.
 */
exports.logout = function (req, res) {
    AccessToken.findOneAndDelete({accessToken: res.locals.oauth.token.accessToken}, function(err, result) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        return res.status(200).json({
            message: "Logged out"
        })
    })

}

exports.register = function (req, res) {
    Profile.findOne({email: req.body.email}, function(err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (profile !== null && profile.password !== undefined) {
            return res.status(409).json({
                message: "Email already registered. Please login using your email and password"
            });
        }
        if (profile !== null && profile.password === undefined) {
            return res.status(401).json({
                message: "Set up password please. Go to route /api/auth/set-password"
            });
        }
        if (!profile) {
            return res.status(300).json({
                message: "Redirect to route /api/auth/register/new"
            });
        }
    });
}

exports.registerNew = function (req, res) {
    Profile.findOne({email: req.body.email}, async function(err, _profile) {
        if (err) {
            return res.status(400).json({
                message: err.message,
            });
        }
        if (_profile) {
            return res.status(409).json({
                message: "Email already registered. Please login /auth/login or set password /auth/set-password."
            });
        }
        if (!req.body.password) {
            return res.status(400).json({
                message: "Password required."
            })
        }

        let profile = new Profile(req.body);

        try {
            await profile.setPassword(req.body.password);
            await profile.save();
        } catch (err) {
            return res.status(500).json({
                message: err.message
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
            message: "Email is not a valid UK university email address."
        })
    }
    Profile.findOne({email: req.body.email}, async function(err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: "Profile not found"
            });
        }
        if (profile.password) {
            return res.status(409).json({
                message: "Account had already been registered. Please login using your email and password",
            });
        }
        if (!profile.password) {
            if(!req.body.password) {
                return res.status(400).json({
                    message: "New password required."
                })
            }
            try {
                await profile.setPassword(req.body.password);
                await profile.save();
            } catch (err) {
                return res.status(500).json({
                    message: err.message
                });
            }

            await sendVerificationEmail(profile, req, res);
        }
    })
}

/*
    POST /auth/resend-verification. Resends verification email with the token.
    Email must be a valid UK university email address (ends with 'ac.uk').
 */
exports.resendVerificationEmail = function (req, res) {
    if (!req.body.email.endsWith('ac.uk')) {
        return res.status(400).json({
            message: "Email is not a valid UK university email address."
        })
    }
    Profile.findOne({email: req.body.email}, async function(err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (!profile) {
            return res.status(404).json({
                message: "Profile not found"
            });
        }
        if (profile.emailVerified) {
            return res.status(400).json({
                message: "Account had already been verified by email. Please login using your email and password",
            });
        }
        await sendVerificationEmail(profile, req, res);
    })
}

/*
    GET /auth/verify-email/:token
    Verifies the email. emailVerified field changes to true.
 */
exports.verifyEmail = function (req, res) {
    if(!req.params.token) {
        return res.status(400).json({
            message: "Please include token"
        })
    }

    Token.findOne({token: req.params.token}, async function(err, token)  {
        try {
            if(!token) {
                return res.status(404).json({
                    message: "Valid token is not found. Your token may be expired."
                })
            }

            let profile = await Profile.findOne({ _id: token.userId});
            if (!profile) {
                return res.status(404).json({
                    message: "Profile for this token is not found."
                })
            }

            if (profile.emailVerified) {
                return res.status(400).json({
                    message: "Account had already been verified. Please log in."
                })
            }

            profile.emailVerified = true;
            await profile.save();
            return res.status(200).json({
                message: "This account is now verified. Please log in."
            })

        } catch (err) {
            return res.status(500).json({
                message: err.message
            })
        }
    });
}

//TODO: Add Password reset

async function sendVerificationEmail(profile, req, res) {
    try {
        const token = profile.generateVerificationToken();

        await token.save();
        //TODO: add email stuffs here

        let link = "/api/auth/verify/" + token.token;

        return res.status(201).json({
            message: "Account registered. A verification email has been sent to " + profile.email + "."
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message
        })
    }
}