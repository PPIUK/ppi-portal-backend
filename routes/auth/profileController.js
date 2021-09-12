const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');

const Profile = mongoose.model('Profile');
const AccessControl = require('accesscontrol');
const ac = require(global.appRoot + '/config/roles');
const utils = require('../utils');
const allowedDomains = require('../../data/uniemails.json');

const publicInfo = [
    '_id',
    'fullName',
    'university',
    'degreeLevel',
    'faculty',
    'course',
    'branch',
    'profilePicture',
];

const profileFilesStorage = new GridFsStorage({
    url: process.env.DBURL,
    file: (req, file) => {
        return new Promise((resolve) => {
            const filename = file.originalname;
            const fileInfo = {
                filename: filename,
                bucketName: 'profilefiles',
            };
            resolve(fileInfo);
        });
    },
});

exports.profileFilesStorage = profileFilesStorage;

const profileFilesUpload = multer({
    storage: profileFilesStorage,
}).fields([
    { name: 'studentProof', maxCount: 1 },
    { name: 'profilePicture', maxCount: 1 },
]);

exports.profileFilesUpload = profileFilesUpload;

/**
 * Gets info of all users. Depending on the requester's role/privileges, the behaviour is different:
     - Verified users can see public info of all users.
     - Verifier users can see public info of all users + role field of users in the requester's branch
     - DataAccess users can see public info of all users + private info of users in the requester's branch
 * @name GET_/api/profiles
 * @param req.query.full_name filter by name
 * @param req.query.branch filter by branch
 * @param req.query.branch filter by branch
 * @param req.query.university filter by university
 * @param req.query.course filter by course
 * @param req.query.faculty filter by faculty
 * @param req.query.degree_level filter by degree level
 * @param req.query.paginate true if wants to enable pagination, false if wants to retrieve all data (default is false)
 * @param req.query.sort field:asc/desc
 * @param req.query.page current page
 * @param req.query.limit number of documents per page
 * @return res.statusCode 200 if successful
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data profiles
 */
exports.index = function (req, res) {
    const { aggregate, options } = getDefaultAggregateOptions(req);

    Profile.aggregatePaginate(aggregate, options, function (err, profiles) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        profiles.profiles = profiles.profiles.map((_profile) => {
            if (_profile.studentProof) {
                _profile.studentProof = _profile.studentProof.toString();
            }
            if (
                _profile.branch === res.locals.oauth.token.user.branch ||
                res.locals.oauth.token.user.branch === 'All'
            ) {
                return req.permission.filter(_profile);
            } else {
                return AccessControl.filter(_profile, publicInfo);
            }
        });
        return res.status(200).json({
            message: 'Profiles retrieved successfully',
            data: profiles,
        });
    });
};

/**
 * Gets public info ('fullName', 'university', 'degreeLevel', 'faculty', 'course', 'branch') of all users, regardless of branch.
 * @name GET_/api/profiles/public
 * @param req.query.full_name filter by name
 * @param req.query.branch filter by branch
 * @param req.query.branch filter by branch
 * @param req.query.university filter by university
 * @param req.query.course filter by course
 * @param req.query.faculty filter by faculty
 * @param req.query.degree_level filter by degree level
 * @param req.query.paginate true if wants to enable pagination, false if wants to retrieve all data (default is false)
 * @param req.query.sort field:asc/desc
 * @param req.query.page current page
 * @param req.query.limit number of documents per page
 * @return res.statusCode 200 if successful
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data public info of profiles
 */
exports.indexPublic = function (req, res) {
    const { aggregate, options } = getDefaultAggregateOptions(req);

    Profile.aggregatePaginate(aggregate, options, function (err, profiles) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        profiles.profiles = AccessControl.filter(profiles.profiles, publicInfo);
        return res.status(200).json({
            message: 'Profiles retrieved successfully',
            data: profiles,
        });
    });
};

/**
 * Creates new profile.
 * Only dataAccess role user is allowed to perform this operation,
 * and they can only create a new profile for their own branch.
 * @name POST_/api/profiles
 * @param req.body all required fields of a profile
 * @return res.statusCode 201 if successful
 * @return res.statusCode 403 if caller doesn't have privilege
 * @return res.statusCode 409 if user already exists
 * @return res.statusCode 400 if not all fields are filled, or other errors
 * @return res.location location of the newly created resource/profile
 * @return res.body.message
 * @return res.body.data profile that was created
 */
