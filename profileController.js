const Profile = require('./profileModel');
const AccessControl = require('accesscontrol');
const ac = require('./auth/roles');
// Profile.createIndexes();

const baseUri = 'http://localhost:3000/api';
const publicInfo = ['fullName', 'university', 'degreeLevel', 'course', 'branch'];

/*
    GET/READ info of all users. Depending on the requester's role/privileges, the behaviour is different:
    - Verified users can see public info of all users.
    - Verifier users can see public info of all users + manuallyVerified field of users in the requester's branch
    - DataAccess users can see public info of all users + private info of users in the requester's branch
 */
exports.index = function (req, res) {
    let aggregate_options = getDefaultAggregateOptions(req);

    const aggregate = Profile.aggregate(aggregate_options);
    //Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 5;

    const options = {
        page, limit,
        customLabels: {
            totalDocs: 'totalProfiles',
            docs: 'profiles'
        }
    };

    Profile.aggregatePaginate(aggregate, options, function (err, profiles) {
        if (err) {
            return res.status(500).json({
                message: err.message
            })
        }
        profiles.profiles = profiles.profiles.map((_profile) => {
            if (_profile.branch === res.locals.oauth.token.user.branch) {
                return req.permission.filter(_profile);
            } else {
                return AccessControl.filter(_profile, publicInfo);
            }
        });
        return res.status(200).json({
            message: "Profiles retrieved successfully",
            data: profiles
        });
    });
};

/*
    GET/READ public info of all users, regardless of branch.
 */
exports.indexPublic = function (req, res) {
    let aggregate_options = getDefaultAggregateOptions(req);

    const aggregate = Profile.aggregate(aggregate_options);

    //Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 5;

    const options = {
        page, limit,
        customLabels: {
            totalDocs: 'totalProfiles',
            docs: 'profiles'
        }
    };

    Profile.aggregatePaginate(aggregate, options, function (err, profiles) {
        if (err) {
            return res.status(500).json({
                message: err.message
            })
        }
        profiles.profiles = AccessControl.filter(profiles.profiles, publicInfo);
        return res.status(200).json({
            message: "Profiles retrieved successfully",
            data: profiles
        });
    });
}

/*
    POST/CREATE new profile.
    Only dataAccess role user is allowed to perform this operation,
    and they can only create a new profile for their own branch.
 */
exports.new = function (req, res) {
    if (req.body.branch !== res.locals.oauth.token.user.branch) {
        return res.status(403).json({
            message: "You don't have enough privilege to do this action"
        });
    }
    Profile.exists({email: req.body.email}, function(err, emailExists){
        if (err) {
            return res.status(400).json({
                message: err.message,
            });
        }
        if (emailExists) {
            return res.status(409).json({
                message: "Email already registered.",
            });
        }

        let profile = new Profile(req.body);
        profile.save(function (err) {
            if (err) {
                return res.status(400).json({
                    message: err.message,
                });
            }

            return res.status(201)
                .location(baseUri + '/profiles/' + profile._id)
                .json({
                    message: 'New profile created!',
                    data: profile
                });
        })
    });
};

/*
    GET/READ private info of a user if they're in the same branch.
    Otherwise, only the public info is returned.
 */
exports.view = function (req, res) {
    Profile.findById(req.params.profile_id, {_id: 0, __v: 0}, function (err, profile) {
        if (profile === null || err && err.name === 'CastError') {
            return res.status(404).json({
                message: "Id not found"
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message
            })
        }

        let _profile;
        if (profile.branch !== res.locals.oauth.token.user.branch) {
            _profile = AccessControl.filter(profile._doc, publicInfo);
        } else {
            _profile = req.permission.filter(profile._doc);
        }

        return res.status(200).json({
            message: 'Profile details returned successfully!',
            data: _profile
        });
    });
};

/*
    GET/READ only public info of a user, regardless of branch
 */
exports.viewPublic = function (req, res) {
    Profile.findById(req.params.profile_id, function (err, profile) {
        if (profile === null || err && err.name === 'CastError') {
            return res.status(404).json({
                message: "Id not found"
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message
            })
        }

        return res.status(200).json({
            message: 'Public profile details returned successfully!',
            data: AccessControl.filter(profile._doc, publicInfo)
        });
    });
};

/*
    PATCH/UPDATE info of user. Can only be done by dataAccess role for user in their own branch.
 */
