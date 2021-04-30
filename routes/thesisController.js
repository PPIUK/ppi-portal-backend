const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const crypto = require('crypto');
const path = require('path');

const Thesis = mongoose.model('Thesis');
const Profile = mongoose.model('Profile');
const ac = require(global.appRoot + '/config/roles');

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
                    bucketName: 'thesesFiles'
                };
                resolve(fileInfo);
            });
        });
    }
});

const thesisUpload = multer({
    storage: thesisStorage,
    fileFilter: function(req, file, cb) {
        if (path.extname(file.originalname).toLowerCase() !== '.pdf' || file.mimetype !== 'application/pdf') {
            return cb(new multer.MulterError(400, 'File type is not pdf!'));
        }
        return cb(null, true);
    }
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
exports.new =  function (req, res) {
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
                message: err.field
            })
        }
        if (!req.body.authors.includes(req.body.correspondingAuthor)) {
            return res.status(400).json({
                message: 'Corresponding Author is not included in the list of authors!'
            });
        }

        let thesis = new Thesis(req.body);
        thesis = await processThesis(req, thesis);
        thesis.save(function (err) {
            if (err) {
                return res.status(400).json({
                    message: err.message,
                });
            }
            return res
                .status(200)
                .json({
                    message: 'New thesis submitted!',
                    id: thesis._id,
                });
        });
    })
}

async function processThesis(req, thesis) {
    if (req.file) {
        thesis.fileId = mongoose.Types.ObjectId(req.file.id);
        thesis.originalFileName = req.file.originalname;
    }

    try {
        await Profile.findById(thesis.correspondingAuthor, { _id: 1}, (err, profile) => {
            if (profile === null || (err && err.name === 'CastError')) {
                thesis.correspondingAuthor = req.body.correspondingAuthor;
            } else {
                thesis.correspondingAuthor = mongoose.Types.ObjectId(profile._id);
            }
        });
    } catch {}

    let authors = []
    for (const author of thesis.authors) {
        try {
            await Profile.findById(author, { _id: 1}, (err, profile) => {
                if ((err && err.name === 'CastError') || profile === null) {
                    authors.push(author);
                } else {
                    authors.push(profile._id)
                }
            });
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
exports.update =  function (req, res) {
    thesisUpload(req, res, async function (err) {
        console.log(req.body);
        if (err) {
            return res.status(err.code).json({
                message: err.field
            })
        }
        if (!req.body.authors.includes(req.body.correspondingAuthor)) {
            return res.status(400).json({
                message: 'Corresponding Author is not included in the list of authors!'
            });
        }

        Thesis.findById(req.params.id,  async function (err, thesis) {
            thesis.set(req.body);
            thesis = await processThesis(req, thesis)
            thesis.save(function (err) {
                if (err) {
                    return res.status(400).json({
                        message: err.message,
                    });
                }
                return res
                    .status(200)
                    .json({
                        message: 'Thesis updated!',
                        id: thesis._id,
                    });
            })

        })

    })
}

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
    Thesis.findById(req.params.id, {__v: 0 }, async (err, thesis) => {
        if (thesis === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Thesis ID not found!',
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        } else {
            try {
                await Profile.findById(thesis.correspondingAuthor, { _id: 1, fullName: 1}, (err, profile) => {
                    if (profile === null || (err && err.name === 'CastError')) {
                        thesis.correspondingAuthor = {
                            fullName: thesis.correspondingAuthor
                        }
                    } else {
                        thesis.correspondingAuthor = profile;
                    }
                });
            } catch {}

            let authors = []
            for (const author of thesis.authors) {
                try {
                    await Profile.findById(author, { _id: 1, fullName: 1}, (err, profile) => {
                        if (profile === null || (err && err.name === 'CastError')) {
                            authors.push({ fullName: author });
                        } else {
                            authors.push(profile);
                        }
                    });
                } catch {}
            }
            thesis.authors = authors;

            return res.status(200).json({
                message: 'Thesis details returned successfully!',
                data: thesis,
            })
        }
    })
}

/**
 * Retrieves the uploaded pdf file associated with the thesis submission.
 *
 * @param req.params.id is the ID of the thesis submission, NOT the ID of the file!
 * @param res.status.404 if there is no file associated with the thesis ID, or the thesis ID is not found.
 */
exports.viewFile = function (req, res) {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'thesesFiles'
    })
    Thesis.findById(req.params.id, {fileId: 1, originalFileName: 1}, (err, thesis) => {
        if (thesis === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Thesis ID not found',
            });
        } else if (thesis.fileId === undefined) {
            return res.status(404).json({
                message: 'There is no file associated with this Thesis ID'
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        const stream =  bucket.openDownloadStream(new mongoose.Types.ObjectId(thesis.fileId));
        stream.on('error', err => {
            if (err.code === 'ENOENT') {
                return res.status(404).json({
                    message: 'File not found'
                });
            }
            return res.status(500).json({
                message: err.message
            });
        });
        res.writeHead(200, {
            'Content-Disposition': 'filename=' + thesis.originalFileName,
        });
        stream.pipe(res);
    })
}

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
            return res.status(500).json({
                message: err.message,
            });
        }
        if (thesis.fileId) {
            const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
                bucketName: 'thesesFiles'
            })
            bucket.delete(new mongoose.Types.ObjectId(thesis.fileId), err => {
                if (err) {
                    if (err.message.startsWith('FileNotFound')) {
                        return res.status(404).json({
                            message: 'File not found'
                        });
                    }
                    return res.status(500).json({
                        message: err.message
                    });
                }
            });
        }

        Thesis.remove({ _id: thesis._id }, (err) => {
            if (err) {
                return res.status(500).json({
                    message: err.message
                });
            }
            return res.status(200).json({
                message: 'Thesis submission (and file, if uploaded) is deleted.'
            })
        });
    })
}

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