exports.new = function (req, res) {
    if (
        req.body.branch !== res.locals.oauth.token.user.branch &&
        res.locals.oauth.token.user.branch !== 'All'
    ) {
        return res.status(403).json({
            message: "You don't have enough privilege to do this action",
        });
    }

    profileFilesUpload(req, res, async function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }

        Profile.exists({ email: req.body.email }, function (err, emailExists) {
            if (err) {
                return res.status(400).json({
                    message: err.message,
                });
            }
            if (emailExists) {
                return res.status(409).json({
                    message: 'Email already registered.',
                });
            }

            let profile = new Profile(req.body);

            profile = saveFileId(req, profile);

            profile.save(function (err) {
                if (err) {
                    return res.status(400).json({
                        message: err.message,
                    });
                }

                return res
                    .status(201)
                    .location(process.env.BASE_URI + '/profiles/' + profile._id)
                    .json({
                        message: 'New profile created!',
                        data: profile,
                    });
            });
        });
    });
};

function saveFileId(req, profile) {
    if (req.files) {
        if ('studentProof' in req.files) {
            profile.studentProof = mongoose.Types.ObjectId(
                req.files['studentProof'][0].id
            );
        }
        if ('profilePicture' in req.files) {
            profile.profilePicture = mongoose.Types.ObjectId(
                req.files['profilePicture'][0].id
            );
        }
    }
    return profile;
}

/**
 * Gets private info of a user if the requester have dataAccess role and is in the same branch as the requested user.
 * Otherwise, only the public info is returned.
 * @name GET_/api/profiles/:profile_id
 * @param req.params.profile_id id of the requested profile
 * @return res.statusCode 200 if profile retrieved successfully
 * @return res.statusCode 404 if profile with the id is not found
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data requested profile
 */
exports.view = function (req, res) {
    Profile.findById(
        req.params.profile_id,
        { _id: 0, __v: 0 },
        function (err, profile) {
            if (profile === null || (err && err.name === 'CastError')) {
                return res.status(404).json({
                    message: 'Id not found',
                });
            } else if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            let _profile;
            if (
                profile.branch === res.locals.oauth.token.user.branch ||
                res.locals.oauth.token.user.branch === 'All'
            ) {
                _profile = req.permission.filter(profile._doc);
                if (profile.studentProof) {
                    _profile.studentProof = profile.studentProof.toString();
                }
            } else {
                _profile = AccessControl.filter(profile._doc, publicInfo);
            }

            return res.status(200).json({
                message: 'Profile details returned successfully!',
                data: _profile,
            });
        }
    );
};

/**
 * Gets only public info of a user, regardless of branch.
 * @name GET_/api/profiles/:profile_id/public
 * @param req.params.profile_id id of the requested profile
 * @return res.statusCode 200 if public profile retrieved successfully
 * @return res.statusCode 404 if profile with the id is not found
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data public info of the profile
 */
exports.viewPublic = function (req, res) {
    Profile.findById(req.params.profile_id, function (err, profile) {
        if (profile === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Id not found',
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        return res.status(200).json({
            message: 'Public profile details returned successfully!',
            data: AccessControl.filter(profile._doc, publicInfo),
        });
    });
};

/**
 * Updates info a user. Can only be done by dataAccess role for user in their own branch.
 * @name PATCH_/api/profiles/:profile_id
 * @param req.params.profile_id id of the to-be-updated profile
 * @param req.body profile fields to update and their values
 * @return res.statusCode 200 if profile is updated successfully
 * @return res.statusCode 403 if user tries to update password or profile in other branch
 * @return res.statusCode 404 if profile not found
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data the newly updated profile
 */
exports.update = function (req, res) {
    if (req.body.password) {
        return res.status(403).json({
            message: "You don't have enough privilege to do this action",
        });
    }

    profileFilesUpload(req, res, async function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }

        Profile.findById(req.params.profile_id, function (err, profile) {
            if (profile === null || (err && err.name === 'CastError')) {
                return res.status(404).json({
                    message: 'Id not found',
                });
            }
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            // FIXME: the two if statements below prohibit almost any update to be done really, only 'All' branch can update and it can only update profile in the same branch
            if (
                profile.branch !== res.locals.oauth.token.user.branch &&
                res.locals.oauth.token.user.branch !== 'All'
            ) {
                return res.status(403).json({
                    message:
                        "You don't have enough privilege to do this action",
                });
            }
            if (
                req.body.branch &&
                req.body.branch !== profile.branch &&
                res.locals.oauth.token.user.branch !== 'All'
            ) {
                return res.status(403).json({
                    message:
                        "You don't have enough privilege to do this action",
                });
            }

            req.body = saveFileId(req, req.body);

            Profile.findByIdAndUpdate(
                req.params.profile_id,
                req.body,
                { new: true },
                function (err, profile) {
                    if (err) {
                        return res.status(500).json({
                            message: err.message,
                        });
                    }
                    if (profile.studentProof) {
                        profile._doc.studentProof = profile.studentProof.toString();
                    }
                    return res.status(200).json({
                        message: 'Profile info updated',
                        data: req.permission.filter(profile._doc),
                    });
                }
            );
        });
    });
};

