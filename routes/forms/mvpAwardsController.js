const mongoose = require('mongoose');

const Profile = mongoose.model('Profile')
const MvpAwardsForm = mongoose.model('MvpAwardsForm');

exports.view = function (req, res) {
    MvpAwardsForm.findOne({user: req.params.user_id}, function (err, form) {
        if (form === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Form submitted by user not found',
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        return res.status(200).json({
            message: 'Form returned successfully!',
            data: form,
        })
    });
}

exports.index = function (req, res) {
    MvpAwardsForm.find({}, 'user')
        // .populate('user', 'fullName')
        .exec(function(err, forms) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            return res.status(200).json({
                message: 'Forms returned successfully!',
                data: forms,
            })
        });
}

exports.viewSelf = function (req, res) {
    MvpAwardsForm.findOne({user: res.locals.oauth.token.user}, function (err, form) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        return res.status(200).json({
            message: 'Form returned successfully!',
            data: form,
        })
    });
}

exports.newSelf = function (req, res) {
    Profile.findById(res.locals.oauth.token.user, function (err, profile) {
        if (profile === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: 'Profile id not found',
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        let form = new MvpAwardsForm(req.body);
        form.set('user', profile)
        form.save(function (err) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            return res
                .status(200)
                .json({
                    message: 'Form submitted!',
                });
        });
    })
}
