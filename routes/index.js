// Filename: api-routes.js

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
        )
        .delete(
            app.oauth.authenticate(),
            profileController.grantAccess('deleteOwn'),
            profileController.deleteSelf
        );
    router
        .route('/profiles/me/studentproof')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readOwn'),
            profileController.viewOwnStudentProofFile
        );
    router
        .route('/profiles/me/profilepicture')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readOwn'),
            profileController.viewOwnProfilePictureFile
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
        .route('/profiles/:profile_id/studentproof')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readAny'),
            profileController.viewStudentProofFile
        );
    router
        .route('/profiles/:profile_id/profilepicture')
        .get(
            app.oauth.authenticate(),
            profileController.grantAccess('readAny'),
            profileController.viewProfilePictureFile
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

    router
        .route('/public/members/active')
        .get(publicController.memberSummaryActive);

    var authController = require('./auth/authController');
    router.route('/auth/register').post(authController.register);
    router.route('/auth/register/new').post(authController.registerNew);
    router.route('/auth/set-password').post(authController.setPassword);
    router
        .route('/auth/resend-verification')
        .post(authController.resendVerificationEmail);
    router.route('/auth/verify-email/:token').get(authController.verifyEmail);
    router
        .route('/auth/login')
        .post(authController.login, app.oauth.token(), (req, res) => {
            res.locals.oauth.token.user.lastLoggedIn = new Date();
            res.locals.oauth.token.user.save();
        });
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
    router.route('/auth/authorize').post(
        app.oauth.authorize({
            authenticateHandler: {
                handle: (req) => {
                    return req.body.user;
                },
            },
        })
    );
    // TODO: remove
    router
        .route('/auth/create-access-token')
        .post(authController.createAccessToken);

    let thesisController = require('./thesisController');
    router
        .route('/thesis')
        // .route('/thesis/:user_id') // FIXME: Do we need user_id path param?
        .post(app.oauth.authenticate(), thesisController.new)
        .get(thesisController.search);
    router.route('/thesis/feed').get(thesisController.feed);

    router.route('/thesis/:id/pdf').get(thesisController.viewFile);
    router
        .route('/thesis/:id')
        .get(thesisController.view)
        .delete(
            app.oauth.authenticate(),
            thesisController.grantAccess('deleteAny'),
            thesisController.delete
        )
        .put(app.oauth.authenticate(), thesisController.update);

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
    router
        .route('/forms/isicsciessay/:id/abstract')
        .post(isicSciEssayController.uploadAbstract)
        .get(
            app.oauth.authenticate(),
            isicSciEssayController.grantAccess('readAny'),
            isicSciEssayController.viewAbstract
        );
    router
        .route('/forms/isicsciessay/:id/studentID/:no')
        .post(isicSciEssayController.uploadStudentID)
        .get(
            app.oauth.authenticate(),
            isicSciEssayController.grantAccess('readAny'),
            isicSciEssayController.viewStudentId
        );
    router
        .route('/forms/isicsciessay/:id/ktp/:no')
        .post(isicSciEssayController.uploadKTP)
        .get(
            app.oauth.authenticate(),
            isicSciEssayController.grantAccess('readAny'),
            isicSciEssayController.viewKtp
        );

    router
        .route('/forms/isicsciessay/submissions/all')
        .get(
            app.oauth.authenticate(),
            isicSciEssayController.grantAccess('readAny'),
            isicSciEssayController.index
        );
    router
        .route('/forms/isicsciessay/abstracts/all')
        .get(
            app.oauth.authenticate(),
            isicSciEssayController.grantAccess('readAny'),
            isicSciEssayController.allAbstracts
        );
    router
        .route('/forms/isicsciessay/IDs/all')
        .get(
            app.oauth.authenticate(),
            isicSciEssayController.grantAccess('readAny'),
            isicSciEssayController.allIds
        );

    let verifierController = require('./verifierController.js');
    router
        .route('/verifier/pending')
        .get(
            app.oauth.authenticate(),
            verifierController.grantAccess('readAny'),
            verifierController.pending
        );
    router
        .route('/verifier/flagged')
        .get(
            app.oauth.authenticate(),
            verifierController.grantAccess('readAny'),
            verifierController.flagged
        );
    router
        .route('/verifier/blocked')
        .get(
            app.oauth.authenticate(),
            verifierController.grantAccess('readAny'),
            verifierController.blocked
        );
    router
        .route('/verifier/action/:userID')
        .post(
            app.oauth.authenticate(),
            verifierController.grantAccess('updateAny'),
            verifierController.action
        )
        .delete(
            app.oauth.authenticate(),
            verifierController.grantAccess('deleteAny'),
            verifierController.delete
        );

    let votingCampaignController = require('./votingCampaignController.js');
    router.route('/voting').get(votingCampaignController.index);
    router.route('/voting/archived').get(votingCampaignController.archived);
    router.route('/voting/active').get(votingCampaignController.active);
    router
        .route('/voting/active/nominate')
        .get(votingCampaignController.activeNominate);
    router
        .route('/voting/active/vote')
        .get(votingCampaignController.activeVote);
    router
        .route('/voting/pubstats/:id')
        .get(votingCampaignController.votersStatistics);
    router
        .route('/voting/pubinfo/:id')
        .get(votingCampaignController.publicInfo);
    router
        .route('/voting/admin')
        .post(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('createAny'),
            votingCampaignController.new
        );
    router
        .route('/voting/admin/:campaignID')
        .patch(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('updateAny'),
            votingCampaignController.update
        )
        .delete(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('deleteAny'),
            votingCampaignController.delete
        );
    router
        .route('/voting/admin/:campaignID/round')
        .post(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('createAny'),
            votingCampaignController.newRound
        );
    router
        .route('/voting/admin/:campaignID/round/:roundID')
        .get(app.oauth.authenticate(), votingCampaignController.viewRound)
        .patch(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('updateAny'),
            votingCampaignController.updateRound
        )
        .delete(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('deleteAny'),
            votingCampaignController.deleteRound
        );
    router
        .route('/voting/admin/:campaignID/round/:round/candidates')
        .post(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('createAny'),
            votingCampaignController.selectCandidates
        );
    router
        .route('/voting/admin/:campaignID/voters')
        .get(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('readAny'),
            votingCampaignController.eligibleList
        );
    router
        .route('/voting/admin/:campaignID/stats')
        .get(
            app.oauth.authenticate(),
            votingCampaignController.grantAccess('readAny'),
            votingCampaignController.statistics
        );
    router
        .route('/voting/:campaignID')
        .get(app.oauth.authenticate(), votingCampaignController.view);
    router
        .route('/voting/:campaignID/banner')
        .get(
            app.oauth.authenticate(),
            votingCampaignController.viewCampaignBanner
        );
    router
        .route('/voting/:campaignID/submission')
        .get(
            app.oauth.authenticate(),
            votingCampaignController.viewSelfNomination
        )
        .post(app.oauth.authenticate(), votingCampaignController.newNomination)
        .patch(
            app.oauth.authenticate(),
            votingCampaignController.updateNomination
        );
    router
        .route('/voting/:campaignID/submission/:userID')
        .get(app.oauth.authenticate(), votingCampaignController.viewNomination);
    router
        .route('/voting/:campaignID/submission/:userID/cv')
        .get(app.oauth.authenticate(), votingCampaignController.viewCV);
    router
        .route('/voting/:campaignID/submission/:userID/organisationExp')
        .get(
            app.oauth.authenticate(),
            votingCampaignController.viewOrganisationExp
        );
    router
        .route('/voting/:campaignID/submission/:userID/notInOfficeStatement')
        .get(
            app.oauth.authenticate(),
            votingCampaignController.viewNotInOfficeStatement
        );
    router
        .route('/voting/:campaignID/submission/:userID/motivationEssay')
        .get(
            app.oauth.authenticate(),
            votingCampaignController.viewMotivationEssay
        );
    router
        .route('/voting/:campaignID/vote/:round/:candidateID')
        .post(app.oauth.authenticate(), votingCampaignController.vote);
    router
        .route('/voting/:campaignID/round/:roundID')
        .get(app.oauth.authenticate(), votingCampaignController.viewRound);
    router
        .route('/voting/:campaignID/eligibility/:round')
        .get(app.oauth.authenticate(), votingCampaignController.eligibility);
    router
        .route('/voting/:campaignID/hasVoted/:round')
        .get(app.oauth.authenticate(), votingCampaignController.hasVoted);
    router
        .route('/voting/:campaignID/isActiveVote')
        .get(app.oauth.authenticate(), votingCampaignController.isActiveVote);
    // Export API routes
    return router;
};