/**
 * Deletes a profile. Can only be done by dataAccess role for user in their own branch.
 * @name DELETE_/api/profiles/:profile_id
 * @param req.params.profile_id id of the to-be-deleted profile
 * @return res.statusCode 200 if the profile is deleted successfully
 * @return res.statusCode 404 if profile not found
 * @return res.statusCode 403 if requester doesn't have enough privilege (not dataAccess user or trying to delete user outside of their branch)
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.delete = function (req, res) {
    Profile.findById(req.params.profile_id, function (err, profile) {
        if (profile === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Id not found',
            });
        }
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (
            profile.branch !== res.locals.oauth.token.user.branch &&
            res.locals.oauth.token.user.branch !== 'All'
        ) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }

        Profile.findByIdAndDelete(req.params.profile_id, function (err) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            const bucket = new mongoose.mongo.GridFSBucket(
                mongoose.connection.db,
                {
                    bucketName: 'profilefiles',
                }
            );

            if (profile.studentProof) {
                deleteFileFromBucket(bucket, profile.studentProof, res);
            }
            if (profile.profilePicture) {
                deleteFileFromBucket(bucket, profile.profilePicture, res);
            }

            return res.status(200).json({
                message: 'Profile deleted!',
            });
        });
    });
};

function deleteFileFromBucket(bucket, attribute, res) {
    bucket.delete(new mongoose.Types.ObjectId(attribute), (err) => {
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
    });
}

/**
 * Gets own profile info. Can also be called by basic role.
 * @name GET_/api/profiles/me
 * @return res.status 200 if own profile retrieved successfully
 * @return res.status 500 if error
 * @return res.body.message
 * @return res.body.data own profile details (not including password)
 */
exports.viewSelf = function (req, res) {
    Profile.findById(
        res.locals.oauth.token.user,
        { password: 0, __v: 0 },
        function (err, profile) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }
            profile._doc._id = profile._id.toString();
            if (profile.studentProof) {
                profile._doc.studentProof = profile.studentProof.toString();
            }
            return res.status(200).json({
                message: 'Own profile details returned successfully',
                data: req.permission.filter(profile._doc),
            });
        }
    );
};

/**
 * Updates own profile info. Can also be called by basic role.
 * @name PATCH_/api/profiles/me
 * @param req.body profile fields to be updated
 * @return res.statusCode 200 if profile updated successfully
 * @return res.statusCode 400 if password is tried to be updated
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data the newly updated profile
 */
