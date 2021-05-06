const mongoose = require('mongoose');

const thesisSchema = new mongoose.Schema(
    {
        cluster: {
            type: String,
            required: true,
            enum: [
                'Economics and Business',
                'Education',
                'Energy',
                'Health',
                'Infrastructure and Built Environment',
                'Politics and Law',
                'Social Development, Arts and Humanity',
                'STEM'
            ],
        },
        title: {
            type: String,
            required: true,
        },
        authors: {
            type: [mongoose.Mixed],
            required: true,
        },
        link: {
            type: String,
            required: false,
        },
        abstract: {
            type: String,
            required: true,
        },
        correspondingAuthor: {
            type: mongoose.Mixed,
            required: true,
        },
        university: {
            type: String,
            required: true,
        },
        itemType: {
            type: String,
            required: true,
            enum: [
                'Thesis (PhD)',
                'Thesis (Master)',
                'Thesis (Bachelor)',
                'Journal Paper',
                'Conference Paper',
                'Essay',
            ],
        },
        fileId: {
            type: mongoose.Schema.ObjectId,
            required: false,
        },
        originalFileName: {
            type: String,
            required: false,
        }
    }
);

mongoose.model('Thesis', thesisSchema, 'theses');
