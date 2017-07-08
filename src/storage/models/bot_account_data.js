module.exports = function (sequelize, DataTypes) {
    return sequelize.define('bot_account_data', {
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
            field: 'key'
        },
        value: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'value'
        }
    }, {
        tableName: 'bot_account_data',
        underscored: false,
        timestamps: false
    });
};
