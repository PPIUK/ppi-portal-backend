module.exports = (logger) => ({
    logGeneralError: (req, err, message) =>
        logger.error(
            `${req.path}\n\t${message}\n\t\t${JSON.stringify(
                err
            )}\n\t\tRequest Body: ${req.body}`
        ),
});
