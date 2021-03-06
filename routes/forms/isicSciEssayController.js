const mongoose = require('mongoose');
const dedent = require('dedent');
const uploadHandler = new (require(global.appRoot +
    '/config/middleware/uploadHandler'))({
    minFileSize: 1,
    maxFileSize: 5242880, // 5 mB
    acceptFileTypes: /\.(pdf)$/i, // gif, jpg, jpeg, png
});

const fs = require('fs');

const IsicSciEssayForm = mongoose.model('IsicSciEssayForm');

const mailTransporter = require(global.appRoot + '/config/nodemailer');

const ac = require(global.appRoot + '/config/roles');

/**
 * Submits ISIC SCI Essay form
 * @name POST_/api/forms/isicsciessay/submit
 * @param req.body form fields, as per schema
 * @return res.statusCode 200 if form submitted successfully
 * @return res.statusCode 400 if the same email address have submitted
 * @return res.statusCode 500 if error
 * @return res.body.message
 */
exports.new = [
    uploadHandler.postHandler.bind(uploadHandler),
    function (req, res) {
        IsicSciEssayForm.exists(
            { emailAddressMain: req.body.emailAddressMain },
            async (err, exists) => {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }

                if (exists) {
                    return res.status(400).json({
                        message: 'Form already submitted!',
                    });
                }

                // if (req.files.files.length > 0) {
                //     let file = req.files.files[0];
                //     console.log(file.errors);
                //     if (file.errors.length > 0) return res.sendStatus(400);
                //     try {
                //         fs.renameSync(
                //             file.path,
                //             global.appRoot +
                //             `/uploads/mvp-awards/supporting/${res.locals.oauth.token.user._id}.pdf`
                //         );
                //         return res.sendStatus(200);
                //     } catch {
                //         return res.sendStatus(500);
                //     }
                // }
                const form = new IsicSciEssayForm(req.body);

                mailTransporter.sendMail({
                    from:
                        'PPI UK Friendly Bot <ppiunitedkingdom@gmail.com>',
                    replyTo: 'no-reply@example.com',
                    to: req.body.emailAddressMain,
                    subject: 'PPI UK - ISIC x SCI 2021 Essay Competition',
                    text: dedent`Terima kasih telah ikut serta dalam ISIC x SCI 2021 Essay Competition. Aplikasi yang anda kirimkan telah kami terima.
                    Hormat Kami,

                    Tim ISIC x SCI 2021 Essay Competition, PPI UK`,
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
