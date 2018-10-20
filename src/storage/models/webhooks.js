module.exports = function (sequelize, DataTypes) {
    return sequelize.define('webhooks', {
        id: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
            field: 'id'
        },
        roomId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'roomId'
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'userId'
        },
        label: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'label',
        },
    }, {
        tableName: 'webhooks',
        underscored: false,
        timestamps: false
    });
};
