module.exports = function (sequelize, DataTypes) {
    return sequelize.define('account_data', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'id'
        },
        objectId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'objectId'
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'key'
        },
        value: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'value'
        }
    }, {
        tableName: 'account_data',
        underscored: false,
        timestamps: false
    });
};
