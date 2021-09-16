const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const crypto = require('crypto');
const path = require('path');
const AccessControl = require('accesscontrol');

const Thesis = mongoose.model('Thesis');
const Profile = mongoose.model('Profile');
const ac = require(global.appRoot + '/config/roles');

const logger = require('../config/winston');
const { logGeneralError } = require('../config/logging-tools')(logger);

const thesisStorage = new GridFsStorage({
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
                    bucketName: 'thesesFiles',
                };
                resolve(fileInfo);
            });
        });
    },
});

const thesisUpload = multer({
    storage: thesisStorage,
    fileFilter: function (req, file, cb) {
        if (
            path.extname(file.originalname).toLowerCase() !== '.pdf' ||
            file.mimetype !== 'application/pdf'
        ) {
            return cb(new multer.MulterError(400, 'File type is not pdf!'));
        }
        return cb(null, true);
    },
}).single('file');

// TODO: add Thesis array field in the Profile model. Needed or not?

/**
 * Submits a thesis and uploads the pdf file, if it was provided.
 * The authors and correspondingAuthor fields can contain a profile ID string,
 * indicating that the author is a registered member of PPI UK.
 * @param req.body.authors is an array
 * @param req.body.correspondingAuthor is a string that needs to be in the authors array
 * @param req.body.file is an optional pdf file
 * @return res.body.id is the thesis submission id.
 */
exports.new = function (req, res) {
    thesisUpload(req, res, async function (err) {
        // FIXME: Decide on behaviour (who is allowed to submit whose)
        // if (!req.body.authors.includes(String(res.locals.oauth.token.user._id)) &&
        //     !res.locals.oauth.token.user.roles.includes('thesisAdmin')) {
        //     return res.status(403).json({
        //         message: 'You are trying to submit thesis that you did not contribute in!'
        //     })
        // }

        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }

        const authors = JSON.parse(req.body.authors);
        if (!authors.includes(req.body.correspondingAuthor)) {
            return res.status(400).json({
                message:
                    'Corresponding Author is not included in the list of authors!',
            });
        }

        let thesis = new Thesis({
            ...req.body,
            authors: authors,
            uploadedBy: res.locals.oauth.token.user._id,
        });
        thesis = await processThesis(req, thesis);
        thesis.save(function (err) {
            if (err) {
                logGeneralError(req, err, 'Error submitting new thesis upload');
                return res.status(500).json({
                    message: err.message,
                });
            }
            return res.status(200).json({
                message: 'New thesis submitted!',
                id: thesis._id,
            });
        });
    });
};

async function processThesis(req, thesis) {
    if (req.file) {
        thesis.fileId = mongoose.Types.ObjectId(req.file.id);
        thesis.originalFileName = req.file.originalname;
    }

    try {
        await Profile.findById(
            thesis.correspondingAuthor,
            { _id: 1 },
            (err, profile) => {
                if (profile === null || (err && err.name === 'CastError')) {
                    thesis.correspondingAuthor = req.body.correspondingAuthor;
                } else {
                    thesis.correspondingAuthor = mongoose.Types.ObjectId(
                        profile._id
                    );
                }
            }
        );
        // eslint-disable-next-line no-empty
    } catch {}

    let authors = [];
    for (const author of thesis.authors) {
        try {
            await Profile.findById(author, { _id: 1 }, (err, profile) => {
                if ((err && err.name === 'CastError') || profile === null) {
                    authors.push(author);
                } else {
                    authors.push(profile._id);
                }
            });
            // eslint-disable-next-line no-empty
        } catch {}
    }
    thesis.authors = authors;

    return thesis;
}

/**
 * Updates a thesis and uploads the pdf file, if it was provided.
 * The authors and correspondingAuthor fields can contain a profile ID string,
 * indicating that the author is a registered member of PPI UK.
 * This can only be done by thesisAdmin role.
 * @param req.body.authors is an array
 * @param req.body.correspondingAuthor is a string that needs to be in the authors array
 * @param req.body.file is an optional pdf file
 * @return res.body.id is the thesis submission id.
 */
exports.update = function (req, res) {
    thesisUpload(req, res, async function (err) {
        if (
            !req.body.authors.includes(
                String(res.locals.oauth.token.user._id)
            ) &&
            !res.locals.oauth.token.user.roles.includes('thesisAdmin')
        ) {
            return res.status(403).json({
                message:
                    'You are trying to update thesis that you did not contribute in!',
            });
        }

        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }
        if (!req.body.authors.includes(req.body.correspondingAuthor)) {
            return res.status(400).json({
                message:
                    'Corresponding Author is not included in the list of authors!',
            });
        }

        Thesis.findById(req.params.id, async function (err, thesis) {
            thesis.set(req.body);
            thesis = await processThesis(req, thesis);
            thesis.save(function (err) {
                if (err) {
                    return res.status(400).json({
                        message: err.message,
                    });
                }
                return res.status(200).json({
                    message: 'Thesis updated!',
                    id: thesis._id,
                });
            });
        });
    });
};

