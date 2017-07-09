'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
    dbm = options.dbmigrate;
    type = dbm.dataType;
    seed = seedLink;
};

exports.up = function (db) {
    return db.createTable("account_data", {
        id: {type: 'integer', primaryKey: true, notNull: true, autoIncrement: true},
        objectId: {type: 'string', notNull: true},
        key: {type: 'string', notNull: true},
        value: {type: 'string', notNull: true}
    });
};

exports.down = function (db) {
    return db.dropTable("account_data");
};

exports._meta = {
    "version": 1
};
