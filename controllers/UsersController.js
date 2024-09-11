const User = require("../models/usersModel");
const OTP = require("../models/otpModel");
const path = require("path");
const fs = require("fs");

const AuthSession = require("../models/authSessionModel");
const jwt = require("jsonwebtoken");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const { sendOtpToPhone } = require("../utils/sendOtp");
const isTesting = process.env.NODE_ENV === "development";
const fixedOtp = process.env.FIXED_OTP;

const normalizePhoneNumber = (number) => {
  try {
    // console.log(`Input number: ${number}`);

    // Parse the phone number
    const phoneNumber = parsePhoneNumberFromString(number, "IN"); // Specify default region if needed

    // Log the parsed phone number
    // console.log(`Parsed phone number: ${phoneNumber ? phoneNumber.formatInternational() : 'undefined'}`);

    if (phoneNumber) {
      // Return the number in E.164 format (e.g., +14155552671)
      return phoneNumber.number;
    }
    return null;
  } catch (error) {
    console.error(`Error parsing phone number: ${error.message}`);
    return null;
  }
};

// Generate and send OTP
exports.sendOtp = async (req, res) => {
  const { phone_number } = req.body;
  console.log(phone_number);

  try {
    const otp = isTesting
      ? fixedOtp
      : Math.floor(100000 + Math.random() * 900000).toString();

    if (!isTesting) {
      const otpEntry = new OTP({ phone_number, otp });
      await otpEntry.save();
    }

    await sendOtpToPhone(phone_number, otp);

    res.status(200).json({ message: "OTP sent successfully." });
  } catch (error) {
    res.status(500).json({ error: "Error sending OTP." });
  }
};

// Verify OTP and login/register user
exports.verifyOtp = async (req, res) => {
  const { phone_number, otp, device_type, device_info, ip_address, publicKey } =
    req.body;

  try {
    let validOtp = false;

    if (isTesting) {
      console.log("onnnn");
      validOtp = otp === fixedOtp;
      console.log("Testing mode, validOtp:", validOtp);
    } else {
      const otpEntry = await OTP.findOne({ phone_number, otp });
      if (otpEntry) {
        validOtp = true;
        await OTP.deleteOne({ _id: otpEntry._id });
      }
    }

    if (!validOtp) {
      return res.status(401).json({ error: "Invalid OTP." });
    }

    // Find the user by phone number
    let user = await User.findOne({ phone_number });

    if (!user) {
      // If the user does not exist, create a new user
      user = new User({ phone_number, publicKey }); // Ensure this field is included in the User schema
      await user.save();
      console.log("New user created:", user);
    } else {
      // If the user already exists, update their public key
      user.publicKey = publicKey;
      await user.save();
      console.log("User found and public key updated:", user);
    }

    // Invalidate all previous sessions for this user
    await AuthSession.updateMany({ user_id: user._id }, { is_active: false });

    // Generate a new JWT token
    const token = jwt.sign({ userId: user._id }, "your_jwt_secret", {
      expiresIn: "30d",
    });

    // Create a new session
    const authSession = new AuthSession({
      user_id: user._id,
      device_type,
      device_info,
      ip_address,
      session_token: token,
    });
    await authSession.save();
    console.log("New session created:", authSession);

    res
      .status(200)
      .json({ token, message: "User authenticated successfully." });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Error verifying OTP." });
  }
};

// Other methods (getUserProfile, updateUserProfile, logoutUser) remain the same

exports.getUserProfile = async (req, res) => {
  // const userId = req.user.userId;
  console.log(req.body, "reee");
  const userId = req.body.userId;

  try {
    const user = await User.findOne({ phone_number: userId });
    console.log(user, "userr");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user profile." });
  }
};

exports.updateUserProfile = async (req, res) => {
  const userId = req.user.userId;
  const updateData = req.body;

  const immutableFields = ["phone_number", "created_at", "updated_at"];

  try {
    immutableFields.forEach((field) => {
      if (updateData.hasOwnProperty(field)) {
        delete updateData[field];
      }
    });

    if (updateData.hasOwnProperty("name") && !updateData.name.trim()) {
      return res.status(400).json({ error: "Name cannot be empty." });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: "Error updating user profile." });
  }
};

exports.logoutUser = async (req, res) => {
  const userId = req.user.userId;
  const token = req.headers["authorization"];

  try {
    await AuthSession.findOneAndUpdate(
      { user_id: userId, session_token: token },
      { is_active: false }
    );

    res.status(200).json({ message: "User logged out successfully." });
  } catch (error) {
    res.status(500).json({ error: "Error logging out." });
  }
};

exports.checkContacts = async (req, res) => {
  try {
    const { contacts } = req.body; // Expecting an array of mobile numbers

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: "Invalid contacts format" });
    }

    // Normalize the input contacts
    const normalizedContacts = contacts
      .map(normalizePhoneNumber)
      .filter(Boolean);
    // Find registered users whose mobile numbers match the normalized contacts
    const registeredUsers = await User.find({
      phone_number: { $in: normalizedContacts },
    });
    console.log(registeredUsers, "users");

    res.status(200).json(registeredUsers);
  } catch (error) {
    res.status(500).json({ error: "Failed to check contacts" });
  }
};

