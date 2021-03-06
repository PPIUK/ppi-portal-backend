const mongoose = require('mongoose');
const dedent = require('dedent');
const path = require("path");
const uploadHandler = new (require(global.appRoot +
    '/config/middleware/uploadHandler'))({
    minFileSize: 1,
    maxFileSize: 5242880, // 5 mB
    acceptFileTypes: /\.(doc|docx|gif|jpe?g|png)$/i, // gif, jpg, jpeg, png
});

const fs = require('fs');

const IsicSciEssayForm = mongoose.model('IsicSciEssayForm');

const mailTransporter = require(global.appRoot + '/config/nodemailer');

const ac = require(global.appRoot + '/config/roles');

/**
 * Retrieves the names and IDs of all form submitters
 * @name GET_/api/forms/isicsciessay/submissions/all
 * @return res.statusCode 200 if forms successfully
 * @return res.statusCode 500 if error
 * @return res.body.message
 * @return res.body.data an array of {_id: ,fullName: } of the form submitters
 */
exports.index = function (req, res) {
    IsicSciEssayForm.find({}, function (err, forms) {
        if (err) {
            return res.status(500).json({
                message: err.message,
            });
        }

        return res.status(200).json({
            message: 'Forms returned successfully!',
            data: forms
        })

    });
};



/**
 * Uploads ISIC SCI Essay abstract
 * @name POST_/api/forms/isicsciessay/:id/abstract
 * @param req.body abstract file
 * @param req.params.id submission id
 * @return res.statusCode 200 if abstract uploaded successfully
 * @return res.statusCode 400 if there are file errors
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.uploadAbstract = [
    uploadHandler.postHandler.bind(uploadHandler),
    function (req, res) {
        IsicSciEssayForm.findById(req.params.id, async (err, form) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!form) {
                return res.status(404).json({ message: 'Submission ID not found!' });
            }

            if (req.files.files.length > 0) {
                let file = req.files.files[0];
                if (file.errors.length > 0) return res.sendStatus(400);
                try {
                    const filename = ['/', form.topic, '_', form.title.split(' ').join('_'), '_', req.params.id, path.extname(file.path)].join('')
                    fs.renameSync(
                        file.path,
                        global.appRoot +
                        path.join('/uploads', '/isic-sci', '/abstracts', filename)
                    );
                    return res.sendStatus(200);
                } catch (error) {
                    console.log(error)
                    return res.sendStatus(500);
                }
            }
        })
    }
]

/**
 * Uploads ISIC SCI Essay participant Student ID
 * @name POST_/api/forms/isicsciessay/:submissionId/studentID/:no
 * @param req.body student id file
 * @param req.params.id submission id
 * @param req.params.no author no (1 or 2)
 * @return res.statusCode 200 if student ID uploaded successfully
 * @return res.statusCode 400 if there are file errors
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.uploadStudentID = [
    uploadHandler.postHandler.bind(uploadHandler),
    function (req, res) {
        if (req.files.files.length > 0) {
            let file = req.files.files[0];
            if (file.errors.length > 0) return res.sendStatus(400);
            try {
                const filename = ['/', req.params.id, '_StudentID_', req.params.no, path.extname(file.path)].join('')
                fs.renameSync(
                    file.path,
                    global.appRoot +
                    path.join('/uploads', '/isic-sci', '/IDs', filename)
                );
                return res.sendStatus(200);
            } catch (error) {
                console.log(error)
                return res.sendStatus(500);
            }
        }
    }
]

/**
 * Uploads ISIC SCI Essay participant KTP/Passport
 * @name POST_/api/forms/isicsciessay/:submissionId/ktp/:no
 * @param req.body ktp/passport file
 * @param req.params.id submission id
 * @param req.params.no author no (1 or 2)
 * @return res.statusCode 200 if student ID uploaded successfully
 * @return res.statusCode 400 if there are file errors
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.uploadKTP = [
    uploadHandler.postHandler.bind(uploadHandler),
    function (req, res) {
        if (req.files.files.length > 0) {
            let file = req.files.files[0];
            if (file.errors.length > 0) return res.sendStatus(400);
            try {
                const filename = ['/', req.params.id, '_KTP_Passport_', req.params.no, path.extname(file.path)].join('')
                fs.renameSync(
                    file.path,
                    global.appRoot +
                    path.join('/uploads', '/isic-sci', '/IDs', filename)
                );
                return res.sendStatus(200);
            } catch (error) {
                console.log(error)
                return res.sendStatus(500);
            }
        }
    }
]

/**
 * Submits ISIC SCI Essay form
 * @name POST_/api/forms/isicsciessay/submit
 * @param req.body form fields, as per schema
 * @return res.statusCode 200 if form submitted successfully
 * @return res.statusCode 400 if the same email address have submitted
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.new =
    function (req, res) {
        IsicSciEssayForm.findOne(
            { emailAddressMain: req.body.emailAddressMain },
            async (err, form) => {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }

                if (form && form.abstractSubmitted) {
                    return res.status(400).json({
                        message: 'This email address has already submitted the form before!',
                    });
                }

                if (!form) {
                    form = new IsicSciEssayForm(req.body);
                }
                form.abstractSubmitted = req.body.abstractSubmitted;

                if (req.body.abstractSubmitted) {
                    mailTransporter.sendMail({
                        from:
                            'PPI UK Friendly Bot <ppiunitedkingdom@gmail.com>',
                        replyTo: 'no-reply@example.com',
                        to: req.body.emailAddressMain,
                        subject: 'ISIC x SCI 2021 Essay Competition',
                        text: dedent`Thank you for participating in ISIC x SCI 2021 Essay Competition. 
                    We have received the abstract that you submitted, with ${form.name1} as the main author.
                        
                    This is your submission ID: ${form.id}. 
                    Please keep it safe because you will need it again when you submit your full essay.
                        
                    Best regards,

                    ISIC x SCI 2021 Essay Competition Committee`,
                    });
                }

                form.save()
                    .then(() => res.status(200).json({ submissionId: form.id, message: 'Form saved' }))
                    .catch((err) =>
                        res.status(500).json({ message: err.message })
                    );
            }
        );
    };

/**
 * Find permission for the requested action and role
 * @param action
 */
exports.grantAccess = function (action) {
    return async (req, res, next) => {
        const permission = ac
            .can(res.locals.oauth.token.user.roles)
            [action]('isicSciEssayForm');
        if (!permission.granted) {
            return res.status(403).json({
                message: "You don't have enough privilege to do this action",
            });
        }
        req.permission = permission;
        return next();
    };
};
