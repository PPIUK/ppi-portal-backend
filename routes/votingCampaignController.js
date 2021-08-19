const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');

const VotingCandidate = mongoose.model('VotingCandidate');
const VotingCampaign = mongoose.model('VotingCampaign');
const Profile = mongoose.model('Profile');
const ac = require(global.appRoot + '/config/roles');

const utils = require('./utils');

const campaignBannerStorage = new GridFsStorage({
    url: process.env.DBURL,
    file: (req, file) => {
        return new Promise((resolve) => {
            const filename = file.originalname;
            const fileInfo = {
                filename: filename,
                bucketName: 'campaignbanners',
            };
            resolve(fileInfo);
        });
    },
});

const campaignBannerUpload = multer({
    storage: campaignBannerStorage,
}).single('campaignBannerFile');

const candidateFilesStorage = new GridFsStorage({
    url: process.env.DBURL,
    file: (req, file) => {
        return new Promise((resolve) => {
            const filename = file.originalname;
            const fileInfo = {
                filename: filename,
                bucketName: 'campaigncandidatefiles',
            };
            resolve(fileInfo);
        });
    },
});

const candidateFilesUpload = multer({
    storage: candidateFilesStorage,
}).fields([
    { name: 'cv', maxCount: 1 },
    { name: 'organisationExp', maxCount: 1 },
    { name: 'notInOfficeStatement', maxCount: 1 },
    { name: 'motivationEssay', maxCount: 1 },
]);

/**
 * Gets active campaigns, which could be in nomination phase or voting phase.
 * Voting results are excluded from the response.
 * @name GET_/api/voting/active
 * @return res.body.data is list of active campaigns
 */
exports.active = function (req, res) {
    let now = new Date();
    VotingCampaign.find(
        {
            nominateStart: { $lte: now },
            voteEnd: { $gt: now },
        },
        { 'candidates.votes': 0 }
    )
        .then((campaigns) => {
            return res.status(200).json({
                message: 'Active campaigns returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            return res.status(500).json({
                message: err.message,
            });
        });
};

/**
 * Gets active campaigns which are in nomination phase.
 * Voting results are excluded from the response.
 * @name GET_/api/voting/active/nominate
 * @return res.body.data is list of active campaigns
 */
exports.activeNominate = function (req, res) {
    let now = new Date();
    VotingCampaign.find(
        {
            nominateStart: { $lte: now },
            nominateEnd: { $gt: now },
        },
        { 'candidates.votes': 0 }
    )
        .then((campaigns) => {
            return res.status(200).json({
                message:
                    'Active campaigns in nomination phase returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            return res.status(500).json({
                message: err.message,
            });
        });
};

/**
 * Gets active campaigns which are in voting phase.
 * Voting results are excluded from the response.
 * @name GET_/api/voting/active/vote
 * @return res.body.data is list of active campaigns
 */
exports.activeVote = function (req, res) {
    let now = new Date();
    VotingCampaign.find(
        {
            voteStart: { $lte: now },
            voteEnd: { $gt: now },
        },
        { 'candidates.votes': 0 }
    )
        .then((campaigns) => {
            return res.status(200).json({
                message:
                    'Active campaigns in vote phase returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            return res.status(500).json({
                message: err.message,
            });
        });
};

/**
 * Creates a new voting campaign.
 * This can only be called by voteOrganiser role.
 * See votingCampaignModel.js to see accepted fields.
 * @name POST_/api/voting/admin
 * @param req.body.campaignBannerFile is a file
 * @return res.body.id is the campaign id.
 */
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

/**
 * Updates the specified voting campaign.
 * This can only be called by voteOrganiser role.
 * See votingCampaignModel.js to see accepted fields.
 * @name PATCH_/api/voting/admin/:campaignID
 * @param req.params.campaignID is the campaign ID to be updated
 * @param req.body.campaignBannerFile is a file
 * @return res.body.id is the campaign id.
 */
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
                        message: 'Campaign with that ID is not found',
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

/**
 * Deletes the specified voting campaign.
 * This can only be called by voteOrganiser role.
 * The associated banner file will also be deleted.
 * @name DELETE_/api/voting/admin/:campaignID
 * @param req.params.campaignID is the campaign ID to be deleted
 */
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

        VotingCampaign.findByIdAndRemove(campaign._id, (err) => {
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
 * View information about the specified voting campaign, including the list of candidates.
 * The list of voters for each candidate is not included, for now.  TODO: change this to return statistics instead
 * Fields that are supposed to be a file are returned as the ID of the file, where the file itself can be retrieved
 * using the respective view endpoints.
 * @name GET_/api/voting/:campaignID
 * @param req.params.campaignID is the campaign ID to be viewed
 * @return res.body.data is the campaign object.
 */
exports.view = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { 'candidates.votes': 0 },
        function (err, campaign) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            return res.status(200).json({
                message: 'Campaign returned.',
                data: campaign,
            });
        }
    );
};