// Function to get the public key using phone number
exports.getPublicKeyByPhoneNumber = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const user = await User.findOne({ phone_number: phoneNumber });

    if (!user || !user.publicKey) {
      return res.status(404).json({ error: "User or public key not found" });
    }

    res.status(200).json({ publicKey: user.publicKey });
  } catch (error) {
    console.error("Error retrieving public key:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// exports.updateProfilePictureAndBio = async (req, res) => {
//   const phone_number = req.body.userId;
//   try {
//     const updateData = {};

//     // Find the user by phone number
//     const user = await User.findOne({ phone_number });
//     if (!user) {
//       return res.status(404).json({ error: "User not found." });
//     }

//     // Update profile picture if a new one is uploaded
//     if (req.file) {
//       const newProfilePicture = req.file.filename;

//       // Remove old profile picture if it exists
//       if (user.profile_picture) {
//         const oldPicturePath = path.join(
//           __dirname,
//           "..",
//           "uploads",
//           user.profile_picture
//         );
//         fs.unlink(oldPicturePath, (err) => {
//           if (err) {
//             console.error("Error deleting old profile picture:", err);
//           }
//         });
//       }

//       // // Update the filename to use phone number
//       // fs.renameSync(
//       //   path.join(__dirname, "..", "uploads", req.file.filename),
//       //   path.join(__dirname, "..", "uploads", newProfilePicture)
//       // );

//       // Set the new profile picture filename in the update data
//       updateData.profile_picture = newProfilePicture;
//     }

//     // Update bio if provided in the request
//     if (req.body.bio) {
//       updateData.bio = req.body.bio.trim();
//     }

//     // Update username if provided in the request
//     if (req.body.username) {
//       updateData.name = req.body.username.trim();
//     }

//     // Update the user in the database with the new data
//     const updatedUser = await User.findOneAndUpdate(
//       { phone_number }, // Query by phone_number
//       updateData, // Data to update
//       { new: true } // Return the updated document
//     );

//     // Respond with the updated user information
//     res.status(200).json(updatedUser);
//   } catch (error) {
//     console.error("Error updating profile picture, bio, and username:", error);
//     res.status(500).json({ error: "Error updating profile." });
//   }
// };

// exports.deleteOldProfilePicture = async (req, res, next) => {
//   const phone_number = req.body.userId;

//   try {
//     const user = await User.findOne({ phone_number });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found.' });
//     }

//     if (user.profile_picture) {
//       const oldPicturePath = path.join(
//         __dirname,
//         '..',
//         'uploads',
//         user.profile_picture // Assuming profile_picture contains just the filename
//       );

//       // Delete the old profile picture
//       fs.unlink(oldPicturePath, (err) => {
//         if (err) {
//           console.error('Error deleting old profile picture:', err);
//         }
//       });
//     }

//     // Proceed to the next middleware (Multer upload)
//     next();
//   } catch (error) {
//     console.error('Error in deleteOldProfilePicture middleware:', error);
//     res.status(500).json({ error: 'Error deleting old profile picture.' });
//   }
// };
exports.updateProfilePictureAndBio1 = async (req, res) => {
  const phone_number = req.body.userId;

  try {
    const updateData = {};

    const user = await User.findOne({ phone_number });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Update profile picture if a new one is uploaded
    if (req.file) {
      // Remove old profile picture if it exists
      if (user.profile_picture) {
        const oldPicturePath = path.join(
          __dirname,
          "..",
          "uploads",
          path.basename(user.profile_picture)
        );
        fs.unlink(oldPicturePath, (err) => {
          if (err) {
            console.error("Error deleting old profile picture:", err);
          }
        });
      }
      updateData.profile_picture = req.file.filename;
    }

    // Update bio if provided in the request
    if (req.body.bio) {
      updateData.bio = req.body.bio.trim();
    }

    // Update username if provided in the request
    if (req.body.username) {
      updateData.name = req.body.username.trim();
    }

    // Update the user in the database with the new data
    const updatedUser = await User.findOneAndUpdate(
      { phone_number }, // Query by phone_number
      updateData, // Data to update
      { new: true } // Return the updated document
    );

    // Respond with the updated user information
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating profile picture, bio, and username:", error);
    res.status(500).json({ error: "Error updating profile." });
  }
};

exports.updateProfilePictureAndBio = async (req, res) => {
  try {
    const phone_number = req.body.userId;

    // Ensure user exists
    const user = await User.findOne({ phone_number });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Remove old profile picture if it exists
    if (user.profile_picture) {
      const oldPicturePath = path.join(
        __dirname,
        "..",
        "uploads",
        user.profile_picture
      );
      fs.unlink(oldPicturePath, (err) => {
        if (err) {
          console.error("Error deleting old profile picture:", err);
        }
      });
    }
    // const phone_number = file.originalname.split('.').slice(0, -1).join('.');
    // Handle new file upload
    if (req.files && req.files.profilePicture) {
      const profilePicture = req.files.profilePicture;
      
      const uploadPath = path.join(
        __dirname,
        "..",
        "uploads",
        profilePicture.name
      );

      // Save the new profile picture
      profilePicture.mv(uploadPath, async (err) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Error uploading new profile picture." });
        }

        // Update user profile picture path in the database
        user.profile_picture = profilePicture.name;
        // Update bio if provided in the request
      });
    }

    if (req.body.bio) {
      user.bio = req.body.bio.trim();
    }

    // Update username if provided in the request
    if (req.body.username) {
      user.name = req.body.username.trim();
    }

    await user.save();

    return res.json({ message: "Profile updated successfully." });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Failed to update profile." });
  }
};
