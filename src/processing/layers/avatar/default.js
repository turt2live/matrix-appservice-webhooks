module.exports = (webhook, matrix) => {
    // Note: this technically doesn't do anything and solely exists to make the structure sane
    if (!matrix.sender.avatarUrl)
        matrix.sender.avatarUrl = null;
};