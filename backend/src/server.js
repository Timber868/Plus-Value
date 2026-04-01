const express = require("express");
const app = express();

// Import Routes
const playerRoutes = require("./routes/playerRoutes");

// API Routes
app.use("/players", playerRoutes);

const PORT = 3000;
app.listen(PORT);
console.log(`Server is running on port ${PORT}`);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Hello World" });
});
