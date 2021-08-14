const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const crypto = require('crypto');
const path = require('path');
const AccessControl = require('accesscontrol');

const VotingCampaign = mongoose.model('VotingCampaign');
const Profile = mongoose.model('Profile');
const ac = require(global.appRoot + '/config/roles');

const campaignBannerStorage = new GridFsStorage({
    url: process.env.DBURL,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + '_' + file.originalname;
                const fileInfo = {
                    filename: filename,
                    bucketName: 'campaignbanners',
                };
                resolve(fileInfo);
            });
        });
    },
});

const campaignBannerUpload = multer({
    storage: campaignBannerStorage,
}).single('file');

exports.new = function (req, res) {
    campaignBannerUpload(req, res, async function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }

        let campaign = new VotingCampaign(req.body);

        if (req.file) {
            campaign.banner = mongoose.Types.ObjectId(req.file.id);
        }

        campaign.save(function (err) {
            if (err) {
                return res.status(400).json({
                    message: err.message,
                });
            }
            return res.status(200).json({
                message: 'New voting campaign created!',
                id: campaign._id,
            });
        });
    });
};

exports.update = function (req, res) {
    campaignBannerUpload(req, res, async function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }

        if (req.file) {
            req.body.banner = mongoose.Types.ObjectId(req.file.id);
        }
        VotingCampaign.findByIdAndUpdate(
            req.params.campaignID,
            req.body,
            { useFindAndModify: false },
            function (err, oldCampaign) {
                if (err) {
                    return res.status(400).json({
                        message: err.message,
                    });
                } else if (oldCampaign === null) {
                    return res.status(404).json({
                        message: 'Campaign with that voting ID is not found',
                    });
                } else {
                    return res.status(200).json({
                        message: 'Voting campaign updated!',
                        id: req.params.campaignID,
                    });
                }
            }
        );
    });
};

exports.delete = function (req, res) {
    VotingCampaign.findById(req.params.campaignID, (err, campaign) => {
        if (campaign === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Campaign ID not found',
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (campaign.banner) {
            const bucket = new mongoose.mongo.GridFSBucket(
                mongoose.connection.db,
                {
                    bucketName: 'campaignbanners',
                }
            );
            bucket.delete(
                new mongoose.Types.ObjectId(campaign.banner),
                (err) => {
                    if (err) {
                        if (err.message.startsWith('FileNotFound')) {
                            return res.status(404).json({
                                message: 'File not found',
                            });
                        }
                        return res.status(500).json({
                            message: err.message,
                        });
                    }
                }
            );
        }

        VotingCampaign.remove({ _id: campaign._id }, (err) => {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            return res.status(200).json({
                message: 'Voting campaign is deleted.',
            });
        });
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
            [action]('votingCampaign');
        if (
            !permission.granted ||
            !res.locals.oauth.token.user.roles.includes('voteOrganiser')
        ) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }
        req.permission = permission;
        return next();
    };
};
