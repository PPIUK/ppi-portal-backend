const AccessControl = require('accesscontrol');

const grants = {
    basic: {
        profile: {
            'read:own': ['*', '!_id', '!__v'],
            'update:own': ['*', '!_id', '!__v']
        }
    },
    verified: {
        profile: {
            'read:own': ['*', '!_id', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
            'read:any': ['fullName', 'university', 'degreeLevel', 'course', 'branch']
        }
    },
    verifier: {
        profile: {
            'read:own': ['*', '!_id', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
            'read:any': ['fullName', 'university', 'degreeLevel', 'course', 'branch', 'manuallyVerified'],
            'update:any': ['manuallyVerified']
        }
    },
    dataAccess: {
        profile: {
            'read:own': ['*', '!_id', '!__v'],
            'update:own': ['*', '!_id', '!__v'],
            'create:any': ['*', '!_id', '!__v', '!password'],
            'read:any': ['*', '!_id', '!__v','!password'],
            'update:any': ['*', '!_id', '!__v', '!password'],
            'delete:any': ['*']
        }
    }
};

const ac = new AccessControl(grants);

module.exports = ac;