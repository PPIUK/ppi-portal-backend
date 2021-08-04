const AccessControl = require('accesscontrol');

const grants = {
    basic: {
        profile: {
            'read:own': ['*', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
            'read:any': ['_id', 'fullName'],
        },
    },
    verified: {
        profile: {
            'read:own': ['*', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
            'read:any': [
                '_id',
                'fullName',
                'university',
                'degreeLevel',
                'faculty',
                'course',
                'branch',
            ],
        },
    },
    verifier: {
        profile: {
            'read:own': ['*', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
            'read:any': [
                '_id',
                'fullName',
                'university',
                'degreeLevel',
                'faculty',
                'course',
                'branch',
                'roles',
            ],
            'update:any': ['roles'],
        },
    },
    dataAccess: {
        profile: {
            'read:own': ['*', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
            'create:any': ['*', '!_id', '!__v', '!password'],
            'read:any': ['*', '!__v', '!password'],
            'update:any': ['*', '!_id', '!__v', '!password'],
            'delete:any': ['*'],
        },
    },
    verifier: {
        profile: {
            'read:any': ['_id', 'fullName'],
            'update:any': ['roles'],
            'delete:any': ['*'],
        }
    }

    // grants for specific forms
    mvpAwardsAccess: {
        mvpAwardForm: {
            'read:any': ['*'],
        },
        profile: {
            'read:any': [
                'phoneWA',
                'email',
                'emailPersonal',
                'addressUK',
                'postcodeUK',
            ],
        },
    },

    isicSciEssayAccess: {
        isicSciEssayForm: {
            'read:any': ['*'],
        }
    },

    thesisAdmin: {
        thesis: {
            'read:any': ['*'],
            'create:any': ['*'],
            'update:any': ['*'],
            'delete:any': ['*'],
        }
    }
};

const ac = new AccessControl(grants);

module.exports = ac;
