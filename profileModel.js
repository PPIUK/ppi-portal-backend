var mongoose = require('mongoose');
const aggregatePaginate = require('mongoose-aggregate-paginate-v2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const Token = require('./auth/verificationTokenModel');

var profileSchema = new mongoose.Schema({
    branch: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    dob: {
        type: Date,
        required: true
    },
    originCity: {
        type: String,
        required: true
    },
    addressUK: {
        type: String,
        required: false
    },
    postcodeUK: {
        type: String,
        required: true
    },
    university: {
        type: String,
        required: true
    },
    degreeLevel: {
        type: String,
        required: true
    },
    faculty: {
        type: String,
        required: false
    },
    course: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    fundingSource: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: true,
        // unique: true
    },
    emailPersonal: {
        type: String,
        required: false
    },
    phoneWA: {
        type: String,
        required: true
    },
    linkedin: {
        type: String,
        required: false
    },
    referral: {
        type: String,
        required: false
    },
    password: {
        type: String,
        required: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    accessToken: {
        type: String,
        required: false
    },
    role: {
        type: String,
        default: 'basic',
        enum: ["basic", "verified", "verifier", "dataAccess", "voteOrganiser"]
    }

});

const saltRounds = 10;
profileSchema.methods.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

profileSchema.methods.setPassword = async function (password) {
    this.password = await bcrypt.hash(password, saltRounds);
};

profileSchema.methods.generateVerificationToken = function() {
    let payload = {
        userId: this._id,
        token: crypto.randomBytes(20).toString('hex')
    };
    return new Token(payload);
};


profileSchema.plugin(aggregatePaginate);

var Profile = module.exports =  mongoose.model('profile', profileSchema);

module.exports.get = function (callback, limit) {
    Profile.find(callback).limit(limit);
}