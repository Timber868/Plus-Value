// server.js — Entry point: loads env vars and starts the HTTP server
// TODO: import app and start listening on PORT

require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

// TODO: connect to MongoDB before starting the server
//   const connectDB = require('./src/config/database');
//   connectDB().then(() => app.listen(PORT, ...));

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
