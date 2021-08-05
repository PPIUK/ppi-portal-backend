const mongoose = require('mongoose');
const Profile = mongoose.model('Profile');

const ac = require(global.appRoot + '/config/roles');

exports.pending = function (req, res) {
    let query = Profile.find();

    // get all non verified users with the same branch as requestee
    if (res.locals.oauth.token.user.branch !== 'All')
        query.where('branch').equals(res.locals.oauth.token.user.branch);
    query.nin('roles', 'verified');
    query.nin('roles', 'flagged');

    query.exec().then((val) =>
        res.status(200).json({
            profiles: val,
        })
    );
};

exports.flagged = function (req, res) {
    let query = Profile.find();

    // get all flagged users with the same branch as requestee
    if (res.locals.oauth.token.user.branch !== 'All')
        query.where('branch').equals(res.locals.oauth.token.user.branch);
    query.in('roles', 'flagged');

    query.exec().then((val) =>
        res.status(200).json({
            profiles: val,
        })
    );
};

exports.action = function (req, res) {
    if (!['verified', 'flagged'].includes(req.body.action))
        return res.status(400).json({
            message: 'Invalid action',
        });

    Profile.findOne({ _id: req.params.userID })
        .where('branch')
        .equals(
            res.locals.oauth.token.user.branch !== 'All'
                ? res.locals.oauth.token.user.branch
                : /.*/g
        )
        .exec()
        .then((profile) => {
            if (profile.roles.includes(req.body.action))
                return res.sendStatus(201);
            profile.roles.push(req.body.action);
            profile
                .save()
                .then(() => res.sendStatus(201))
                .catch(() => res.status(500).json({ message: 'Server erro' }));
        });
};

exports.delete = function (req, res) {
    Profile.findOne({ _id: req.params.userID })
        .where('branch')
        .equals(
            res.locals.oauth.token.user.branch !== 'All'
                ? res.locals.oauth.token.user.branch
                : /.*/g
        )
        .exec()
        .then((err, profile) => {
            console.error(err);
            if (err)
                return res.status(500).json({
                    message: 'Server error',
                });
            if (!profile.roles.includes('flagged'))
                return res.status(400).json({
                    message: 'Cannot delete, not flagged',
                });
            profile.remove().then(() => res.sendStatus(201));
        });
};

/**
 * Find permission for the requested action and role
 * @param action
 */
exports.grantAccess = function (action) {
    return async (req, res, next) => {
        const permission = ac
            .can(res.locals.oauth.token.user.roles)
            [action]('profile');
        if (
            !permission.granted ||
            !res.locals.oauth.token.user.roles.includes('verifier')
        ) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }
        req.permission = permission;
        return next();
    };
};
