// Import the express library
const express = require('express');

// Create an instance of an express application
const app = express();

// Define the port the server will run on. 8080 is a common choice.
const port = 8080;

// Define a "route". This tells the server what to do when it gets a request.
// This route handles requests to the base URL ('/')
app.get('/', (req, res) => {
  res.send('Hello from the backend server!');
});

// Start the server and have it listen on the defined port
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
