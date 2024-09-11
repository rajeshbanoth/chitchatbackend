const multer = require("multer");
const path = require("path");
const User = require("../models/usersModel");

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Specify the upload directory
  },
  filename: async function (req, file, cb) {
    // Use the original name of the file and append the file extension
    cb(null, file.originalname); // Save the file with its original name
  },
});

const upload = multer({ storage: storage });

module.exports = upload;

// const multer = require('multer');
// const path = require('path');

// // Configure multer storage
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/'); // Specify the upload directory
//   },
//   filename: function (req, file, cb) {
//   console.log(req.body,"ress")
//     const phoneNumber = req.body.userId; // Get phone number from request body
//     if (!phoneNumber) {
//       return cb(new Error('User ID is missing')); // Handle the missing phone number
//     }
//     const ext = path.extname(file.originalname); // Get file extension
//     cb(null, phoneNumber + ext); // Use phone number as the filename
//   },
// });

// const upload = multer({ storage: storage });

// module.exports = upload;
