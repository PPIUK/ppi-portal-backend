const mongoose = require('mongoose');
const Profile = mongoose.model('Profile');

const ac = require(global.appRoot + '/config/roles');

exports.pending = function (req, res) {
    let query = Profile.find();

    // get all non verified users with the same branch as requestee
    query.where('branch').equals(req.user.branch);
    query.nin('roles', 'verified');

    query.exec().then((err, val) => {
        if (err)
            return res.status(500).json({
                message: 'Server error',
            });
        return res.status(200).json({
            profiles: val,
        });
    });
};

exports.flagged = function (req, res) {
    let query = Profile.find();

    // get all flagged users with the same branch as requestee
    query.where('branch').equals(req.user.branch);
    query.in('roles', 'flagged');

    query.exec().then((err, val) => {
        if (err)
            return res.status(500).json({
                message: 'Server error',
            });
        return res.status(200).json({
            profiles: val,
        });
    });
};

exports.action = function (req, res) {};

exports.delete = function (req, res) {};

/**
 * Find permission for the requested action and role
 * @param action
 */
exports.grantAccess = function (action) {
    return async (req, res, next) => {
        const permission = ac
            .can(res.locals.oauth.token.user.roles)
            [action]('profile');
        if (!permission.granted) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }
        req.permission = permission;
        return next();
    };
};
