// Filename: api-routes.js

const { get } = require('mongoose');

module.exports = (app) => {
    // Initialize express router
    let router = require('express').Router();
    // Set default API response
    router.get('/', function (req, res) {
        res.json({
            status: 'API Its Working',
            message: 'Welcome to RESTHub crafted with love!',
        });
    });

    var profileController = require('./auth/profileController');
    router
        .route('/profiles')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readAny'),
            profileController.index
        )
        .post(
            app.oauth.authenticate(),
            profileController.grantAccess('createAny'),
            profileController.new
        );
    router
        .route('/profiles/search/name')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readAny'),
            profileController.search.nameLookup
        );

    //Do we need the below endpoint?
    router
        .route('/profiles/public')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readAny'),
            profileController.indexPublic
        );
    router
        .route('/profiles/me')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readOwn'),
            profileController.viewSelf
        )
        .patch(
            app.oauth.authenticate(),
            profileController.grantAccess('updateOwn'),
            profileController.updateSelf
        );
    router
        .route('/profiles/:profile_id')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readAny'),
            profileController.view
        )
        .patch(
            app.oauth.authenticate(),
            profileController.grantAccess('updateAny'),
            profileController.update
        )
        // .put(app.oauth.authenticate(),
        //      profileController.grantAccess('readAny'),
        //      profileController.update)
        .delete(
            app.oauth.authenticate(),
            profileController.grantAccess('deleteAny'),
            profileController.delete
        );
    router
        .route('/profiles/:profile_id/public')
        .get(app.oauth.authenticate(), profileController.viewPublic);
    router
        .route('/profiles/:profile_id/verify')
        .patch(
            app.oauth.authenticate(),
            profileController.grantAccess('updateAny'),
            profileController.verify
        );

    let publicController = require('./publicController');
    router.route('/public/members/uni').get(publicController.memberSummaryUni);
    router
        .route('/public/members/branch')
        .get(publicController.memberSummaryBranch);

    var authController = require('./auth/authController');
    router.route('/auth/register').post(authController.register);
    router.route('/auth/register/new').post(authController.registerNew);
    router.route('/auth/set-password').post(authController.setPassword);
    router
        .route('/auth/resend-verification')
        .post(authController.resendVerificationEmail);
    router.route('/auth/verify-email/:token').get(authController.verifyEmail);
    router.route('/auth/login').post(authController.login, app.oauth.token());
    router
        .route('/auth/logout')
        .post(app.oauth.authenticate(), authController.logout);
    router.route('/auth/account-lookup').post(authController.accountLookup);
    router.route('/auth/token').post(app.oauth.token());
    router.route('/auth/forgot').post(authController.forgotPassword);
    router
        .route('/auth/reset-password/:token')
        .get(authController.allowResetPassword)
        .post(authController.resetPassword);
    router.route('/auth/authorize').post(app.oauth.authorize({
        authenticateHandler: {
            handle: req => {
                return req.body.user
            }
        }
    }))

    let mvpAwardsController = require('./forms/mvpAwardsController');
    router
        .route('/forms/mvpawards/submissions/all')
        .get(
            app.oauth.authenticate(),
            mvpAwardsController.grantAccess('readAny'),
            mvpAwardsController.index
        );
    router
        .route('/forms/mvpawards/submissions/:user_id')
        .get(
            app.oauth.authenticate(),
            mvpAwardsController.grantAccess('readAny'),
            mvpAwardsController.view
        );
    router
        .route('/forms/mvpawards/edit')
        .get(app.oauth.authenticate(), mvpAwardsController.viewSelf)
        .post(app.oauth.authenticate(), mvpAwardsController.upsertSelf);

    let isicSciEssayController = require('./forms/isicSciEssayController');
    router.route('/forms/isicsciessay/submit').post(isicSciEssayController.new);
    // Export API routes
    return router;
};
