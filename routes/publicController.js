const mongoose = require('mongoose');

const Profile = mongoose.model('Profile');

const logger = require('../config/winston');

exports.memberSummaryBranch = function (req, res) {
    Profile.aggregate([
        {
            $group: {
                _id: {
                    branch: '$branch',
                },
                count: {
                    $sum: 1,
                },
            },
        },
    ]).exec((err, docs) => {
        if (err) {
            logger.error(
                `${
                    req.path
                } : Error retrieving public member summary by branch: ${JSON.stringify(
                    err
                )}`
            );
            res.status(500).json({
                message: err.message,
            });
        }

        res.status(200).json({
            message: 'Member summary (branch) returned',
            data: docs,
        });
    });
};

exports.memberSummaryActive = function (req, res) {
    Profile.find()
        .where('endDate')
        .gte(new Date())
        .then((profiles) => res.json({ count: profiles.length }))
        .catch((err) => {
            logger.error(
                `${
                    req.path
                } : Error retrieving public member summary by active: ${JSON.stringify(
                    err
                )}`
            );
        });
};

exports.memberSummaryUni = function (req, res) {
    Profile.aggregate([
        {
            $group: {
                _id: {
                    university: '$university',
                },
                count: {
                    $sum: 1,
                },
            },
        },
    ]).exec((err, docs) => {
        if (err) {
            logger.error(
                `${
                    req.path
                } : Error retrieving public member summary by uni: ${JSON.stringify(
                    err
                )}`
            );
            res.status(500).json({
                message: err.message,
            });
        }

        res.status(200).json({
            message: 'Member summary (uni) returned',
            data: docs,
        });
    });
};
