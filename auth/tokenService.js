Profile = require('../profileModel');
AccessToken = require('./accessTokenModel');

const model = {
    getClient: function (clientId, clientSecret, cbFunc) {
        const client = {
            clientId,
            grants: ['password'],
            redirectUris: null
        };
        cbFunc(false, client);
    },

    getUser: function getUser(email, password, cbFunc) {
        Profile.findOne({email: email}, async function (err, profile) {
            if (!profile) {
                return cbFunc(false, null);
            }
            const passwordTrue = await profile.validatePassword(password);
            if(!passwordTrue) {
                return cbFunc(false, null);
            }
            cbFunc(false, profile);
        });
    },

    saveToken: function (token, client, user, cbFunc) {
        let accessToken = new AccessToken(token)
        accessToken.user = user;
        accessToken.client = client.clientId;
        accessToken.save(function (err, _accessToken) {
            if(err) {
                return cbFunc(false, null);
            }
            cbFunc(false, _accessToken);
        });
    },

    getAccessToken: function (accessToken, cbFunc) {
        AccessToken.findOne({accessToken: accessToken}).populate('user').exec( function(error, token) {
            if(!token) {
                return cbFunc(false, null);
            }
            cbFunc(false, {
                accessToken: token.accessToken,
                accessTokenExpiresAt: token.accessTokenExpiresAt,
                user: token.user
            });
        });
    }
}
module.exports = model;