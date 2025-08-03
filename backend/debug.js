const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// A single, simple route to prove the server is running and routable
app.get('/api/debug', (req, res) => {
  console.log('✅ /api/debug endpoint was hit successfully!');
  res.status(200).json({
    status: 'success',
    message: 'The debug backend service is running and reachable!',
    timestamp: new Date().toISOString(),
  });
});

// Catch-all for any other requests to show what's being hit
app.use('*', (req, res) => {
  console.log(`⚠️ A request hit the debug server at path: ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found in Debug Server',
    path: req.originalUrl,
  });
});

app.listen(port, () => {
  console.log(`🚀 DEBUG SERVER is alive and listening on port ${port}`);
});
