const mongoose = require('mongoose');

const votingCandidateSchema = new mongoose.Schema({
    candidateID: {
        type: mongoose.Schema.ObjectId,
        required: true,
    },
    cv: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    // studentProof: {
    //     type: mongoose.Schema.ObjectId,
    //     required: false,
    // },
    organisationExp: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    notInOfficeStatement: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    videoLink: {
        type: String,
        required: false,
    },
    motivationEssay: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    votes: {
        type: [mongoose.Schema.ObjectId],
        required: true,
        default: [],
        ref: 'Profile',
    },
});

const votingCampaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    banner: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    activeOverride: {
        type: Boolean,
        required: true,
        default: false,
    },
    voterCutOffEndDate: {
        type: Date,
        required: true,
    },
    voterMastersCutOffStartDate: {
        type: Date,
        required: false,
    },
    nominateStart: {
        type: Date,
        required: true,
    },
    nominateEnd: {
        type: Date,
        required: true,
    },
    voteStart: {
        type: Date,
        required: true,
    },
    voteEnd: {
        type: Date,
        required: true,
    },
    candidates: {
        type: [votingCandidateSchema],
        default: [],
    },
    public: {
        type: Boolean,
        required: true,
    },
});

votingCampaignSchema.pre('validate', function (next) {
    if (this.nominateStart >= this.nominateEnd) {
        this.invalidate(
            'nominateEnd',
            'nominateEnd must be after nominateStart'
        );
    }

    let gracePeriod = new Date(this.voteStart);
    gracePeriod.setHours(gracePeriod.getHours() - 1);
    if (this.nominateEnd >= gracePeriod) {
        this.invalidate(
            'voteStart',
            'voteStart should be more than 1 hour after nominateEnd'
        );
    }

    if (this.voteStart >= this.voteEnd) {
        this.invalidate('voteEnd', 'voteEnd must be after voteStart');
    }
    next();
});

mongoose.model('VotingCandidate', votingCandidateSchema, 'votingcandidates');
mongoose.model('VotingCampaign', votingCampaignSchema, 'votingcampaigns');
