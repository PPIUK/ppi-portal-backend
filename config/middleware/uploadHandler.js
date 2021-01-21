var Form = require('multiparty').Form;

var uploadHandler = function (opts) {
    if (opts == null) {
        opts = {};
    }
    this.multiparty = opts.multiparty;
    this.minFileSize = opts.minFileSize || 204800;
    this.maxFileSize = opts.maxFileSize || 5242880;
    this.acceptFileTypes = opts.acceptFileTypes || /\.(gif|jpe?g|png)$/i;
    return this;
};

uploadHandler.prototype.optionsHandler = function (req, res, next) {
    res.set({
        'Access-Control-Allow-Methods': 'OPTIONS, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    return next();
};

uploadHandler.prototype.postHandler = function (req, res, next) {
    req.files = {
        files: [],
    };
    const done = function (err) {
        return next(err);
    };
    return new Form()
        .on('error', function (err) {
            req.files.error = err.message;
            return done();
        })
        .on('close', done)
        .on('file', (field, file) => {
            file = {
                field: field,
                name: file.originalFilename,
                path: file.path,
                size: file.size,
                mime: file.headers['content-type'],
                errors: [],
            };
            if (!file.name || !this.acceptFileTypes.test(file.name)) {
                file.errors.push({
                    message: 'File type not allowed',
                });
            }
            if (this.maxFileSize < file.size) {
                file.errors.push({
                    message: 'File size too big',
                });
            }
            if (this.minFileSize > file.size) {
                file.errors.push({
                    message: 'File size too small',
                });
            }
            if (file.errors.length !== 0) {
                delete file.path;
            }
            return req.files.files.push(file);
        })
        .parse(req);
};

module.exports = uploadHandler;
