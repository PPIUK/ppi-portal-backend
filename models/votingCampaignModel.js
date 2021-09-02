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
    // votes: {
    //     type: [mongoose.Schema.ObjectId],
    //     required: true,
    //     default: [],
    //     ref: 'Profile',
    // },
});

const votingRoundSchema = new mongoose.Schema({
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    candidates: {
        type: [mongoose.Schema.ObjectId],
        required: true,
        default: [],
        ref: 'VotingCandidate',
    },
    votes: {
        type: Map,
        of: {
            type: mongoose.Schema.ObjectId,
            ref: 'VotingCandidate',
        },
        default: {},
    },
});

votingRoundSchema.pre('validate', function (next) {
    if (this.startDate >= this.endDate) {
        this.invalidate('endDate', 'endDate must be after startDate');
    }
    next();
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
    candidatePool: {
        type: [votingCandidateSchema],
        default: [],
    },
    voting: {
        type: [votingRoundSchema],
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

    if (this.voting.length === 0) {
        this.invalidate('voting', 'At least 1 voting round should be created!');
    } else {
        let gracePeriod = new Date(this.voting[0].startDate);
        gracePeriod.setHours(gracePeriod.getHours() - 1);
        if (this.nominateEnd >= gracePeriod) {
            this.invalidate(
                'voting',
                'voting.startDate should be more than 1 hour after nominateEnd'
            );
        }
        let endDate = this.voting[0].endDate;
        for (let round of this.voting.slice(1, this.voting.length)) {
            if (round.startDate <= endDate) {
                this.invalidate(
                    'voting',
                    'voting.startDate of next round should be after the endDate of previous round'
                );
                endDate = round.endDate;
            }
        }
    }

    next();
});

mongoose.model('VotingRound', votingRoundSchema, 'votingrounds');
mongoose.model('VotingCandidate', votingCandidateSchema, 'votingcandidates');
mongoose.model('VotingCampaign', votingCampaignSchema, 'votingcampaigns');