/**
 * Downloads banner file of the specified campaign.
 * @name GET_/api/voting/:campaignID/banner
 * @param req.params.campaignID is the campaign ID of the banner
 */
exports.viewCampaignBanner = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { banner: 1 },
        (err, campaign) => {
            utils.sendFile('banner', 'campaignbanners', campaign, err, res);
        }
    );
};

/**
 * Nominates self as a candidate for the specified campaign.
 * See votingCampaignModel.js to see accepted fields.
 * Caller can only nominate themselves, not anyone else.
 * @name POST_/api/voting/:campaignID/submission
 * @param req.params.campaignID is the campaign ID for the nomination submission
 * @param req.body.cv is a file
 * @param req.body.organisationExp is a file
 * @param req.body.notInOfficeStatement is a file
 * @param req.body.motivationEssay is a file
 */
exports.newNomination = function (req, res) {
    candidateFilesUpload(req, res, async function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }
        if (!req.body.candidateID) {
            return res.status(400).json({
                message: 'candidateID is required.',
            });
        }
        if (req.body.candidateID !== String(res.locals.oauth.token.user._id)) {
            return res.status(403).json({
                message: 'You are not allowed to nominate other person.',
            });
        }
        let candidate = new VotingCandidate(req.body);

        if (req.files) {
            if ('cv' in req.files) {
                candidate.cv = mongoose.Types.ObjectId(req.files['cv'][0].id);
            }
            if ('organisationExp' in req.files) {
                candidate.organisationExp = mongoose.Types.ObjectId(
                    req.files['organisationExp'][0].id
                );
            }
            if ('notInOfficeStatement' in req.files) {
                candidate.notInOfficeStatement = mongoose.Types.ObjectId(
                    req.files['notInOfficeStatement'][0].id
                );
            }
            if ('motivationEssay' in req.files) {
                candidate.motivationEssay = mongoose.Types.ObjectId(
                    req.files['motivationEssay'][0].id
                );
            }
        }

        VotingCampaign.findOne(
            {
                _id: req.params.campaignID,
            },
            function (err, campaign) {
                if (err) {
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                let candidateExists = campaign.candidates.find(
                    ({ candidateID }) =>
                        String(candidateID) === req.body.candidateID
                );
                if (candidateExists) {
                    return res.status(409).json({
                        message: 'Candidate already exists in this campaign.',
                    });
                }
                let current = new Date();
                if (current < new Date(campaign.nominateStart)) {
                    return res.status(404).json({
                        message: 'The nomination phase has not started.',
                    });
                }
                if (current > new Date(campaign.nominateEnd)) {
                    return res.status(404).json({
                        message: 'The nomination phase has ended.',
                    });
                }

                VotingCampaign.findByIdAndUpdate(
                    req.params.campaignID,
                    {
                        $push: { candidates: candidate },
                    },
                    { useFindAndModify: false },
                    function (err, campaign) {
                        if (err) {
                            return res.status(400).json({
                                message: err.message,
                            });
                        }
                        if (!campaign) {
                            return res.status(404).json({
                                message: 'Campaign ID does not exist.',
                            });
                        }
                        return res.status(200).json({
                            message: 'Voting candidate submitted.',
                            candidateId: candidate.candidateID,
                        });
                    }
                );
            }
        );
    });
};

/**
 * Updates self nomination as a candidate for the specified campaign.
 * See votingCampaignModel.js to see accepted fields.
 * Caller can only update their own nomination, not anyone else.
 * @name PATCH_/api/voting/:campaignID/submission
 * @param req.params.campaignID is the campaign ID for the nomination submission
 * @param req.body.cv is a file
 * @param req.body.organisationExp is a file
 * @param req.body.notInOfficeStatement is a file
 * @param req.body.motivationEssay is a file
 */
