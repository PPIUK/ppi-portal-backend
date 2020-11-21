Profile = require('../profileModel');
Token = require('./tokenModel');

exports.login = function (req, res, cbFunc) {
    Profile.findOne({email: req.body.username}, function(err, profile) {
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

exports.setPassword = function (req, res) {
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
        if (profile && profile.password) {
            return res.status(409).json({
                message: "Account has already been registered. Please login using your email and password",
            });
        }
        if (profile && !profile.password) {
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

exports.resendVerificationEmail = function (res, req) {
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
                message: "Account has already been verified by email. Please login using your email and password",
            });
        }
        await sendVerificationEmail(profile, req, res);
    })
}

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


//TODO: add resend verification token

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