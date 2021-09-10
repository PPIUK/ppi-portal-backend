var mongoose = require('mongoose');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

var profileSchema = new mongoose.Schema({
    branch: {
        type: String,
        required: true,
        enum: [
            'All',
            'Aberdeen',
            'Belfast',
            'Birmingham',
            'Bournemouth',
            'Bradford',
            'Brighton',
            'Bristol',
            'Cambridge',
            'Canterbury',
            'Coventry',
            'Cranfield',
            'Durham',
            'Edinburgh',
            'Exeter',
            'Glasgow',
            'Hatfield',
            'Hull',
            'Lancaster',
            'Leeds',
            'Leicester',
            'Liverpool',
            'London',
            'Manchester',
            'Newcastle',
            'Northampton',
            'Norwich',
            'Nottingham',
            'Oxford',
            'Portsmouth',
            'Reading',
            'Sheffield',
            'Southampton',
            'Sunderland',
            'Wales',
            'Warwick',
            'York',
        ],
    },
    fullName: {
        type: String,
        required: true,
    },
    dob: {
        type: Date,
        required: true,
    },
    originCity: {
        type: String,
        required: true,
    },
    addressUK: {
        type: String,
        required: false,
    },
    postcodeUK: {
        type: String,
        required: true,
    },
    university: {
        type: String,
        required: true,
    },
    degreeLevel: {
        type: String,
        required: true,
    },
    faculty: {
        type: String,
        required: false,
    },
    course: {
        type: String,
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    studentProof: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    fundingSource: {
        type: String,
        required: false,
    },
    email: {
        type: String,
        required: false, //TODO: revert
        // unique: true
    },
    emailPersonal: {
        type: String,
        required: false,
    },
    phoneWA: {
        type: String,
        required: true,
    },
    linkedin: {
        type: String,
        required: false,
    },
    profilePicture: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    referral: {
        type: String,
        required: false,
    },
    password: {
        type: String,
        required: false,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    accessToken: {
        type: String,
        required: false,
    },
    roles: {
        type: [String],
        default: ['basic'],
        enum: [
            'basic',
            'verified',
            'verifier',
            'flagged',
            'dataAccess',
            'voteOrganiser',
            'mvpAwardsAccess',
            'isicSciEssayAccess',
            'thesisAdmin',
        ],
    },
});

profileSchema.pre('findOneAndUpdate', function (next) {
    this.options.runValidators = true;
    next();
});

profileSchema.pre('update', function (next) {
    this.options.runValidators = true;
    next();
});

const saltRounds = 10;
profileSchema.methods.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

profileSchema.methods.setPassword = async function (password) {
    this.password = await bcrypt.hash(password, saltRounds);
};

profileSchema.methods.generateVerificationToken = function () {
    const Token = mongoose.model('VerificationToken');

    let payload = {
        userId: this._id,
        token: crypto.randomBytes(20).toString('hex'),
    };
    return new Token(payload);
};

profileSchema.statics.get = function (callback, limit) {
    mongoose.model('Profile').find(callback).limit(limit);
};

profileSchema.plugin(aggregatePaginate);

mongoose.model('Profile', profileSchema, 'profiles');