exports.updateSelf = function (req, res) {
    profileFilesUpload(req, res, async function (err) {
        if (err) {
            return res.status(err.code).json({
                message: err.field,
            });
        }

        req.body = saveFileId(req, req.body);

        if (req.body.password) {
            return res.status(400).json({
                message: 'Password should not be updated using this method',
            });
        }

        if (!allowedDomains.includes(req.body.email.match(/@(.*)/)[1]))
            return res.status(400).json({
                message: 'Email is not allowed',
            });

        // cannot update own roles, wouldn't happen unless someone
        // crafted their own request hence the cheeky response
        if (req.body.roles) {
            return res.status(400).json({
                message: 'Nice try :)',
            });
        }

        // cannot set own branch to 'All'
        if (
            req.body.branch === 'All' &&
            res.locals.oauth.token.user.branch !== 'All'
        )
            return res.status(400).json({
                message: 'Cannot set own branch to All',
            });

        // check for priviliged roles, these are untransferrable
        const disallowedRoles = ['dataAccess', 'verifier'];
        if (
            req.body.branch &&
            req.body.branch !== res.locals.oauth.token.user.branch
        ) {
            for (let role of res.locals.oauth.token.user.roles) {
                if (disallowedRoles.includes(role))
                    return res.status(400).json({
                        message:
                            'Cannot transfer branches with privileged roles. Please have them removed first.',
                    });
            }
        }

        Profile.findByIdAndUpdate(
            res.locals.oauth.token.user,
            req.body,
            { new: true },
            function (err, profile) {
                if (err) {
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                if (req.body.studentProof) {
                    profile._doc.studentProof = req.body.studentProof.toString();
                }
                if (req.body.profilePicture) {
                    profile._doc.profilePicture = req.body.profilePicture.toString();
                }
                let filteredData = req.permission.filter(profile._doc);
                filteredData = AccessControl.filter(filteredData, [
                    '*',
                    '!password',
                ]);
                return res.status(200).json({
                    message: 'Own profile details updated successfully',
                    data: filteredData,
                });
            }
        );
    });
};

/**
 * Manually verify user (i.e. change role of user to 'verified').
 * Can only be done by verifier and dataAccess roles.
 * @name PATCH_/api/profiles/:profile_id/verify
 * @param req.params.profile_id id of the to-be-verified profile
 * @return res.statusCode 200 if profile verified successfully
 * @return res.statusCode 404 if profile not found
 * @return res.statusCode 403 if requester doesn't have privilege
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.verify = function (req, res) {
    Profile.findById(req.params.profile_id, function (err, profile) {
        if (profile === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Id not found',
            });
        }
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
        if (
            profile.branch !== res.locals.oauth.token.user.branch &&
            res.locals.oauth.token.user.branch !== 'All'
        ) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }

        Profile.findByIdAndUpdate(
            req.params.profile_id,
            { $push: { roles: 'verified' } },
            function (err) {
                if (err) {
                    return res.status(500).json({
                        message: err.message,
                    });
                }
                return res.status(200).json({
                    message: 'User is now verified',
                });
            }
        );
    });
};

/**
 * Gets own student proof file.
 * @name GET_/api/profiles/me/studentproof
 * @return res.status 200 if own student proof file retrieved successfully
 * @return res.status 404 if there is no student proof file uploaded
 * @return res.status 500 if error
 * @return stream student proof file
 */
exports.viewOwnStudentProofFile = function (req, res) {
    Profile.findById(
        res.locals.oauth.token.user,
        { studentProof: 1 },
        (err, profile) => {
            utils.sendFile('studentProof', 'profilefiles', profile, err, res);
        }
    );
};

/**
 * Gets student proof file of the specified profile id.
 * @name GET_/api/profiles/:profile_id/studentproof
 * @return res.status 200 if student proof file retrieved successfully
 * @return res.status 403 if caller has no privilege to do this action
 * @return res.status 404 if there is no student proof file uploaded for the profile id
 * @return res.status 500 if error
 * @return stream student proof file
 */
exports.viewStudentProofFile = function (req, res) {
    Profile.findById(
        req.params.profile_id,
        { studentProof: 1, branch: 1 },
        (err, profile) => {
            if (
                !res.locals.oauth.token.user.roles.includes('verifier') &&
                !res.locals.oauth.token.user.roles.includes('dataAccess')
            ) {
                return res.status(403).json({
                    message:
                        "You don't have enough privilege to do this action",
                });
            } else if (
                profile.branch !== res.locals.oauth.token.user.branch &&
                res.locals.oauth.token.user.branch !== 'All'
            ) {
                return res.status(403).json({
                    message:
                        "You don't have enough privilege to do this action",
                });
            }
            utils.sendFile('studentProof', 'profilefiles', profile, err, res);
        }
    );
};

/**
 * Gets own profile picture file.
 * @name GET_/api/profiles/me/profilepicture
 * @return res.status 200 if own profile picture file retrieved successfully
 * @return res.status 404 if there is no profile picture file uploaded
 * @return res.status 500 if error
 * @return stream profile picture file
 */
exports.viewOwnProfilePictureFile = function (req, res) {
    Profile.findById(
        res.locals.oauth.token.user,
        { profilePicture: 1 },
        (err, profile) => {
            utils.sendFile('profilePicture', 'profilefiles', profile, err, res);
        }
    );
};

/**
 * Gets profile picture file of the specified profile id.
 * @name GET_/api/profiles/:profile_id/profilepicture
 * @return res.status 200 if profile picture file retrieved successfully
 * @return res.status 403 if caller has no privilege to do this action
 * @return res.status 404 if there is no profile picture file uploaded for the profile id
 * @return res.status 500 if error
 * @return stream profile picture file
 */
exports.viewProfilePictureFile = function (req, res) {
    Profile.findById(
        req.params.profile_id,
        { profilePicture: 1 },
        (err, profile) => {
            utils.sendFile('profilePicture', 'profilefiles', profile, err, res);
        }
    );
};

// TODO: document
exports.search = {
    nameLookup: (req, res) => {
        Profile.find(
            { fullName: { $regex: req.query.name, $options: 'i' } },
            (err, profiles) => {
                if (err) return res.status(500).json({ message: err.message });

                profiles.forEach(
                    (profile) => (profile._doc._id = profile._id.toString())
                );

                return res.status(200).json({
                    message: 'Name lookup successful',
                    data: profiles.map((profile) =>
                        req.permission.filter(profile._doc)
                    ),
                });
            }
        );
    },
};

/**
 * Find permission for the requested action and role
 * @param action
 */
exports.grantAccess = function (action) {
    return async (req, res, next) => {
        const permission = ac
            .can(res.locals.oauth.token.user.roles)
            [action]('profile');
        if (!permission.granted) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }
        req.permission = permission;
        return next();
    };
};

