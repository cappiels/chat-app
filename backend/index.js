// --- Imports ---
require('dotenv').config(); // This loads the .env file
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client

// ** NEW **: Add this line to debug the environment variable
console.log('DATABASE_URL being used:', process.env.DATABASE_URL);

// --- Initialization ---
const app = express();
const port = 8080;

// --- Middleware ---
// This line is very important! It allows our server to understand JSON data.
app.use(express.json());

// --- Database Connection ---
// This creates a pool of connections to your PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ** NEW **: This line is added to fix SSL certificate errors in local development.
  // It should NOT be used in production. Digital Ocean's App Platform handles this correctly.
  ssl: {
    rejectUnauthorized: false
  }
});

// --- API Routes ---

// Test route to make sure server is running
app.get('/', (req, res) => {
  res.send('Hello from the backend server!');
});

// ** NEW **: The endpoint to create a workspace
app.post('/workspaces', async (req, res) => {
  console.log("--- Received a request to POST /workspaces ---"); // DEBUG LOG

  const { name } = req.body;
  console.log("Request body:", req.body); // DEBUG LOG

  if (!name) {
    console.log("Validation failed: Name is missing."); // DEBUG LOG
    return res.status(400).send('Workspace name is required');
  }

  try {
    console.log("Attempting to insert into database..."); // DEBUG LOG
    const newWorkspace = await pool.query(
      "INSERT INTO workspaces (name, owner_user_id) VALUES ($1, 'temp-user-id') RETURNING *",
      [name]
    );

    console.log("Database insert successful:", newWorkspace.rows[0]); // DEBUG LOG
    res.status(201).json(newWorkspace.rows[0]);

  } catch (err) {
    // This will log the FULL error object, not just the message
    console.error("!!! DATABASE ERROR !!!", err); // DEBUG LOG
    res.status(500).send('Server error');
  }
});


// --- Server Start ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
