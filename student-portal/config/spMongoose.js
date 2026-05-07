/**
 * Student Portal Mongoose Wrapper
 * 
 * This module provides a drop-in replacement for `require('mongoose')` 
 * in Student Portal model files. It wraps the separate SP database connection
 * so models are registered on the student_portal database instead of the 
 * default HR database.
 * 
 * Usage: In SP model files, simply change:
 *   const mongoose = require('mongoose');
 * to:
 *   const mongoose = require('../config/spMongoose');
 * 
 * Everything else (Schema, model(), Types) works exactly the same.
 */

const mongoose = require('mongoose');
const { getSPConnection } = require('../../config/db');

module.exports = {
    // Pass through Schema constructor (unchanged)
    Schema: mongoose.Schema,

    // Pass through Types (ObjectId, etc.)
    Types: mongoose.Types,

    // model() — register on the SP connection instead of default
    model: function (name, schema) {
        const conn = getSPConnection();
        if (!conn) {
            throw new Error(
                `Student Portal DB connection not ready. ` +
                `Make sure connectSPDB() is called before requiring SP models.`
            );
        }
        // Check if model already compiled on this connection
        if (conn.models[name]) {
            return conn.models[name];
        }
        return conn.model(name, schema);
    },
};
