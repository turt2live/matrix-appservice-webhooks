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
    return db.createTable("webhooks", {
        id: {type: 'string', primaryKey: true, notNull: true},
        roomId: {type: 'string', notNull: true},
        userId: {type: 'string', notNull: true}
    });
};

exports.down = function (db) {
    return db.dropTable("webhooks");
};

exports._meta = {
    "version": 1
};
