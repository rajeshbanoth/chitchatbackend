const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const cors = require("cors");
const path = require("path");
const fileUpload = require('express-fileupload');

// const userRoutes = require('./routes/userRoutes');
const usersRoutes = require("./routes/usersRoute");
const bodyParser = require("body-parser");

const socketHandler = require("./sockets/chat");
const { connectRedis, disconnectRedis } = require("./redis/redis");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(fileUpload())
// // Body parsing middleware
// // app.use(express.json());
// app.use(bodyParser.urlencoded({ extended: true }));



// CORS setup
const corsOptions = {
  origin: "*", // Replace '*' with your actual frontend origin if needed
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// app.use('/api', userRoutes);
app.use("/api", usersRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Route to fetch image by filename

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

// Initialize Redis connection
(async () => {
  try {
    await connectRedis();
    console.log("Redis connected successfully");
  } catch (err) {
    console.error("Redis connection error:", err);
  }
})();

// Handle application shutdown
process.on("SIGINT", async () => {
  try {
    await disconnectRedis();
    console.log("Redis disconnected successfully");
  } catch (err) {
    console.error("Redis disconnection error:", err);
  }
  process.exit(0);
});

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

socketHandler(io);

server.listen(8080, () => {
  console.log("listening on *:8080");
});
