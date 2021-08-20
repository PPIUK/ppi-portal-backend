const mongoose = require('mongoose');

exports.sendFile = async function (fileType, bucketName, object, err, res) {
    if (object === null || (err && err.name === 'CastError')) {
        return res.status(404).json({
            message: 'ID not found',
        });
    } else if (object[fileType] === undefined) {
        return res.status(404).json({
            message: `There is no ${fileType} file associated with this ID.`,
        });
    } else if (err) {
        return res.status(500).json({
            message: err.message,
        });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: bucketName,
    });
    const bucketCollection = mongoose.connection.collection(
        bucketName + '.files'
    );
    let fileInfo = await bucketCollection.findOne({ _id: object[fileType] });
    const stream = bucket.openDownloadStream(
        new mongoose.Types.ObjectId(object[fileType])
    );
    res.set('Content-Disposition', `attachment; filename=${fileInfo.filename}`);
    res.set('Content-Type', `${fileInfo.contentType}`);
    stream.on('data', (chunk) => {
        res.write(chunk);
    });
    stream.on('error', (err) => {
        if (err.code === 'ENOENT') {
            return res.status(404).json({
                message: 'File not found',
            });
        }
        return res.status(500).json({
            message: err.message,
        });
    });
    stream.on('end', () => {
        res.end();
    });

    // res.writeHead(200, {
    //     'Content-Disposition': `attachment; filename=${fileInfo.filename}`,
    //     'Content-Type': `${fileInfo.contentType}`,
    // });
    // stream.pipe(res);
};
