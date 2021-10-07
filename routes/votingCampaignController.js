const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const dfd = require('danfojs-node');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VotingCandidate = mongoose.model('VotingCandidate');
const VotingRound = mongoose.model('VotingRound');
const VotingCampaign = mongoose.model('VotingCampaign');
const Profile = mongoose.model('Profile');
const ac = require(global.appRoot + '/config/roles');

const utils = require('./utils');
const mailTransporter = require(global.appRoot + '/config/nodemailer');

const logger = require('../config/winston');
const { logGeneralError } = require('../config/logging-tools')(logger);

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
 * @name GET_/api/voting
 */
exports.index = function (req, res) {
    VotingCampaign.find({}, { 'candidates.votes': 0 })
        .then((campaigns) => {
            return res.status(200).json({
                message: 'All campaigns returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            logGeneralError(req, err, 'Error retrieving campaigns');
            return res.status(500).json({
                message: err.message,
            });
        });
};

/**
 * Gets archived campaigns
 * Voting results are excluded from the response.
 * @name GET_/api/voting/archived
 * @return res.body.data is list of archived campaigns
 */
exports.archived = function (req, res) {
    let now = new Date();
    VotingCampaign.find(
        {
            $expr: { $lte: [{ $arrayElemAt: ['$voting.endDate', -1] }, now] },
        },
        { 'voting.votes': 0 }
    )
        .then((campaigns) => {
            return res.status(200).json({
                message: 'Archived campaigns returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            logGeneralError(req, err, 'Error retrieving archived campaigns');
            return res.status(500).json({
                message: err.message,
            });
        });
};

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
            $expr: { $gt: [{ $arrayElemAt: ['$voting.endDate', -1] }, now] },
        },
        { 'voting.votes': 0 }
    )
        .then((campaigns) => {
            return res.status(200).json({
                message: 'Active campaigns returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            logGeneralError(req, err, 'Error retrieving active campaigns');
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
        { 'voting.votes': 0 }
    )
        .then((campaigns) => {
            return res.status(200).json({
                message:
                    'Active campaigns in nomination phase returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            logGeneralError(
                req,
                err,
                'Error retrieving nomination phase campaigns'
            );
            return res.status(500).json({
                message: err.message,
            });
        });
};

/**
 * Gets active campaigns which are in voting phase.
 * Voting results are excluded from the response.
 * FIXME: faulty
 * @name GET_/api/voting/active/vote
 * @return res.body.data is list of active campaigns
 */
exports.activeVote = function (req, res) {
    let now = new Date();
    VotingCampaign.find(
        {
            $expr: {
                $gt: [{ $arrayElemAt: ['$voting.endDate', -1] }, now],
            },
            // eslint-disable-next-line no-dupe-keys
            $expr: {
                $lte: [{ $arrayElemAt: ['$voting.startDate', -1] }, now],
            },
        },
        { 'voting.votes': 0 }
    )
        .then((campaigns) => {
            return res.status(200).json({
                message:
                    'Active campaigns in vote phase returned successfully.',
                data: campaigns,
            });
        })
        .catch((err) => {
            logGeneralError(
                req,
                err,
                'Error retrieving voting phase campaigns'
            );
            return res.status(500).json({
                message: err.message,
            });
        });
};

/**
 * Checks if the election campaign is in voting phase or not
 * @name GET_/api/voting/:campaignID/isActiveVote
 * @return res.body.data is true or false, whether election is in voting phase or not
 */
exports.isActiveVote = function (req, res) {
    let now = new Date();
    VotingCampaign.findById(
        req.params.campaignID,
        { 'voting.startDate': 1, 'voting.endDate': 1 },
        function (err, campaign) {
            if (err) {
                logGeneralError(
                    req,
                    err,
                    `Error checking if election is active in vote phase`
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Campaign not found',
                });
            }

            let isActive;
            for (let round of campaign.voting) {
                if (now >= round.startDate && now < round.endDate) {
                    isActive = true;
                    break;
                }
            }
            if (isActive !== true) {
                isActive = false;
            }

            return res.status(200).json({
                message: 'Campaign is active voting status returned.',
                data: isActive,
            });
        }
    );
};

/**
 * Gets election public info (whether it is active or not and the voting start and end dates)
 * @name GET_/api/voting/pubinfo/:id
 * @return res.body.data the election public info
 */
exports.publicInfo = function (req, res) {
    VotingCampaign.findById(
        req.params.id,
        {
            activeOverride: 1,
            'voting.startDate': 1,
            'voting.endDate': 1,
            'voting.candidates': 1,
        },
        function (err, campaign) {
            if (err) {
                logGeneralError(
                    req,
                    err,
                    `Error retrieving campaign public info.`
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Campaign not found',
                });
            }
            return res.status(200).json({
                message: 'Campaign public info is returned.',
                data: campaign,
            });
        }
    );
};

exports.votersStatistics = async function (req, res) {
    VotingCampaign.findById(
        req.params.id,
        {
            activeOverride: 1,
            voting: 1,
            voterCutOffEndDate: 1,
            voterMastersCutOffStartDate: 1,
        },
        async function (err, campaign) {
            if (err) {
                logGeneralError(req, err, `Error retrieving voter statistics`);
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Campaign not found',
                });
            }

            let statistics = [];
            for (let [i, round] of campaign.voting.entries()) {
                let roundStatistics = {};
                if (campaign.activeOverride) {
                    roundStatistics.overall = getOverallVotersCount(round);
                }
                let aggregationPipeline = getEligibleListPipeline(campaign, i);

                const eligibleVoters = await Profile.aggregate(
                    aggregationPipeline
                );
                roundStatistics.votersCount = [
                    { name: 'has voted', value: round.votes.size },
                    {
                        name: 'has not voted',
                        value: eligibleVoters.length - round.votes.size,
                    },
                ];

                const voterIds = Array.from(round.votes.keys()).map((id) =>
                    mongoose.Types.ObjectId(id)
                );
                let profiles = await Profile.find(
                    {
                        _id: { $in: voterIds },
                    },
                    { _id: 1, branch: 1, degreeLevel: 1 }
                );

                roundStatistics.branchesCount = getVoterPropertyStatisticsArray(
                    profiles,
                    'branch'
                );

                roundStatistics.degreeLevelCount = getVoterPropertyStatisticsArray(
                    profiles,
                    'degreeLevel'
                );

                const eligibleVotersBranch = eligibleVoters.map((profile) => {
                    return profile.branch;
                });

                const eligibleVotersBranchCount = eligibleVotersBranch.reduce(
                    (total, value) => {
                        total[value] = (total[value] || 0) + 1;
                        return total;
                    },
                    {}
                );

                let votersBranchCountArray = [];
                for (let branch in eligibleVotersBranchCount) {
                    let hasVoted = roundStatistics.branchesCount.find((b) => {
                        return b.name === branch;
                    });
                    hasVoted = hasVoted ? hasVoted.voters : 0;

                    votersBranchCountArray.push({
                        name: branch,
                        hasVoted: hasVoted,
                        hasNotVoted:
                            eligibleVotersBranchCount[branch] - hasVoted,
                    });
                }
                roundStatistics.votersBranchCount = votersBranchCountArray;

                statistics.push(roundStatistics);
            }

            return res.status(200).json({
                message: 'Campaign voters statistics returned.',
                data: statistics,
            });
        }
    );
};

function getVoterPropertyStatisticsArray(profiles, property) {
    const propertyValues = profiles.map((profile) => {
        return profile[property];
    });

    const valuesCount = propertyValues.reduce((total, value) => {
        total[value] = (total[value] || 0) + 1;
        return total;
    }, {});

    let valuesCountArray = [];
    for (let value in valuesCount) {
        valuesCountArray.push({
            name: value,
            voters: valuesCount[value],
        });
    }
    return valuesCountArray;
}

exports.statistics = async function (req, res) {
    VotingCampaign.findById(req.params.campaignID, { voting: 1 }).exec(
        async function (err, campaign) {
            if (err) {
                logGeneralError(
                    err,
                    req,
                    'Error retrieving campaign statistics'
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Campaign not found',
                });
            }
            let promises = [];
            let statistics = [];
            for (let round of campaign.voting) {
                let roundStatistics = {};
                const candidates = round.candidates;
                const voters = Array.from(round.votes.keys());
                const votes = Array.from(round.votes.values());
                roundStatistics.overall = getOverallVotersCount(round);

                const voterIds = Array.from(round.votes.keys()).map((id) =>
                    mongoose.Types.ObjectId(id)
                );
                let profiles = await Profile.find(
                    {
                        _id: { $in: voterIds },
                    },
                    { _id: 1, branch: 1 }
                );
                profiles = profiles.map((profile) => {
                    return {
                        id: String(profile._id),
                        branch: profile.branch,
                        candidateID: String(
                            votes[voters.indexOf(String(profile._id))]
                        ),
                    };
                });

                if (profiles.length > 0) {
                    const df = new dfd.DataFrame(profiles);

                    let grp = df.groupby(['candidateID', 'branch']);
                    promises.push(
                        grp
                            .agg({ id: 'count' })
                            .rename({ mapper: { id_count: 'votes' } })
                            .to_json()
                            .then((json) => {
                                const data = JSON.parse(json);

                                roundStatistics.candidateToBranch = reshapeStatistics(
                                    data,
                                    'candidateID',
                                    'branch',
                                    candidates
                                );
                                roundStatistics.branchToCandidate = reshapeStatistics(
                                    data,
                                    'branch',
                                    'candidateID',
                                    candidates
                                );

                                statistics.push(roundStatistics);
                            })
                            .catch((err) => {
                                logGeneralError(
                                    req,
                                    err,
                                    `Error retrieving statistics for ${campaign.name}`
                                );
                                return res.status(500).json({
                                    message: err,
                                });
                            })
                    );
                } else {
                    statistics.push(roundStatistics);
                }
            }
            Promise.all(promises).then(() => {
                return res.status(200).json({
                    message: 'Campaign statistics returned.',
                    data: statistics,
                });
            });
        }
    );
};

