const mongoose = require('mongoose');

const isicSciEssayFormSchema = new mongoose.Schema(
    {
        topic: {
            type: String,
            required: true,
            enum: ['01', '02', '03', '04', '05', '06', '07', '08'],
        },
        title: {
            type: String,
            required: true,
        },
        submissionType: {
            type: String,
            required: true,
            enum: ['Individual', 'Collaboration']
        },
        name1: {
            type: String,
            required: true,
        },
        university1: {
            type: String,
            required: true,
        },
        major1: {
            type: String,
            required: true,
        },
        studentIdNumber1: {
            type: String,
            required: true,
        },
        ktpPassportNumber1: {
            type: String,
            required: true,
        },
        name2: {
            type: String,
            required: false,
        },
        university2: {
            type: String,
            required: false,
        },
        major2: {
            type: String,
            required: false,
        },
        studentIdNumber2: {
            type: String,
            required: false,
        },
        ktpPassportNumber2: {
            type: String,
            required: false,
        },
        emailAddressMain: {
            type: String,
            required: true,
        },
        phoneNumberMain: {
            type: String,
            required: true,
        },
        abstractSubmitted: {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

mongoose.model('IsicSciEssayForm', isicSciEssayFormSchema, 'isicsciessayforms');