exports.updateNomination = function (req, res) {
    candidateFilesUpload(req, res, function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }

        if (
            req.body.candidateID &&
            req.body.candidateID !== String(res.locals.oauth.token.user._id)
        ) {
            return res.status(403).json({
                message:
                    'You cannot change the candidate to another person than yourself.',
            });
        }

        let updateQuery = {};
        let toBeDeleted = [];

        if (req.files) {
            if ('cv' in req.files) {
                updateQuery['candidates.$.cv'] = mongoose.Types.ObjectId(
                    req.files['cv'][0].id
                );
                toBeDeleted.push('cv');
            }
            if ('organisationExp' in req.files) {
                updateQuery[
                    'candidates.$.organisationExp'
                ] = mongoose.Types.ObjectId(req.files['organisationExp'][0].id);
                toBeDeleted.push('organisationExp');
            }
            if ('notInOfficeStatement' in req.files) {
                updateQuery[
                    'candidates.$.notInOfficeStatement'
                ] = mongoose.Types.ObjectId(
                    req.files['notInOfficeStatement'][0].id
                );
                toBeDeleted.push('notInOfficeStatement');
            }
            if ('motivationEssay' in req.files) {
                updateQuery[
                    'candidates.$.motivationEssay'
                ] = mongoose.Types.ObjectId(req.files['motivationEssay'][0].id);
                toBeDeleted.push('motivationEssay');
            }
        }

        if (req.body.videoLink) {
            updateQuery['candidates.$.videoLink'] = req.body.videoLink;
        }

        VotingCampaign.findById(
            req.params.campaignID,
            { nominateStart: 1, nominateEnd: 1 },
            function (err, campaign) {
                if (err) {
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                if (!campaign) {
                    return res.status(404).json({
                        message: 'Invalid campaign ID.',
                    });
                }
                let current = new Date();
                if (current < new Date(campaign.nominateStart)) {
                    return res.status(404).json({
                        message: 'The nomination phase has not started.',
                    });
                }
                if (current > new Date(campaign.nominateEnd)) {
                    return res.status(404).json({
                        message: 'The nomination phase has ended.',
                    });
                }

                VotingCampaign.findOneAndUpdate(
                    {
                        _id: req.params.campaignID,
                        'candidates.candidateID': String(
                            res.locals.oauth.token.user._id
                        ),
                    },
                    { $set: updateQuery },
                    { useFindAndModify: false },
                    function (err, campaign) {
                        if (err) {
                            return res.status(500).json({
                                message: err.message,
                            });
                        }
                        if (!campaign) {
                            return res.status(404).json({
                                message:
                                    'Candidate does not exist in the campaign or invalid campaign ID.',
                            });
                        }

                        const bucket = new mongoose.mongo.GridFSBucket(
                            mongoose.connection.db,
                            {
                                bucketName: 'campaigncandidatefiles',
                            }
                        );

                        let candidate = campaign.candidates.find(
                            ({ candidateID }) =>
                                String(candidateID) ===
                                String(res.locals.oauth.token.user._id)
                        );

                        let deleteError;
                        toBeDeleted.forEach((aFile) => {
                            bucket.delete(
                                new mongoose.Types.ObjectId(candidate[aFile]),
                                async (err) => {
                                    if (err) {
                                        deleteError = err;
                                    }
                                }
                            );
                        });

                        if (deleteError) {
                            return res.status(500).json({
                                message: deleteError.message,
                            });
                        }

                        return res.status(200).json({
                            message: 'Voting candidate updated.',
                            candidateId: res.locals.oauth.token.user._id,
                        });
                    }
                );
            }
        );
    });
};

/**
 * View nomination of the specified candidate of the specified campaign.
 * The list of voters is not included, for now.  TODO: change this to return statistics instead
 * Fields that are supposed to be a file are returned as the ID of the file, where the file itself can be retrieved
 * using the respective view endpoints.
 * @name GET_/api/voting/:campaignID/submission/:userID
 * @param req.params.campaignID is the campaign ID
 * @param req.params.userID is the candidate ID
 * @return res.body.data is the candidate information
 */
exports.viewNomination = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { 'candidates.votes': 0 },
        (err, campaign) => {
            if (err) {
                return res.status(400).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Invalid campaign ID.',
                });
            }
            if (campaign.candidates.length === 0) {
                return res.status(404).json({
                    message: 'There is no candidate yet for this campaign ID.',
                });
            }
            let candidate = campaign.candidates.find(
                ({ candidateID }) => String(candidateID) === req.params.userID
            );
            if (!candidate) {
                return res.status(404).json({
                    message: 'Candidate ID not found in this campaign.',
                });
            }
            return res.status(200).json({
                message: 'Candidate returned.',
                data: candidate,
            });
        }
    );
};

