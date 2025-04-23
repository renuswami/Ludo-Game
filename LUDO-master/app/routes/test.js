const express = require('express');
const connectDB = require('../config/dbConfig');  // Import db file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

app.get('/', (req, res) => {
    res.send('MongoDB Connection Test: Server is running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
