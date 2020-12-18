const mongoose = require('mongoose');

const Profile = mongoose.model('Profile');
const AccessToken = mongoose.model('AccessToken');
const RefreshToken = mongoose.model('RefreshToken');

const model = {
    getClient: function (clientId, clientSecret, cbFunc) {
        const client = {
            clientId,
            grants: ['password', 'refresh_token'],
            redirectUris: null,
        };
        cbFunc(false, client);
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