/**
 * View own nomination of the specified campaign, if available.
 * The list of voters is not included, for now.  TODO: change this to return statistics instead
 * Fields that are supposed to be a file are returned as the ID of the file, where the file itself can be retrieved
 * using the respective view endpoints.
 * @name GET_/api/voting/:campaignID/submission
 * @param req.params.campaignID is the campaign ID
 * @return res.body.data is the candidate information
 */
exports.viewSelfNomination = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { 'candidates.votes': 0 },
        (err, campaign) => {
            if (err) {
                return res.status(400).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Invalid campaign ID.',
                });
            }
            if (campaign.candidates.length === 0) {
                return res.status(404).json({
                    message: 'You have not nominated yourself in this campaign',
                });
            }
            let candidate = campaign.candidates.find(
                ({ candidateID }) =>
                    String(candidateID) ===
                    String(res.locals.oauth.token.user._id)
            );
            if (!candidate) {
                return res.status(404).json({
                    message: 'You have not nominated yourself in this campaign',
                });
            }
            return res.status(200).json({
                message: 'Candidate returned.',
                data: candidate,
            });
        }
    );
};

/**
 * Downloads CV of the specified candidate in the specified campaign.
 * @name GET_/api/voting/:campaignID/submission/:userID/cv
 * @param req.params.campaignID is the campaign ID of the banner
 * @param req.params.userID is the candidate ID
 */
exports.viewCV = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { candidates: 1 },
        (err, campaign) => {
            findCandidateAndSendFile(
                err,
                campaign,
                req,
                res,
                'cv',
                'campaigncandidatefiles'
            );
        }
    );
};

function findCandidateAndSendFile(
    err,
    campaign,
    req,
    res,
    fileType,
    bucketName
) {
    if (err) {
        return res.status(500).json({
            message: err.message,
        });
    }
    if (!campaign) {
        return res.status(404).json({
            message: 'Invalid campaign ID.',
        });
    }
    if (campaign.candidates.length === 0) {
        return res.status(404).json({
            message: 'There is no candidate yet for this campaign ID.',
        });
    }
    let candidate = campaign.candidates.find(
        ({ candidateID }) => String(candidateID) === req.params.userID
    );
    if (!candidate) {
        return res.status(404).json({
            message: 'Candidate ID not found in this campaign.',
        });
    }
    utils.sendFile(fileType, bucketName, candidate, err, res);
}

/**
 * Downloads organisation experience statement of the specified candidate in the specified campaign.
 * @name GET_/api/voting/:campaignID/submission/:userID/organisationExp
 * @param req.params.campaignID is the campaign ID of the banner
 * @param req.params.userID is the candidate ID
 */
exports.viewOrganisationExp = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { candidates: 1 },
        (err, campaign) => {
            findCandidateAndSendFile(
                err,
                campaign,
                req,
                res,
                'organisationExp',
                'campaigncandidatefiles'
            );
        }
    );
};

/**
 * Downloads currently not in office statement of the specified candidate in the specified campaign.
 * @name GET_/api/voting/:campaignID/submission/:userID/notInOfficeStatement
 * @param req.params.campaignID is the campaign ID of the banner
 * @param req.params.userID is the candidate ID
 */
exports.viewNotInOfficeStatement = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { candidates: 1 },
        (err, campaign) => {
            findCandidateAndSendFile(
                err,
                campaign,
                req,
                res,
                'notInOfficeStatement',
                'campaigncandidatefiles'
            );
        }
    );
};

/**
 * Downloads motivation essay of the specified candidate in the specified campaign.
 * @name GET_/api/voting/:campaignID/submission/:userID/motivationEssay
 * @param req.params.campaignID is the campaign ID of the banner
 * @param req.params.userID is the candidate ID
 */
exports.viewMotivationEssay = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { candidates: 1 },
        (err, campaign) => {
            findCandidateAndSendFile(
                err,
                campaign,
                req,
                res,
                'motivationEssay',
                'campaigncandidatefiles'
            );
        }
    );
};

/**
 * Checks if caller is eligible to vote in the specified campaign.
 * @name POST_/api/voting/:campaignID/eligibility
 * @param req.params.campaignID is the campaign ID
 * @return res.body.data is true or false
 */
