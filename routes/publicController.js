const mongoose = require('mongoose');

const Profile = mongoose.model('Profile');

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
        if (err)
            res.status(500).json({
                message: err.message,
            });

        res.status(200).json({
            message: 'Member summary (branch) returned',
            data: docs,
        });
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
        if (err)
            res.status(500).json({
                message: err.message,
            });

        res.status(200).json({
            message: 'Member summary (uni) returned',
            data: docs,
        });
    });
};
