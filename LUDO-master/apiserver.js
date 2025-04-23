const express = require("express");
const { MongoClient, ObjectId } = require("mongodb"); // ✅ Import ObjectId
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = 3001;
const MONGO_URI = process.env.MONGODB_URI;
const DATABASE_NAME = "ludoDB";
const COLLECTION_NAME = "ludo_table";

let db;

// ✅ Middleware to parse JSON requests
app.use(express.json());  // 🔥 Fixes issue with empty req.body

// Connect to MongoDB
MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        db = client.db(DATABASE_NAME);
        console.log("✅ Connected to MongoDB.");
    })
    .catch(error => {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    });

// ✅ API to Get All Data
app.get("/api/ludotable", async (req, res) => {
    try {
        let classic = [];
        let timer = [];

        const data = await db.collection(COLLECTION_NAME).find({}).toArray();

        for (let obj of data) {  // Changed 'Object' to 'obj' (avoid using 'Object' as a variable name)
            if (obj.table_type === "classic") {
                classic.push(obj);
            } else if (obj.table_type === "timer") {
                timer.push(obj);
            }
        }

        // Corrected JSON response structure
        res.json({
            data: {
                classic,
                timer
            }
        });

    } catch (error) {
        res.status(500).json({ error: "Database query failed" });
    }
});

// ✅ API to Get Data by ID (POST)
app.post("/api/ludotable/getById", async (req, res) => {
    try {
        console.log("Request Body:", req.body); // ✅ Debugging log

        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: "ID is required" });
        }

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        const objectId = new ObjectId(id);
        const data = await db.collection(COLLECTION_NAME).findOne({ _id: objectId });

        if (!data) {
            return res.status(404).json({ error: "No record found" });
        }

        res.json(data);
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query failed", details: error.message });
    }
});

app.post("/api/save-game", async (req, res) => {
    try {
        console.log("Received Data:", req.body); // ✅ Debugging log

        if (!db) {
            return res.status(500).json({ error: "Database connection not established" });
        }

        // Extract fields from request
        const { table_type, entry_fee, turn_timer, commision, table_status, max_players, game_time, master_roomid, table_name } = req.body;

        if (!table_type || entry_fee === undefined || turn_timer === undefined || commision === undefined || table_status === undefined || !max_players || game_time === undefined || !master_roomid || !table_name) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // ✅ Save new game entry
        const newGame = {
            table_type,
            entry_fee,
            turn_timer,
            commision,
            table_status: table_status === "true" ? true : table_status === "false" ? false : table_status,
            max_players,
            game_time,
            master_roomid,
            table_name
        };

        const result = await db.collection(COLLECTION_NAME).insertOne(newGame);

        res.status(201).json({
            message: "Game saved successfully",
            insertedId: result.insertedId
        });

    } catch (error) {
        console.error("Error inserting data:", error);
        res.status(500).json({ error: "Failed to save game", details: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
