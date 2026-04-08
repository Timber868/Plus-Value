const mongoose = require('mongoose');

// Mongoose schema for the leagues
const leagueSchema = new mongoose.Schema({
    name : String,
    country: String,
    confederation : String,
    tier : Number,

    // Type can be either league or cup
    type: {
        type: String,
        enum: ['cup', 'league'],
        default: 'league',
        required: true,
    },

    europeanSpots : Number
});

// Export the League schema
module.exports = mongoose.model('League', leagueSchema)