exports.update = function (req, res) {
    if(req.body.password) {
        return res.status(403).json({
            message: "You don't have enough privilege to do this action"
        });
    }

    Profile.findById(req.params.profile_id, function(err, profile) {
        if (profile === null || err && err.name === 'CastError') {
            return res.status(404).json({
                message: "Id not found"
            });
        }
        if (err) {
            return res.status(500).json({
                message: err.message
            })
        }
        if (profile.branch !== res.locals.oauth.token.user.branch) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action"
            });
        }

        Profile.findByIdAndUpdate(req.params.profile_id, req.body, {new: true}, function (err, profile) {
            if (err) {
                return res.status(500).json({
                    message: err.message
                })
            }
            return res.status(200).json({
                message: 'Profile info updated',
                data: req.permission.filter(profile._doc)
            });
        });
    });
};

/*
    DELETE a user. Can only be done by dataAccess role for user in their own branch.
 */
exports.delete = function (req, res) {
    Profile.findById(req.params.profile_id, function(err, profile) {
        if (profile === null || err && err.name === 'CastError') {
            return res.status(404).json({
                message: "Id not found"
            });
        }
        if(err) {
            return res.status(500).json({
                message: err.message
            })
        }
        if (profile.branch !== res.locals.oauth.token.user.branch) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action"
            });
        }

        Profile.findByIdAndDelete(req.params.profile_id, function (err, profile) {
            if(err) {
                return res.status(500).json({
                    message: err.message
                })
            }
            return res.status(200).json({
                message: 'Profile deleted!',
            });
        });
    });
};

/*
    GET/READ own profile info
 */
exports.viewSelf = function(req, res) {
    Profile.findById(res.locals.oauth.token.user, {password: 0}, function(err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message
            })
        }
        return res.status(200).json({
            message: 'Own profile details returned successfully',
            data: req.permission.filter(profile._doc)
        });
    });
}

/*
    PATCH/UPDATE own profile info
 */
exports.updateSelf = function(req, res) {
    if(req.body.password) {
        return res.status(400).json({
            message: "Password should not be updated using this method"
        })
    }
    Profile.findByIdAndUpdate(res.locals.oauth.token.user, req.body, {new: true}, function(err, profile) {
        if (err) {
            return res.status(500).json({
                message: err.message
            })
        }
        let filteredData = req.permission.filter(profile._doc);
        filteredData = AccessControl.filter(filteredData, ['*', '!password']);
        return res.status(200).json({
            message: 'Own profile details updated successfully',
            data: filteredData
        });
    });
}

/*
    Manually verify user
 */
exports.verify = function(req, res) {
    Profile.findById(req.params.profile_id, function(err, profile) {
        if (profile === null || err && err.name === 'CastError') {
            return res.status(404).json({
                message: "Id not found"
            });
        }
        if (err) {
            return res.status(500).json({
                message: err.message
            })
        }
        if (profile.branch !== res.locals.oauth.token.user.branch) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action"
            });
        }

        Profile.findByIdAndUpdate(req.params.profile_id, {manuallyVerified: true, role: 'verified'},  function (err, profile) {
            if (err) {
                return res.status(500).json({
                    message: err.message
                })
            }
            return res.status(200).json({
                message: 'User is now verified',
            });
        });
    });
};

exports.grantAccess = function (action) {
    return async (req, res, next) => {
        const permission = ac.can(res.locals.oauth.token.user.role)[action]('profile');
        if(!permission.granted) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action"
            });
        }
        req.permission = permission;
        return next();
    }
}

function getDefaultAggregateOptions (req) {
    let aggregate_options = [];

    //Filtering
    let match = {};
    if (req.query.full_name) {
        match.fullName = {$regex: req.query.full_name, $options: 'i'};
    }
    if (req.query.branch) {
        match.branch = {$regex: req.query.branch, $options: 'i'};
    }
    if (req.query.university) {
        match.university = {$regex: req.query.university, $options: 'i'};
    }
    if (req.query.course) {
        match.course = {$regex: req.query.course, $options: 'i'};
    }
    if (req.query.degree_level) {
        match.degreeLevel = {$regex: req.query.degree_level, $options: 'i'};
    }
    aggregate_options.push({$match: match});

    //Sorting
    if(req.query.sort) {
        let sortQueryMap = {};
        let sortQuery = req.query.sort.split(',');
        sortQuery.map(e => {
            var splitted = e.split(':');
            sortQueryMap[splitted[0]] = splitted[1];
        });
        aggregate_options.push({
            $sort: {
                "fullName": sortQueryMap["full_name"] === 'desc' ? -1 : 1,
                "branch": sortQueryMap["branch"] === 'desc' ? -1 : 1,
                "university": sortQueryMap["university"] === 'desc' ? -1 : 1,
                "course": sortQueryMap["course"] === 'desc' ? -1 : 1,
                "degreeLevel": sortQueryMap["degree_level"] === 'desc' ? -1 : 1,
            }
        })
    }

    aggregate_options.push({
        $unset: ["password"]
    });

    return aggregate_options;
}