/**
 * Retrieves information of a thesis, given the thesis submission ID.
 * This endpoint is public.
 * @param req.params.id is the thesis submission ID
 *
 * In addition to the submitted fields, it includes the following modified and new fields:
 * @return res.body.data.authors is an array of author objects, which has the optional profile _id, if the author is
 * a registered member of PPI UK, and the fullName.
 * @return res.body.data.correspondingAuthor is an object consisting of an optional profile _id, if the corresponding
 * author is a registered member of PPI UK, and the fullname.
 * @return res.body.data.fileId if there is a pdf file uploaded with this submission
 * @return res.body.data.originalFileName if there is a pdf file uploaded with this submission
 */
exports.view = function (req, res) {
    Thesis.findById(req.params.id, { __v: 0 }, async (err, thesis) => {
        if (thesis === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Thesis ID not found!',
            });
        } else if (err) {
            logGeneralError(req, err, 'Error retrieving thesis');
            return res.status(500).json({
                message: err.message,
            });
        } else {
            try {
                await Profile.findById(
                    thesis.correspondingAuthor,
                    { _id: 1, fullName: 1 },
                    (err, profile) => {
                        if (
                            profile === null ||
                            (err && err.name === 'CastError')
                        ) {
                            thesis.correspondingAuthor = {
                                fullName: thesis.correspondingAuthor,
                            };
                        } else {
                            thesis.correspondingAuthor = profile;
                        }
                    }
                );
            } catch {}

            let authors = [];
            for (const author of thesis.authors) {
                try {
                    await Profile.findById(
                        author,
                        { _id: 1, fullName: 1 },
                        (err, profile) => {
                            if (
                                profile === null ||
                                (err && err.name === 'CastError')
                            ) {
                                authors.push({ fullName: author });
                            } else {
                                authors.push(profile);
                            }
                        }
                    );
                } catch {}
            }
            thesis.authors = authors;

            return res.status(200).json({
                message: 'Thesis details returned successfully!',
                data: thesis,
            });
        }
    });
};

/**
 * Searches the thesis bank
 * This endpoint is public.
 * @return theses Array of search result
 */
exports.search = function (req, res) {
    let query = Thesis.find({});

    // count on sanitizer to remove bad values
    for (let [k, v] of Object.entries(req.query)) query.where(k).equals(v);

    query
        .exec()
        .then(async (data) => {
            for (let thesis of data) {
                try {
                    let profile = await Profile.findById(
                        thesis.correspondingAuthor,
                        { _id: 1, fullName: 1 }
                    );

                    if (profile !== null)
                        thesis.correspondingAuthor = {
                            id: profile._id,
                            name: profile.fullName,
                        };
                } catch {
                    // ok
                }
            }
            res.json({
                message: 'Results returned',
                theses: data.map((thesis) =>
                    AccessControl.filter(thesis.toObject(), [
                        '_id',
                        'itemType',
                        'title',
                        'year',
                        'correspondingAuthor',
                        'authors',
                        'university',
                        'cluster',
                    ])
                ),
            });
        })
        .catch((err) => {
            logGeneralError(req, err, 'Error searching thesis');
            res.status(500).json({ message: err.message });
        });
};

/**
 * Returns all thesis.
 * This endpoint is public.
 * @param req.query.cluster is the numbering code for the cluster to be filtered
 * @param req.query.paginate is true if want to use pagination, false if not
 * @param req.query.page
 * @param req.query.limit is 100
 * @return theses Array of search result
 */
