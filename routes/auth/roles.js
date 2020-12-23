const AccessControl = require('accesscontrol');

const grants = {
    basic: {
        profile: {
            'read:own': ['*', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
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
};

const ac = new AccessControl(grants);

module.exports = ac;
