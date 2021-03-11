module.exports = (webhook, matrix) => {
    // Note: this technically doesn't do anything and solely exists to make the structure sane
    if (!matrix.sender.avatar_url)
        matrix.sender.avatar_url = null;
};