/**
 * Aggregate options, such as filtering and sorting
 */
function getDefaultAggregateOptions(req) {
    let aggregate_options = [];

    //Filtering
    let match = {};
    if (req.query.full_name) {
        match.fullName = { $regex: req.query.full_name, $options: 'i' };
    }
    if (req.query.branch) {
        match.branch = { $regex: req.query.branch, $options: 'i' };
    }
    if (req.query.university) {
        match.university = { $regex: req.query.university, $options: 'i' };
    }
    if (req.query.course) {
        match.course = { $regex: req.query.course, $options: 'i' };
    }
    if (req.query.faculty) {
        match.faculty = { $regex: req.query.faculty, $options: 'i' };
    }
    if (req.query.degree_level) {
        match.degreeLevel = { $regex: req.query.degree_level, $options: 'i' };
    }
    aggregate_options.push({ $match: match });

    //Sorting
    if (req.query.sort) {
        let sortQueryMap = {};
        let sortQuery = req.query.sort.split(',');
        sortQuery.map((e) => {
            var splitted = e.split(':');
            sortQueryMap[splitted[0]] = splitted[1];
        });
        let sort = {};
        if (sortQueryMap['full_name']) {
            sort.fullName = sortQueryMap['full_name'] === 'desc' ? -1 : 1;
        }
        if (sortQueryMap['branch']) {
            sort.branch = sortQueryMap['branch'] === 'desc' ? -1 : 1;
        }
        if (sortQueryMap['university']) {
            sort.university = sortQueryMap['university'] === 'desc' ? -1 : 1;
        }
        if (sortQueryMap['faculty']) {
            sort.faculty = sortQueryMap['faculty'] === 'desc' ? -1 : 1;
        }
        if (sortQueryMap['course']) {
            sort.course = sortQueryMap['course'] === 'desc' ? -1 : 1;
        }
        if (sortQueryMap['degree_level']) {
            sort.degreeLevel = sortQueryMap['degreeLevel'] === 'desc' ? -1 : 1;
        }
        aggregate_options.push({ $sort: sort });
    }

    aggregate_options.push({
        $unset: ['password'],
    });

    aggregate_options.push({
        $addFields: {
            _id: {
                $toString: '$_id',
            },
        },
    });

    const aggregate = Profile.aggregate(aggregate_options);

    //Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 5;
    let pagination = req.query.paginate === 'true' || false;

    let options = {
        pagination,
        customLabels: {
            totalDocs: 'totalProfiles',
            docs: 'profiles',
        },
    };

    if (pagination === true) {
        options.page = page;
        options.limit = limit;
    }

    return { aggregate, options };
}
