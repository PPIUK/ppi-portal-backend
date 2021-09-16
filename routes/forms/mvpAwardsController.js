const mongoose = require('mongoose');
const fs = require('fs');

const MvpAwardsForm = mongoose.model('MvpAwardsForm');

const ac = require(global.appRoot + '/config/roles');

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
    MvpAwardsForm.findOne({ user: req.params.user_id }, function (err, form) {
        if (form === null || (err && err.name === 'CastError')) {
            return res.status(404).json({
                message: `Form submitted by user ${req.params.user_id} not found`,
            });
        } else if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        if (req.query.file)
            if (
                fs.existsSync(
                    global.appRoot +
                        `/uploads/mvp-awards/supporting/${req.params.user_id}.pdf`
                )
            ) {
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': 'attachment; filename=CV.pdf',
                    'Content-Transfer-Encoding': 'binary',
                });
                return res.end(
                    fs.readFileSync(
                        global.appRoot +
                            `/uploads/mvp-awards/supporting/${req.params.user_id}.pdf`
                    )
                );
            } else return res.status(404);

        return res.status(200).json({
            message: 'Form returned successfully!',
            data: form,
        });
    });
};

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
        .exec(function (err, forms) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            return res.status(200).json({
                message: 'Form submitters returned successfully!',
                data: forms.map((form) => {
                    return form.user;
                }),
            });
        });
};

/**
 * Retrieves the user's form submission.
 * @name GET_/api/forms/mvpawards/edit
 * @return res.statusCode 200 if form retrieved successfully, or no form is there yet
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data the form fields, or null if no form is there yet
 */
exports.viewSelf = function (req, res) {
    MvpAwardsForm.findOne(
        { user: res.locals.oauth.token.user },
        function (err, form) {
            if (err) {
                return res.status(500).json({
                    message: err.message,
                });
            }

            return res.status(200).json({
                message: form
                    ? 'Form returned successfully!'
                    : 'Form does not exist',
                data: form,
            });
        }
    );
};

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
exports.upsertSelf = [
    function (req, res) {
        return res.sendStatus(400);
    },
];

/**
 * Find permission for the requested action and role
 * @param action
 */
exports.grantAccess = function (action) {
    return async (req, res, next) => {
        const permission = ac
            .can(res.locals.oauth.token.user.roles)
            [action]('mvpAwardForm');
        if (!permission.granted) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }
        req.permission = permission;
        return next();
    };
};
