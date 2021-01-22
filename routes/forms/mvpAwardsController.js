const mongoose = require('mongoose');
const dedent = require('dedent');
const uploadHandler = new (require(global.appRoot +
    '/config/middleware/uploadHandler'))({
    minFileSize: 1,
    maxFileSize: 5242880, // 5 mB
    acceptFileTypes: /\.(pdf)$/i, // gif, jpg, jpeg, png
});
const fs = require('fs');

const MvpAwardsForm = mongoose.model('MvpAwardsForm');
const Profile = mongoose.model('Profile');

const mailTransporter = require(global.appRoot + '/config/nodemailer');

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
    uploadHandler.postHandler.bind(uploadHandler),
    function (req, res) {
        MvpAwardsForm.findOne(
            { user: res.locals.oauth.token.user },
            async (err, form) => {
                if (err) return res.status(500).json({ message: err.message });

                if (req.files.files.length > 0) {
                    let file = req.files.files[0];
                    console.log(file.errors);
                    if (file.errors.length > 0) return res.sendStatus(400);
                    try {
                        fs.renameSync(
                            file.path,
                            global.appRoot +
                                `/uploads/mvp-awards/supporting/${res.locals.oauth.token.user._id}.pdf`
                        );
                        return res.sendStatus(200);
                    } catch {
                        return res.sendStatus(500);
                    }
                }

                if (!form)
                    form = new MvpAwardsForm({
                        user: res.locals.oauth.token.user,
                    });
                else if (form.submitted)
                    return res.status(400).json({
                        message: 'Form already submitted!',
                    });

                form.submitterType = req.body.submitterType;
                form.nominatedUser =
                    req.body.submitterType == 'Nominator'
                        ? req.body.nominatedUser
                        : res.locals.oauth.token.user;
                form.areaOfStudy = req.body.areaOfStudy;
                form.awardTypes = req.body.awardTypes;
                form.awardIndicators = req.body.awardIndicators;
                form.statement = req.body.statement;
                form.submitted = req.body.submitted;

                if (req.body.submitted)
                    mailTransporter.sendMail({
                        from:
                            'PPI UK Friendly Bot <ppiunitedkingdom@gmail.com>',
                        replyTo: 'no-reply@example.com',
                        to: res.locals.oauth.token.user.email,
                        subject: 'PPI UK - MVP Awards',
                        body: dedent`Terima kasih telah ikut serta dalam The MVP Awards. Aplikasi yang anda kirimkan telah kami terima. Pengumuman selanjutnya akan anda terima pada tanggal 7 Maret 2021

                        Hormat Kami, 
                        
                        Tim The MVP Awards, PPI UK`,
                    });

                form.save()
                    .then(() => res.status(200).json({ message: 'Form saved' }))
                    .catch((err) =>
                        res.status(500).json({ message: err.message })
                    );
            }
        );
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