exports.eligibility = async function (req, res) {
    let voterId = String(res.locals.oauth.token.user._id);
    let profile = await Profile.findById(voterId, {
        roles: 1,
        startDate: 1,
        endDate: 1,
        degreeLevel: 1,
    });
    if (!profile) {
        return res.status(404).json({
            message: 'Your profile is not found.',
        });
    }
    if (!profile.roles.includes('verified')) {
        return res.status(200).json({
            data: false,
        });
    }

    let campaign = await VotingCampaign.findById(req.params.campaignID);
    if (!campaign) {
        return res.status(404).json({
            message: 'Campaign is not found',
        });
    }

    if (profile.endDate < campaign.voterCutOffEndDate) {
        return res.status(200).json({
            data: false,
        });
    }
    if (
        //TODO: how to decide if the Masters course is a 1 year course or not???
        profile.degreeLevel.includes('S2') &&
        !profile.degreeLevel.includes('S1') && //skipping integrated masters
        campaign.voterMastersCutOffStartDate &&
        profile.startDate < campaign.voterMastersCutOffStartDate
    ) {
        return res.status(200).json({
            data: false,
        });
    }

    return res.status(200).json({
        data: true,
    });
};

/**
 * Checks if caller has voted in the specified campaign.
 * @name POST_/api/voting/:campaignID/hasVoted
 * @param req.params.campaignID is the campaign ID
 * @return res.body.data is true or false
 */
exports.hasVoted = function (req, res) {
    let voterId = String(res.locals.oauth.token.user._id);
    VotingCampaign.findById(
        req.params.campaignID,
        { candidates: 1 },
        (err, campaign) => {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            let all_voters = [].concat.apply(
                [],
                campaign.candidates.map((cand) => {
                    return cand.votes;
                })
            );
            if (all_voters.some((v) => v.toString() === voterId)) {
                return res.status(200).json({
                    data: true,
                });
            }
            return res.status(200).json({
                data: false,
            });
        }
    );
};

/**
 * Votes for the specified candidate in the specified campaign.
 * @name POST_/api/voting/:campaignID/vote/:userID
 * @param req.params.campaignID is the campaign ID
 * @param req.params.userID is the candidate ID
 */
exports.vote = async function (req, res) {
    try {
        let voterId = String(res.locals.oauth.token.user._id);
        let profile = await Profile.findById(voterId, {
            roles: 1,
            startDate: 1,
            endDate: 1,
            degreeLevel: 1,
        });

        if (!profile) {
            return res.status(404).json({
                message: 'Your profile is not found.',
            });
        }
        if (!profile.roles.includes('verified')) {
            return res.status(403).json({
                message: 'Your profile is not verified.',
            });
        }

        let campaign = await VotingCampaign.findById(req.params.campaignID);

        if (!campaign) {
            return res.status(404).json({
                message: 'Campaign is not found',
            });
        }
        let current = new Date();
        if (current < new Date(campaign.voteStart)) {
            return res.status(403).json({
                message: 'The voting phase has not started.',
            });
        }
        if (current > new Date(campaign.voteEnd)) {
            return res.status(403).json({
                message: 'The voting phase has ended.',
            });
        }
        if (profile.endDate < campaign.voterCutOffEndDate) {
            return res.status(403).json({
                message:
                    'You are not eligible to vote due to your course end date.',
            });
        }
        if (
            //TODO: how to decide if the Masters course is a 1 year course or not???
            profile.degreeLevel.includes('S2') &&
            !profile.degreeLevel.includes('S1') && //skipping integrated masters
            campaign.voterMastersCutOffStartDate &&
            profile.startDate < campaign.voterMastersCutOffStartDate
        ) {
            return res.status(403).json({
                message:
                    'You are not eligible to vote due to your course start date.',
            });
        }
        let all_voters = [].concat.apply(
            [],
            campaign.candidates.map((cand) => {
                return cand.votes;
            })
        );
        if (all_voters.some((v) => v.toString() === voterId)) {
            return res.status(400).json({
                message: 'You have already voted in this campaign',
            });
        }
        let candidate = campaign.candidates.find(
            ({ candidateID }) => String(candidateID) === req.params.userID
        );
        let candidateIndex = campaign.candidates.findIndex(
            ({ candidateID }) => String(candidateID) === req.params.userID
        );
        if (!candidate) {
            return res.status(404).json({
                message: 'Candidate ID not found in this campaign.',
            });
        }
        if (candidate.votes.includes(voterId)) {
            return res.status(400).json({
                message: 'You have already voted in this campaign',
            });
        }
        candidate.votes.push(mongoose.Types.ObjectId(voterId));
        campaign.candidates[candidateIndex] = candidate;

        let savedCampaign = await campaign.save();
        if (savedCampaign) {
            return res.status(200).json({
                message: 'Voting successful.',
            });
        }
    } catch (err) {
        return res.status(500).json({
            message: err.message,
        });
    }
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
