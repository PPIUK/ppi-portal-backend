const mongoose = require('mongoose');

const Profile = mongoose.model('Profile')
const MvpAwardsForm = mongoose.model('MvpAwardsForm');

/**
 * Retrieves form submission of a user
 * @name GET_/api/forms/mvpawards/submissions/:user_id
 * @param req.params.user_id id of submitter of the requested form
 * @return res.statusCode 200 if form retrieved successfully
 * @return res.statusCode 404 if form submitted not found
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data all form fields of the requested form submission
 */
exports.view = function (req, res) {
    MvpAwardsForm.findOne({user: req.params.user_id}, function (err, form) {
        if (form === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: `Form submitted by user ${req.params.user_id} not found`,
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

/**
 * Retrieves the names and IDs of all form submitters
 * @name GET_/api/forms/mvpawards/submissions/all
 * @return res.statusCode 200 if names and IDs retrieved successfully
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data an array of {_id: ,fullName: } of the form submitters
 */
exports.index = function (req, res) {
    MvpAwardsForm.find({}, 'user')
        .populate('user', 'fullName')
        .exec(function(err, forms) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            return res.status(200).json({
                message: 'Form submitters returned successfully!',
                data: forms.map(form => {return form.user}),
            })
        });
}

/**
 * Retrieves the user's form submission.
 * @name GET_/api/forms/mvpawards/edit
 * @return res.statusCode 200 if form retrieved successfully, or no form is there yet
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data the form fields, or null if no form is there yet
 */
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

/**
 * Submits MVP Awards form
 * @name POST_/api/forms/mvpawards/edit
 * @param req.body form fields, as per schema
 * @return res.statusCode 200 if form submitted successfully
 * @return res.statusCode 400 if 'submitted' form field is true
 * @return res.statusCode 404 if profile id not found
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.newSelf = function (req, res) {
    Profile.findById(res.locals.oauth.token.user, function (err, profile) {
        if (profile === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: `Profile id ${res.locals.oauth.token.user} not found`,
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        let form = new MvpAwardsForm(req.body);
        if (form.submitted === true) {
            return res.status(400).json({
                message: 'Submitted field should not be true',
            });
        }
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
