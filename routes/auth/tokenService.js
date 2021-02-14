const mongoose = require('mongoose');

const Profile = mongoose.model('Profile');
const AccessToken = mongoose.model('AccessToken');
const RefreshToken = mongoose.model('RefreshToken');
const AuthorizationCode = mongoose.model('AuthorizationCode');
const Client = mongoose.model('Client');

const model = {
    getClient: function (clientId, clientSecret, cbFunc) {
        if (clientId == 'api') {
            const client = {
                clientId,
                grants: ['password', 'refresh_token'],
                redirectUris: null,
            };
            cbFunc(false, client);
        } else {
            Client.findOne({ clientId: clientId }, function (err, aClient) {
                if (clientSecret && clientSecret !== aClient.clientSecret) {
                    cbFunc(false, null);
                } else {
                    const client = {
                        clientId: aClient.clientId,
                        grants: aClient.grants,
                        redirectUris: aClient.redirectUris,
                    }
                    cbFunc(false, client);
                }
            })
        }

    },

    getUser: function getUser(email, password, cbFunc) {
        Profile.findOne({ email: email }, async function (err, profile) {
            if (!profile) {
                return cbFunc(false, null);
            }
            const passwordTrue = await profile.validatePassword(password);
            if (!passwordTrue) {
                return cbFunc(false, null);
            }
            cbFunc(false, profile);
        });
    },

    saveAuthorizationCode: function (code, client, user, cbFunc) {
        let authorizationCode = new AuthorizationCode(code);
        authorizationCode.user = user._id;
        authorizationCode.client = client.clientId;
        authorizationCode.save(function (err) {
            if (err) {
                return cbFunc(false, null);
            }
        })
        cbFunc(false, {
            authorizationCode: authorizationCode.authorizationCode,
            expiresAt: authorizationCode.expiresAt,
            redirectUri: authorizationCode.redirectUri,
            scope: authorizationCode.scope,
            client: client.clientId,
            user: user,
        })
    },

    getAuthorizationCode: function (authorizationCode, cbFunc) {
        AuthorizationCode.findOne({ authorizationCode: authorizationCode })
            .populate('user')
            .exec(function (error, code) {
                if (!code) {
                    return cbFunc(false, null);
                }
                cbFunc(false, {
                    code: code.authorizationCode,
                    expiresAt: code.expiresAt,
                    redirectUri: code.redirectUri,
                    scope: code.scope,
                    client: code.client,
                    user: code.user,
                })
            })
    },

    saveToken: function (token, client, user, cbFunc) {
        let accessToken = new AccessToken(token);
        accessToken.user = user;
        accessToken.client = client.clientId;
        accessToken.save(function (err) {
            if (err) {
                return cbFunc(false, null);
            }
        });
        let refreshToken = new RefreshToken(token);
        refreshToken.user = user;
        refreshToken.client = client.clientId;
        refreshToken.save(function (err) {
            if (err) {
                return cbFunc(false, null);
            }
        });
        cbFunc(false, {
            accessToken: accessToken.accessToken,
            accessTokenExpiresAt: accessToken.accessTokenExpiresAt,
            refreshToken: refreshToken.refreshToken,
            refreshTokenExpiresAt: refreshToken.refreshTokenExpiresAt,
            client: client.clientId,
            user: user,
        });
    },

    getAccessToken: function (accessToken, cbFunc) {
        AccessToken.findOne({ accessToken: accessToken })
            .populate('user')
            .exec(function (error, token) {
                if (!token) {
                    return cbFunc(false, null);
                }
                cbFunc(false, {
                    accessToken: token.accessToken,
                    accessTokenExpiresAt: token.accessTokenExpiresAt,
                    user: token.user,
                    client: token.client,
                });
            });
    },

    getRefreshToken: function (refreshToken, cbFunc) {
        RefreshToken.findOne({ refreshToken: refreshToken })
            .populate('user')
            .exec(function (error, token) {
                if (!token) {
                    return cbFunc(false, null);
                }
                cbFunc(false, {
                    refreshToken: token.refreshToken,
                    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
                    user: token.user,
                    client: token.client,
                });
            });
    },

    revokeAuthorizationCode: function (code, cbFunc) {
        AuthorizationCode.findOneAndDelete(
            { authorizationCode: code.authorizationCode },
            function (error) {
                return cbFunc(false, !error);
            }
        )
    },

    revokeToken: function (token, cbFunc) {
        RefreshToken.findOneAndDelete(
            { refreshToken: token.refreshToken },
            function (error) {
                return cbFunc(false, !error);
            }
        );
    },
};
module.exports = model;