exports.feed = function (req, res) {
    let aggregate_options = [];
    let match = {};
    if (req.query.cluster) {
        switch (parseInt(req.query.cluster)) {
            case 1:
                match.cluster = 'Economics and Business';
                break;
            case 2:
                match.cluster = 'Education';
                break;
            case 3:
                match.cluster = 'Energy';
                break;
            case 4:
                match.cluster = 'Health';
                break;
            case 5:
                match.cluster = 'Infrastructure and Built Environment';
                break;
            case 6:
                match.cluster = 'Politics and Law';
                break;
            case 7:
                match.cluster = 'Social Development, Arts and Humanity';
                break;
            case 8:
                match.cluster = 'STEM';
                break;
        }
    }
    aggregate_options.push({ $match: match });
    aggregate_options.push({
        $unset: ['__v', 'uploadedBy', 'fileId'],
    });
    const aggregate = Thesis.aggregate(aggregate_options);

    //Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 100;
    let pagination = req.query.paginate === 'true' || false;

    let options = {
        pagination,
        customLabels: {
            totalDocs: 'totalTheses',
            docs: 'theses',
        },
    };

    if (pagination === true) {
        options.page = page;
        options.limit = limit;
    }

    Thesis.aggregatePaginate(aggregate, options)
        .then(async (data) => {
            for (let thesis of data.theses) {
                try {
                    let profile = await Profile.findById(
                        thesis.correspondingAuthor,
                        { _id: 1, fullName: 1 }
                    );
                    if (profile !== null)
                        thesis.correspondingAuthor = profile.fullName;

                    let thesisAuthors = [];
                    for (const author of thesis.authors) {
                        if (mongoose.isValidObjectId(author)) {
                            let profile = await Profile.findById(author, {
                                fullName: 1,
                            });

                            if (profile !== null)
                                thesisAuthors.push(profile.fullName);
                        } else {
                            thesisAuthors.push(author);
                        }
                    }
                    thesis.authors = thesisAuthors;
                } catch {
                    // ok
                }
            }
            return res.status(200).json({
                message: 'Theses retrieved successfully',
                data: data,
            });
        })
        .catch((err) => {
            logGeneralError(req, err, 'Error retrieving thesis feed/index');
            return res.status(500).json({
                message: err.message,
            });
        });
};
/**
 * Retrieves the uploaded pdf file associated with the thesis submission.
 *
 * @param req.params.id is the ID of the thesis submission, NOT the ID of the file!
 * @param res.status.404 if there is no file associated with the thesis ID, or the thesis ID is not found.
 */
exports.viewFile = function (req, res) {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'thesesFiles',
    });
    Thesis.findById(
        req.params.id,
        { fileId: 1, originalFileName: 1 },
        (err, thesis) => {
            if (thesis === null || (err && err.name === 'CastError')) {
                return res.status(404).json({
                    message: 'Thesis ID not found',
                });
            } else if (thesis.fileId === undefined) {
                return res.status(404).json({
                    message: 'There is no file associated with this Thesis ID',
                });
            } else if (err) {
                logGeneralError(req, err, 'Error retrieving pdf for thesis');
                return res.status(500).json({
                    message: err.message,
                });
            }
            const stream = bucket.openDownloadStream(
                new mongoose.Types.ObjectId(thesis.fileId)
            );
            stream.on('error', (err) => {
                if (err.code === 'ENOENT') {
                    return res.status(404).json({
                        message: 'File not found',
                    });
                }
                logGeneralError(req, err, 'Error retrieving pdf for thesis');
                return res.status(500).json({
                    message: err.message,
                });
            });
            res.writeHead(200, {
                'Content-Disposition': 'filename=' + thesis.originalFileName,
            });
            stream.pipe(res);
        }
    );
};

/**
 * Deletes thesis submission and the associated pdf file (if uploaded).
 * This action can only be done with users with thesisAdmin role.
 * @param req.params.id is the ID of the thesis submission
 * @param res
 */
exports.delete = function (req, res) {
    Thesis.findById(req.params.id, (err, thesis) => {
        if (thesis === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Thesis ID not found',
            });
        } else if (err) {
            logGeneralError(req, err, 'Error deleting thesis');
            return res.status(500).json({
                message: err.message,
            });
        }
        if (thesis.fileId) {
            const bucket = new mongoose.mongo.GridFSBucket(
                mongoose.connection.db,
                {
                    bucketName: 'thesesFiles',
                }
            );
            bucket.delete(new mongoose.Types.ObjectId(thesis.fileId), (err) => {
                if (err) {
                    if (err.message.startsWith('FileNotFound')) {
                        return res.status(404).json({
                            message: 'File not found',
                        });
                    }
                    logGeneralError(req, err, 'Error deleting thesis');
                    return res.status(500).json({
                        message: err.message,
                    });
                }
            });
        }

        Thesis.remove({ _id: thesis._id }, (err) => {
            if (err) {
                logGeneralError(req, err, 'Error deleting thesis');
                return res.status(500).json({
                    message: err.message,
                });
            }
            return res.status(200).json({
                message:
                    'Thesis submission (and file, if uploaded) is deleted.',
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
            [action]('thesis');
        if (!permission.granted) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }
        req.permission = permission;
        return next();
    };
};