function getOverallVotersCount(round) {
    const candidates = round.candidates;
    const votes = Array.from(round.votes.values());
    const overallCount = votes.reduce((total, value) => {
        total[value] = (total[value] || 0) + 1;
        return total;
    }, {});

    let overallCountArray = [];
    for (let cand in overallCount) {
        overallCountArray[candidates.indexOf(cand)] = {
            candidateID: cand,
            votes: overallCount[cand],
        };
    }
    for (let i = 0; i < candidates.length; i++) {
        if (!overallCountArray[i]) {
            overallCountArray[i] = {
                candidateID: candidates[i],
                votes: 0,
            };
        }
    }

    if (overallCountArray.length > 0) {
        return overallCountArray;
    }
}

function reshapeStatistics(data, outerKey, childrenKey, candidates) {
    const statsObj = {};
    data.forEach((datum) => {
        let single = {};
        if (datum[outerKey] in statsObj) {
            single = statsObj[datum[outerKey]];
        }
        single[datum[childrenKey]] = datum.votes;
        statsObj[datum[outerKey]] = single;
    });

    let statsArray = [];
    for (let single in statsObj) {
        if (outerKey === 'candidateID') {
            statsArray[candidates.indexOf(single)] = {
                ...{ [outerKey]: single },
                ...statsObj[single],
            };
        } else {
            statsArray.push({
                ...{ [outerKey]: single },
                ...statsObj[single],
            });
        }
    }
    if (outerKey === 'candidateID') {
        for (let i = 0; i < candidates.length; i++) {
            if (!statsArray[i]) {
                statsArray[i] = {
                    [outerKey]: candidates[i],
                };
            }
        }
    }
    return statsArray;
}

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

        VotingCampaign.findById(
            req.params.campaignID,
            { voting: 1 },
            function (err, campaign) {
                if (err) {
                    return res.status(400).json({
                        message: err.message,
                    });
                } else if (campaign === null) {
                    return res.status(404).json({
                        message: 'Campaign with that ID is not found',
                    });
                }

                const {
                    // eslint-disable-next-line no-unused-vars
                    voting: voting,
                    // eslint-disable-next-line no-unused-vars
                    candidatePool: candidatePool,
                    ...updateBody
                } = req.body;

                VotingCampaign.findByIdAndUpdate(
                    req.params.campaignID,
                    updateBody,
                    { useFindAndModify: false, runValidators: true },
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
            logGeneralError(req, err, 'Error deleting campaign');
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
                        logGeneralError(
                            req,
                            err,
                            `Error deleting files for campaign ${campaign.name}`
                        );
                        return res.status(500).json({
                            message: err.message,
                        });
                    }
                }
            );
        }

        VotingCampaign.findByIdAndRemove(campaign._id, (err) => {
            if (err) {
                logGeneralError(req, err, 'Error deleting campaign');
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
 * @name POST_/api/voting/admin/:campaignID/round
 */
exports.newRound = function (req, res) {
    VotingCampaign.findById(req.params.campaignID, (err, campaign) => {
        if (err) {
            logGeneralError(req, err, 'Error creating new voting round');
            return res.status(500).json({ message: err.message });
        }
        let newRound = new VotingRound({
            ...req.body,
            candidates: [],
            votes: new Set(),
        });
        let newRoundID = campaign.voting.length;
        campaign.voting.push(newRound);

        campaign
            .save()
            .then(() => res.json({ data: newRoundID }))
            .catch((err) => {
                logGeneralError(
                    req,
                    err,
                    `Error saving new voting round for ${campaign.name}`
                );
                res.status(500).json({ data: err });
            });
    });
};

/**
 * @name GET_/api/voting/admin/:campaignID/round/:roundID
 */
exports.viewRound = function (req, res) {
    VotingCampaign.findById(req.params.campaignID, (err, campaign) => {
        if (err) {
            logGeneralError(req, err, 'Error retrieving voting round');
            return res.status(500).json({ message: err.message });
        }
        if (!campaign) return res.sendStatus(404);
        if (req.params.roundID >= campaign.voting.length) res.sendStatus(400);
        res.json({
            data: {
                ...campaign.voting[req.params.roundID].toObject(),
                votes: {},
            },
        });
    });
};

/**
 * @name PATCH_/api/voting/admin/:campaignID/round/:roundID
 */
exports.updateRound = function (req, res) {
    VotingCampaign.findById(req.params.campaignID, (err, campaign) => {
        if (err) {
            logGeneralError(req, err, 'Error updating voting round');
            return res.status(500).json({ message: err.message });
        }
        if (!campaign) return res.sendStatus(404);
        if (req.params.roundID >= campaign.voting.length) res.sendStatus(400);
        campaign.voting[req.params.roundID].startDate = req.body.startDate;
        campaign.voting[req.params.roundID].endDate = req.body.endDate;
        campaign.voting[req.params.roundID].voterListFinalisationDate =
            req.body.voterListFinalisationDate;

        campaign
            .save()
            .then((newCampaign) => res.json({ data: newCampaign }))
            .catch((err) => {
                logGeneralError(
                    req,
                    err,
                    `Error updating voting round for ${campaign.name}`
                );
                res.status(500).json({ data: err });
            });
    });
};

/**
 * @name DELETE_/api/voting/admin/:campaignID/round/:roundID
 */
exports.deleteRound = function (req, res) {
    VotingCampaign.findById(req.params.campaignID, (err, campaign) => {
        if (err) res.sendStatus(500);
        if (req.params.roundID >= campaign.voting.length) res.sendStatus(400);
        campaign.voting[req.params.roundID].splice(req.params.roundID, 1);

        campaign
            .save()
            .then((newCampaign) => res.json({ data: newCampaign }))
            .catch((err) => {
                logGeneralError(
                    req,
                    err,
                    `Error deleting voting round for ${campaign.name}`
                );
                res.status(500).json({ data: err });
            });
    });
};

/**
 * View information about the specified voting campaign, including the list of candidates.
 * The list of voters for each candidate is not included, for now.
 * Fields that are supposed to be a file are returned as the ID of the file, where the file itself can be retrieved
 * using the respective view endpoints.
 * @name GET_/api/voting/:campaignID
 * @param req.params.campaignID is the campaign ID to be viewed
 * @return res.body.data is the campaign object.
 */
exports.view = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { 'voting.votes': 0 },
        function (err, campaign) {
            if (err) {
                logGeneralError(
                    req,
                    err,
                    'Error retrieving general voting campaign information'
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) return res.sendStatus(404);

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
            if (!campaign) return res.sendStatus(404);
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
            logGeneralError(
                req,
                err,
                'Error uploading files for new candidate'
            );
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
            {},
            function (err, campaign) {
                if (err) {
                    logGeneralError(req, err, 'Error nominating new candidate');
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                if (!campaign) {
                    return res.status(404).json({
                        message: 'Campaign ID does not exist',
                    });
                }
                let candidateExists = campaign.candidatePool.find(
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
                        $push: { candidatePool: candidate },
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

                        if (
                            candidate.cv &&
                            candidate.organisationExp &&
                            candidate.notInOfficeStatement &&
                            candidate.videoLink &&
                            candidate.motivationEssay
                        ) {
                            sendCompletedSubmissionEmail(
                                res.locals.oauth.token.user._id,
                                req,
                                res
                            );
                        } else {
                            return res.status(200).json({
                                message: 'Voting candidate submitted.',
                                candidateId: candidate.candidateID,
                            });
                        }
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
            logGeneralError(
                req,
                err,
                'Error uploading files for nomination candidate update'
            );
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
                updateQuery['candidatePool.$.cv'] = mongoose.Types.ObjectId(
                    req.files['cv'][0].id
                );
                toBeDeleted.push('cv');
            }
            if ('organisationExp' in req.files) {
                updateQuery[
                    'candidatePool.$.organisationExp'
                ] = mongoose.Types.ObjectId(req.files['organisationExp'][0].id);
                toBeDeleted.push('organisationExp');
            }
            if ('notInOfficeStatement' in req.files) {
                updateQuery[
                    'candidatePool.$.notInOfficeStatement'
                ] = mongoose.Types.ObjectId(
                    req.files['notInOfficeStatement'][0].id
                );
                toBeDeleted.push('notInOfficeStatement');
            }
            if ('motivationEssay' in req.files) {
                updateQuery[
                    'candidatePool.$.motivationEssay'
                ] = mongoose.Types.ObjectId(req.files['motivationEssay'][0].id);
                toBeDeleted.push('motivationEssay');
            }
        }

        if (req.body.videoLink) {
            updateQuery['candidatePool.$.videoLink'] = req.body.videoLink;
        }

        VotingCampaign.findById(
            req.params.campaignID,
            { nominateStart: 1, nominateEnd: 1 },
            function (err, campaign) {
                if (err) {
                    logGeneralError(req, err, 'Error updating nomination');
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
                        'candidatePool.candidateID': String(
                            res.locals.oauth.token.user._id
                        ),
                    },
                    { $set: updateQuery },
                    { useFindAndModify: false },
                    function (err, campaign) {
                        if (err) {
                            logGeneralError(
                                req,
                                err,
                                'Error updating nomination'
                            );
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

                        let candidate = campaign.candidatePool.find(
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
                            logGeneralError(
                                req,
                                err,
                                'Error deleting files for candidate nomination update'
                            );
                            return res.status(500).json({
                                message: deleteError.message,
                            });
                        }

                        VotingCampaign.findById(
                            req.params.campaignID,
                            { candidatePool: 1 },
                            function (err, campaign) {
                                let candidate = campaign.candidatePool.find(
                                    ({ candidateID }) =>
                                        String(candidateID) ===
                                        String(res.locals.oauth.token.user._id)
                                );

                                if (
                                    candidate.cv &&
                                    candidate.organisationExp &&
                                    candidate.notInOfficeStatement &&
                                    candidate.videoLink &&
                                    candidate.motivationEssay
                                ) {
                                    sendCompletedSubmissionEmail(
                                        res.locals.oauth.token.user._id,
                                        req,
                                        res
                                    );
                                } else {
                                    return res.status(200).json({
                                        message: 'Voting candidate updated.',
                                        candidateId:
                                            res.locals.oauth.token.user._id,
                                    });
                                }
                            }
                        );
                    }
                );
            }
        );
    });
};

async function sendCompletedSubmissionEmail(candidateId, req, res) {
    Profile.findById(
        candidateId,
        { email: 1, emailPersonal: 1 },
        function (err, profile) {
            if (err) {
                logGeneralError(
                    req,
                    err,
                    'Error sending submission complete email'
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!profile) {
                return res.status(404).json({
                    message: 'Invalid profile ID.',
                });
            }

            let emails = [];
            if (profile.email) {
                emails.push(profile.email);
            }
            if (profile.emailPersonal) {
                emails.push(profile.emailPersonal);
            }
            let message = {
                from: 'KPU PPI UK - No Reply <kpuppiuk@gmail.com>', // sender address
                replyTo: 'no-reply@example.com',
                to: emails, // list of receivers
                subject: 'Thank you for your submission', // Subject line
                html: `<p>Thank you for your submission. You are allowed to update your submission until the deadline.
                The successful candidate will be announced in due course.
                Follow our Instagram account @kpuppi_unitedkingdom or explore the hashtag #PPIUKMemilih 
                for any update about PPI UK General Election 2021.
                Send us your enquiries to kpuppiuk@gmail.com </p>`, // html body
            };

            mailTransporter.sendMail(message, (err) => {
                if (err) {
                    logGeneralError(
                        req,
                        err,
                        'Error sending submission complete email'
                    );
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                return res.status(201).json({
                    message: 'Submission completed and email sent',
                });
            });
        }
    );
}

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
        { candidatePool: 1 },
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
            if (campaign.candidatePool.length === 0) {
                return res.status(404).json({
                    message: 'There is no candidate yet for this campaign ID.',
                });
            }
            let candidate = campaign.candidatePool.find(
                ({ candidateID }) => String(candidateID) === req.params.userID
            );
            if (!candidate) {
                candidate = campaign.candidatePool.find(
                    ({ _id }) => String(_id) === req.params.userID
                );
            }
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
        { candidatePool: 1 },
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
            if (campaign.candidatePool.length === 0) {
                return res.status(404).json({
                    message: 'You have not nominated yourself in this campaign',
                });
            }
            let candidate = campaign.candidatePool.find(
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
        { candidatePool: 1 },
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
        logGeneralError(req, err, 'Error sending candidate file');
        return res.status(500).json({
            message: err.message,
        });
    }
    if (!campaign) {
        return res.status(404).json({
            message: 'Invalid campaign ID.',
        });
    }
    if (campaign.candidatePool.length === 0) {
        return res.status(404).json({
            message: 'There is no candidate yet for this campaign ID.',
        });
    }
    let candidate = campaign.candidatePool.find(
        ({ candidateID }) => String(candidateID) === req.params.userID
    );
    if (!candidate) {
        candidate = campaign.candidatePool.find(
            ({ _id }) => String(_id) === req.params.userID
        );
    }
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
        { candidatePool: 1 },
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
        { candidatePool: 1 },
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
        { candidatePool: 1 },
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
 * Select candidates to compete in the voting round.
 * @name POST_/api/voting/:campaignID/round/:round/candidates
 * @param req.params.campaignID is the campaign ID
 * @param req.params.round is the voting round
 * @param req.body.candidates is the list of candidate IDs or candidate schema IDs (the latter is the one being saved)
 */
exports.selectCandidates = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        { candidatePool: 1, voting: 1 },
        function (err, campaign) {
            if (err) {
                logGeneralError(
                    req,
                    err,
                    'Error selecting candidates for campaign'
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Invalid campaign ID',
                });
            }

            if (campaign.voting.length <= req.params.round) {
                return res.status(400).json({
                    message: `There is no voting round ${
                        req.params.round + 1
                    } in this campaign`,
                });
            }

            if (req.body.candidates) {
                let candidates = new Set();
                for (let id of req.body.candidates) {
                    let candidate = campaign.candidatePool.find(
                        ({ candidateID }) => String(candidateID) === id
                    );
                    if (!candidate) {
                        candidate = campaign.candidatePool.find(
                            ({ _id }) => String(_id) === id
                        );
                    }
                    if (!candidate) {
                        return res.status(404).json({
                            message: `Candidate ID ${id} not found in this campaign.`,
                        });
                    }
                    candidates.add(candidate._id);
                }
                candidates = Array.from(candidates);
                campaign.voting[req.params.round].candidates = candidates;
            }

            campaign.save().then(() => {
                return res.status(200).json({
                    message: 'Candidates selected',
                });
            });
        }
    );
};

/**
 * Checks if caller is eligible to vote in the specified campaign.
 * @name POST_/api/voting/:campaignID/eligibility/:round
 * @param req.params.campaignID is the campaign ID
 * @param req.params.round is the round number
 * @return res.body.data is true or false
 */
exports.eligibility = async function (req, res) {
    let voterId = String(res.locals.oauth.token.user._id);
    let profile = await Profile.findById(voterId, {
        _id: 1,
        email: 1,
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
    if (parseInt(req.params.round) === 1 && !profile.email) {
        return res.status(200).json({
            data: false,
        });
    }
    if (
        profile._id.getTimestamp() >
        campaign.voting[req.params.round].voterListFinalisationDate
    ) {
        return res.status(200).json({
            data: false,
        });
    }
    if (profile.endDate < campaign.voterCutOffEndDate) {
        return res.status(200).json({
            data: false,
        });
    }
    if (
        (profile.endDate - profile.startDate) / (1000 * 60 * 60 * 24) <
        180 //FIXME: magic number
    ) {
        return res.status(200).json({
            data: false,
        });
    }

    if (
        profile.degreeLevel.includes('S2') &&
        !profile.degreeLevel.includes('S1') && //skipping integrated masters
        campaign.voterMastersCutOffStartDate &&
        (profile.endDate - profile.startDate) / (1000 * 60 * 60 * 24) <= 365 && //TODO: how to decide if the Masters course is a 1 year course or not???
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

function getEligibleListPipeline(campaign, round) {
    let aggregationPipeline = [
        {
            $match: {
                roles: {
                    $in: ['verified'],
                },
            },
        },
    ];
    if (round === 1) {
        aggregationPipeline.push({
            $match: {
                $and: [
                    {
                        email: {
                            $exists: true,
                        },
                    },
                    { email: { $ne: '' } },
                ],
            },
        });
    }
    aggregationPipeline.push({
        $project: {
            _id: 1,
            fullName: 1,
            degreeLevel: 1,
            branch: 1,
            startDate: 1,
            endDate: 1,
            courseLength: {
                $divide: [
                    {
                        $subtract: ['$endDate', '$startDate'],
                    },
                    1000 * 60 * 60 * 24,
                ],
            },
        },
    });
    aggregationPipeline.push({
        $match: {
            courseLength: {
                $gte: 180, // FIXME: magic number
            },
        },
    });
    if (campaign.voting[round].voterListFinalisationDate) {
        aggregationPipeline.push({
            $match: {
                _id: {
                    $lte: mongoose.Types.ObjectId(
                        Math.ceil(
                            campaign.voting[
                                round
                            ].voterListFinalisationDate.getTime() / 1000
                        ).toString(16) + '0000000000000000'
                    ),
                },
            },
        });
    }
    if (campaign.voterCutOffEndDate) {
        aggregationPipeline.push({
            $match: {
                endDate: {
                    $gt: new Date(campaign.voterCutOffEndDate),
                },
            },
        });
    }
    if (campaign.voterMastersCutOffStartDate) {
        aggregationPipeline.push({
            $match: {
                $or: [
                    {
                        degreeLevel: {
                            // TODO: decide!
                            // $in: [
                            //     new RegExp('A-Level'),
                            //     new RegExp('S1'),
                            //     new RegExp('S3'),
                            // ],
                            $nin: [new RegExp('S2')],
                        },
                    },
                    {
                        $and: [
                            {
                                degreeLevel: new RegExp('S2'),
                            },
                            {
                                $or: [
                                    {
                                        courseLength: {
                                            $gt: 365,
                                        },
                                    },
                                    {
                                        $and: [
                                            {
                                                courseLength: {
                                                    $lte: 365,
                                                },
                                            },
                                            {
                                                startDate: {
                                                    $gte: new Date(
                                                        campaign.voterMastersCutOffStartDate
                                                    ),
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
    }
    aggregationPipeline.push({
        $project: {
            _id: 1,
            fullName: 1,
            degreeLevel: 1,
            branch: 1,
            startDate: 1,
            endDate: 1,
        },
    });
    return aggregationPipeline;
}

/**
 * Get eligible voters list for every round of the election.
 * @name GET_/voting/admin/:campaignID/voters
 * @param req.params.campaignID is the campaign ID
 * @return res.body.data is the list of list of eligible voters, for each round
 */
exports.eligibleList = function (req, res) {
    VotingCampaign.findById(
        req.params.campaignID,
        {
            voterCutOffEndDate: 1,
            voterMastersCutOffStartDate: 1,
            'voting.startDate': 1,
            'voting.voterListFinalisationDate': 1,
        },
        async function (err, campaign) {
            if (err) {
                logGeneralError(
                    req,
                    err,
                    'Error retrieving eligible voter list'
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Campaign is not found',
                });
            }
            let aggregationPipeline = getEligibleListPipeline(campaign, 0);
            aggregationPipeline.push({
                $project: {
                    _id: 1,
                    fullName: 1,
                    degreeLevel: 1,
                    branch: 1,
                    startDate: 1,
                    endDate: 1,
                },
            });
            try {
                const round1Profiles = await Profile.aggregate(
                    aggregationPipeline
                );
                let profiles = [round1Profiles];
                if (campaign.voting.length > 1) {
                    aggregationPipeline = getEligibleListPipeline(campaign, 1);
                    profiles.push(await Profile.aggregate(aggregationPipeline));
                }
                return res.status(200).json({
                    message: 'Voter list received successfully',
                    data: profiles,
                });
            } catch (err) {
                logGeneralError(
                    req,
                    err,
                    'Error retrieving eligible voter list'
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
        }
    );
};

/**
 * Checks if caller has voted in the specified campaign.
 * @name GET_/api/voting/:campaignID/hasVoted/:round
 * @param req.params.campaignID is the campaign ID
 * @param req.params.round is the voting round
 * @return res.body.data is true or false
 */
exports.hasVoted = function (req, res) {
    let voterId = String(res.locals.oauth.token.user._id);
    VotingCampaign.findById(
        req.params.campaignID,
        { voting: 1 },
        (err, campaign) => {
            if (err) {
                logGeneralError(req, err, 'Error retrieving has voted list');
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!campaign) {
                return res.status(404).json({
                    message: 'Invalid campaign ID',
                });
            }
            if (campaign.voting.length <= req.params.round) {
                return res.status(400).json({
                    message: `There is no voting round ${
                        req.params.round + 1
                    } in this campaign`,
                });
            }
            const hasVoted = campaign.voting[req.params.round].votes.has(
                voterId
            );

            return res.status(200).json({
                data: hasVoted,
            });
        }
    );
};

/**
 * Votes for the specified candidate in the specified campaign.
 * @name POST_/api/voting/:campaignID/vote/:round/:candidateID
 * @param req.params.campaignID is the campaign ID
 * @param req.params.round is the voting round
 * @param req.params.candidateID is the candidate schema ID, NOT candidate user ID
 */
exports.vote = async function (req, res) {
    try {
        let voterId = String(res.locals.oauth.token.user._id);
        let profile = await Profile.findById(voterId, {
            email: 1,
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
        const round = parseInt(req.params.round);
        if (campaign.voting.length <= round) {
            return res.status(400).json({
                message: `There is no voting round ${
                    round + 1
                } in this campaign`,
            });
        }
        let current = new Date();
        if (current < new Date(campaign.voting[round].startDate)) {
            return res.status(403).json({
                message: 'The voting phase has not started.',
            });
        }
        if (current > new Date(campaign.voting[round].endDate)) {
            return res.status(403).json({
                message: 'The voting phase has ended.',
            });
        }
        if (round === 1 && profile.email === undefined) {
            return res.status(403).json({
                message:
                    'You are not eligible to vote because you do not have a university email.',
            });
        }
        if (
            profile._id.getTimestamp() >
            campaign.voting[round].voterListFinalisationDate
        ) {
            return res.status(403).json({
                message:
                    'You are not eligible to vote due to your late registration.',
            });
        }
        if (profile.endDate < campaign.voterCutOffEndDate) {
            return res.status(403).json({
                message:
                    'You are not eligible to vote due to your course end date.',
            });
        }
        if (
            (profile.endDate - profile.startDate) / (1000 * 60 * 60 * 24) <
            180 //FIXME: magic number
        ) {
            return res.status(403).json({
                message:
                    'You are not eligible to vote due to your course length.',
            });
        }
        // TODO: decide if the below logic is needed!
        // if (
        //     !profile.degreeLevel.includes('S1') &&
        //     !profile.degreeLevel.includes('S2') &&
        //     !profile.degreeLevel.includes('S3') &&
        //     !profile.degreeLevel.includes('A-Level')
        // ) {
        //     return res.status(403).json({
        //         message:
        //             'You are not eligible to vote due to your degree level.',
        //     });
        // }
        if (
            //TODO: how to decide if the Masters course is a 1 year course or not???
            profile.degreeLevel.includes('S2') &&
            !profile.degreeLevel.includes('S1') && //skipping integrated masters
            campaign.voterMastersCutOffStartDate &&
            (profile.endDate - profile.startDate) / (1000 * 60 * 60 * 24) <=
                365 && //TODO: how to decide if the Masters course is a 1 year course or not???
            profile.startDate < campaign.voterMastersCutOffStartDate
        ) {
            return res.status(403).json({
                message:
                    'You are not eligible to vote due to your course start date.',
            });
        }
        if (campaign.voting[round].votes.has(voterId)) {
            return res.status(400).json({
                message: 'You have already voted in this campaign',
            });
        }

        if (
            !campaign.voting[round].candidates.includes(req.params.candidateID)
        ) {
            return res.status(404).json({
                message: 'Candidate ID not found in this campaign.',
            });
        }

        campaign.voting[round].votes.set(voterId, req.params.candidateID);
        let savedCampaign = await campaign.save();
        if (savedCampaign) {
            sendVotingSuccessEmail(voterId, req.params.candidateID, req, res);
        }
    } catch (err) {
        logGeneralError(req, err, 'Error voting in campaign');
        return res.status(500).json({
            message: err.message,
        });
    }
};

async function sendVotingSuccessEmail(voterId, candidateId, req, res) {
    const hashValue = crypto
        .createHash('md5')
        .update(voterId + candidateId)
        .digest('hex');

    Profile.findById(
        voterId,
        { email: 1, emailPersonal: 1 },
        function (err, profile) {
            if (err) {
                logGeneralError(
                    req,
                    err,
                    'Error sending vote confirmation email'
                );
                return res.status(500).json({
                    message: err.message,
                });
            }
            if (!profile) {
                return res.status(404).json({
                    message: 'Invalid profile ID.',
                });
            }

            let emails = [];
            if (profile.email) {
                emails.push(profile.email);
            }
            if (profile.emailPersonal) {
                emails.push(profile.emailPersonal);
            }
            // FIXME: message should be dynamic
            let message = {
                from: 'KPU PPI UK - No Reply <kpuppiuk@gmail.com>', // sender address
                replyTo: 'no-reply@example.com',
                to: emails, // list of receivers
                subject: 'Thank you for your vote', // Subject line
                html: `<p>Thank you for taking your crucial role in shaping the PPI UK 2021/2022 through your vote in 
                the first round of election. Please keep this email and this code: ${hashValue} as your receipt. </p>
                <p><b>Inform your colleagues who are eligible as voters to vote in this round!
                The vote portal will be available from 3 October 2021 at 00.00 BST to 7 October 2021 at 12.00 BST.</b></p>
                <p>Post sticker yang terlampir dan mention @kpuppi_unitedkingdom pada Instagram story di akun Instagram yang Anda miliki.
                Anda juga bisa memasukkan sticker KPU PPI UK yang relevan lainnya dengan memasukan kata kunci “@kpuppiuk” pada GIF di Instagram story Anda.</p>
                <p>Updates about PPI UK General Election 2021:<br/>
                Website <a href="https://ppiuk.org/pemilu">https://ppiuk.org/pemilu</a><br>
                YouTube <a href="https://link.ppiuk.org/YoutubePemilu ">https://link.ppiuk.org/YoutubePemilu</a><br>
                Instagram <a href="https://www.instagram.com/kpuppi_unitedkingdom/">@kpuppi_unitedkingdom</a>
                </p>
                <p>Send your enquiries to <a href="mailto:kpuppiuk@gmail.com">kpuppiuk@gmail.com</a></p>`, // html body
                attachments: [
                    {
                        filename: 'vote-sticker-2.jpg',
                        content: fs.createReadStream(
                            path.join(
                                __dirname,
                                '..',
                                'data',
                                'vote-sticker-2.jpg'
                            )
                        ),
                    },
                ],
            };

            mailTransporter.sendMail(message, (err) => {
                if (err) {
                    logGeneralError(
                        req,
                        err,
                        'Error sending vote confirmation email'
                    );
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                return res.status(201).json({
                    message: 'Voting successful and email sent',
                });
            });
        }
    );
}

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
