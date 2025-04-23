const mongoose = require("mongoose");

// Define the schema
const ludoTableSchema = new mongoose.Schema({
    table_type: { type: String, required: true },
    entry_fee: { type: Number, required: true },
    turn_timer: { type: Number, required: true },
    commision: { type: Number, required: true },
    table_status: { type: Boolean, required: true },
    max_players: { type: Number, required: true },
    game_time: { type: Number, required: true },
    table_name: { type: String, required: true }
}, { collection: "ludo_table" }); // Explicitly setting the collection name

// Create the model
const LudoTable = mongoose.model("LudoTable", ludoTableSchema);

module.exports = LudoTable;
