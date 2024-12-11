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

const uploadDirectory = path.resolve(__dirname, "../uploads"); // Define your upload directory path


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
// exports.verifyOtp = async (req, res) => {

//   const { phone_number, otp, device_type, device_info, ip_address, publicKey,deviceToken } =
//     req.body;
//   try {
//     let validOtp = false;

//     if (isTesting) {
//       console.log("onnnn");
//       validOtp = otp === fixedOtp;
//       console.log("Testing mode, validOtp:", validOtp);
//     } else {
//       const otpEntry = await OTP.findOne({ phone_number, otp });
//       if (otpEntry) {
//         validOtp = true;
//         await OTP.deleteOne({ _id: otpEntry._id });
//       }
//     }

//     if (!validOtp) {
//       return res.status(401).json({ error: "Invalid OTP." });
//     }

//     // Find the user by phone number
//     let user = await User.findOne({ phone_number });

//     if (!user) {
//       // If the user does not exist, create a new user
//       user = new User({ phone_number, publicKey,deviceToken }); // Ensure this field is included in the User schema
//       await user.save();
//       console.log("New user created:", user);
//     } else {
//       // If the user already exists, update their public key
//       user.publicKey = publicKey;
//       user.deviceToken = deviceToken;
//       await user.save();
//       console.log("User found and public key updated:", user);
//     }

//     // Invalidate all previous sessions for this user
//     await AuthSession.updateMany({ user_id: user._id }, { is_active: false });

//     // Generate a new JWT token
//     const token = jwt.sign({ userId: user._id }, "your_jwt_secret", {
//       expiresIn: "30d",
//     });

//     // Create a new session
//     const authSession = new AuthSession({
//       user_id: user._id,
//       device_type,
//       device_info,
//       ip_address,
//       session_token: token,
//     });
//     await authSession.save();
//     console.log("New session created:", authSession);

//     res
//       .status(200)
//       .json({ token, message: "User authenticated successfully." });
//   } catch (error) {
//     console.error("Error verifying OTP:", error);
//     res.status(500).json({ error: "Error verifying OTP." });
//   }
// };


exports.verifyOtp = async (req, res) => {
  const { phone_number, otp, device_type, device_info, ip_address, publicKey, device_token } = req.body;


  console.log("deviceTOken",device_token)
  try {
    let validOtp = false;

    // Handle testing mode for OTP validation
    if (isTesting) {
      console.log("Testing mode");
      validOtp = otp === fixedOtp;
      console.log("Testing mode, validOtp:", validOtp);
    } else {
      // Verify OTP against the database
      const otpEntry = await OTP.findOne({ phone_number, otp });
      if (otpEntry) {
        validOtp = true;
        await OTP.deleteOne({ _id: otpEntry._id }); // Remove OTP after validation
      }
    }

    if (!validOtp) {
      return res.status(401).json({ error: "Invalid OTP." });
    }

    // Find or create user
    let user = await User.findOne({ phone_number });

    if (!user) {
      // Create new user if not exists
      user = new User({ phone_number, publicKey, device_token });
      await user.save();
      console.log("New user created:", user);
    } else {
      // Update existing user
      user.publicKey = publicKey;
      user.device_token = device_token;
      user.updated_at = Date.now(); // Update the timestamp for tracking
      await user.save();
      console.log("User found and updated:", user);
    }

    // Invalidate previous sessions for this user
    await AuthSession.updateMany({ user_id: user._id }, { is_active: false });

    // Generate new JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" }); // Use environment variable for JWT secret

    // Create new session
    const authSession = new AuthSession({
      user_id: user._id,
      device_type,
      device_info,
      ip_address,
      session_token: token,
    });
    await authSession.save();
    console.log("New session created:", authSession);

    // Respond with the token
    res.status(200).json({ token, message: "User authenticated successfully." });
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

// exports.updateUserProfile = async (req, res) => {
//   const userId = req.user.userId;
//   const updateData = req.body;

//   const immutableFields = ["phone_number", "created_at", "updated_at"];

//   try {
//     immutableFields.forEach((field) => {
//       if (updateData.hasOwnProperty(field)) {
//         delete updateData[field];
//       }
//     });

//     if (updateData.hasOwnProperty("name") && !updateData.name.trim()) {
//       return res.status(400).json({ error: "Name cannot be empty." });
//     }

//     const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
//       new: true,
//     });

//     res.status(200).json(updatedUser);
//   } catch (error) {
//     res.status(500).json({ error: "Error updating user profile." });
//   }
// };

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
    console.log("Received request to check contacts:", req.body);

    const { contacts, phone_number } = req.body; // Expecting an array of mobile numbers and the user's phone number

    if (!contacts || !Array.isArray(contacts)) {
      console.log("Invalid contacts format provided:", contacts);
      return res.status(400).json({ error: "Invalid contacts format" });
    }

    // Normalize the input contacts
    const normalizedContacts = contacts
      .map(normalizePhoneNumber)
      .filter(Boolean); // Remove any invalid phone numbers
    console.log("Normalized contacts:", normalizedContacts);

    // Find registered users whose mobile numbers match the normalized contacts
    const registeredUsers = await User.find({
      phone_number: { $in: normalizedContacts },
    });
    console.log("Registered users found:", registeredUsers);

    // Extract the phone numbers of the registered users
    const registeredUserNumbers = registeredUsers.map(user => user.phone_number);
    console.log("Registered user phone numbers:", registeredUserNumbers);

    // Find the requesting user in the database
    const user = await User.findOne({ phone_number });
    if (!user) {
      console.log("User not found with phone number:", phone_number);
      return res.status(404).json({ error: "User not found." });
    }
    console.log("Requesting user found:", user);

    // Update the user's friends list with the registered contacts (add unique contacts)
    const updatedFriends = Array.from(new Set([...user.friends, ...registeredUserNumbers]));
    console.log("Updated friends list:", updatedFriends);

    // Update the user's friends field
    user.friends = updatedFriends;

    // Save the updated user data
    await user.save();
    console.log("User data successfully updated.");

    // Optionally, return the updated friends list or any other information
    res.status(200).json(registeredUsers);
  } catch (error) {
    console.error("Error checking contacts:", error);
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
    // updateData.profile_picture=phone_number

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


// exports.updateProfilePictureAndBio = async (req, res) => {
//   try {
//     const phone_number = req.body.userId;

//     // Ensure user exists
//     const user = await User.findOne({ phone_number });
//     if (!user) {
//       return res.status(404).json({ error: "User not found." });
//     }

//     // Remove old profile picture if it exists
//     if (user.profile_picture) {
//       const oldPicturePath = path.join(
//         __dirname,
//         "..",
//         "uploads",
//         user.profile_picture
//       );
//       fs.unlink(oldPicturePath, (err) => {
//         if (err) {
//           console.error("Error deleting old profile picture:", err);
//         }
//       });
//     }
//     // const phone_number = file.originalname.split('.').slice(0, -1).join('.');
//     // Handle new file upload
//     if (req.files && req.files.profilePicture) {
//       const profilePicture = req.files.profilePicture;
      
//       const uploadPath = path.join(
//         __dirname,
//         "..",
//         "uploads",
//         profilePicture.name
//       );

//       // Save the new profile picture
//       profilePicture.mv(uploadPath, async (err) => {
//         if (err) {
//           return res
//             .status(500)
//             .json({ error: "Error uploading new profile picture." });
//         }

//         // Update user profile picture path in the database
//         user.profile_picture = profilePicture.name;
//         // Update bio if provided in the request
//       });
//     }

//     if (req.body.bio) {
//       user.bio = req.body.bio.trim();
//     }

//     // Update username if provided in the request
//     if (req.body.username) {
//       user.name = req.body.username.trim();
//     }

//     await user.save();

//     return res.json({ message: "Profile updated successfully." });
//   } catch (error) {
//     console.error("Error updating profile:", error);
//     return res.status(500).json({ error: "Failed to update profile." });
//   }
// };


// exports.updateProfilePictureAndBio = async (req, res) => {
//   try {
//     const phone_number = req.body.userId;

//     console.log("Request received to update profile for user:", phone_number);

//     // Ensure the user exists
//     const user = await User.findOne({ phone_number });
//     if (!user) {
//       console.error("User not found:", phone_number);
//       return res.status(404).json({ error: "User not found." });
//     }
//     console.log("User found:", user);

//     // Remove the old profile picture if it exists
//     if (user.profile_picture) {
//       const oldPicturePath = path.join(__dirname, "..", "uploads", user.profile_picture);
//       console.log("Deleting old profile picture at:", oldPicturePath);

//       try {
//         if (fs.existsSync(oldPicturePath)) {
//           await fs.promises.unlink(oldPicturePath); // Ensure the deletion is handled asynchronously
//           console.log("Old profile picture deleted successfully.");
//         }
//       } catch (err) {
//         console.error("Error deleting old profile picture:", err);
//       }
//     }

//     // Handle new profile picture upload
//     if (req.files && req.files.profilePicture) {
//       const profilePicture = req.files.profilePicture;
//       const timestamp = Date.now(); // Generate a unique timestamp for the URL
//       const fileExtension = path.extname(profilePicture.name);
//       const newFileName = `${phone_number}_${timestamp}${fileExtension}`;
//       const uploadPath = path.join(__dirname, "..", "uploads", newFileName);

//       console.log("Uploading new profile picture:", uploadPath);

//       try {
//         // Save the new profile picture
//         await profilePicture.mv(uploadPath);
//         console.log("Profile picture uploaded successfully.");

//         // Update the profile picture name in the database
//         user.profile_picture = newFileName;
//         user.last_profile_picture_updated = new Date(timestamp); // Ensure the last update timestamp is in sync with the filename
//       } catch (err) {
//         console.error("Error uploading new profile picture:", err);
//         return res.status(500).json({ error: "Error uploading new profile picture." });
//       }
//     } else {
//       console.log("No new profile picture uploaded.");
//     }

//     // Update bio if provided
//     if (req.body.bio) {
//       user.bio = req.body.bio.trim();
//       console.log("Bio updated:", user.bio);
//     } else {
//       console.log("No bio update provided.");
//     }

//     // Update username if provided
//     if (req.body.username) {
//       user.name = req.body.username.trim();
//       console.log("Username updated:", user.name);
//     } else {
//       console.log("No username update provided.");
//     }

//     // Save the updated user details to the database
//     await user.save();
//     console.log("User profile updated in database.");

//     // Generate an immutable URL for the profile picture
//     const avatarUrl = user.profile_picture
//       ? `${req.protocol}://${req.get("host")}/uploads/${user.profile_picture}?t=${Date.now()}`
//       : null;

//     console.log("Avatar URL generated:", avatarUrl);

//     // Respond with updated user details
//     return res.json({
//       message: "Profile updated successfully.",
//       data: {
//         phone_number: user.phone_number,
//         name: user.name,
//         bio: user.bio,
//         profile_picture: avatarUrl,
//       },
//     });
//   } catch (error) {
//     console.error("Error updating profile:", error);
//     return res.status(500).json({ error: "Failed to update profile." });
//   }
// };


exports.updateProfilePictureAndBio = async (req, res) => {
  try {
    const phone_number = req.body.userId;

    console.log("Request received to update profile for user:", phone_number);

    // Ensure the user exists
    const user = await User.findOne({ phone_number });
    if (!user) {
      console.error("User not found:", phone_number);
      return res.status(404).json({ error: "User not found." });
    }
    console.log("User found:", user);

    // Handle new profile picture upload
    if (req.files && req.files.profilePicture) {
      const profilePicture = req.files.profilePicture;

      // Remove the old profile picture if it exists
      if (user.profile_picture) {
        const oldPicturePath = path.join(__dirname, "..", "uploads", user.profile_picture);
        console.log("Deleting old profile picture at:", oldPicturePath);

        try {
          if (fs.existsSync(oldPicturePath)) {
            await fs.promises.unlink(oldPicturePath); // Ensure the deletion is handled asynchronously
            console.log("Old profile picture deleted successfully.");
          }
        } catch (err) {
          console.error("Error deleting old profile picture:", err);
        }
      }

      // Upload the new profile picture
      const timestamp = Date.now(); // Generate a unique timestamp for the URL
      const fileExtension = path.extname(profilePicture.name);
      const newFileName = `${phone_number}_${timestamp}${fileExtension}`;
      const uploadPath = path.join(__dirname, "..", "uploads", newFileName);

      console.log("Uploading new profile picture:", uploadPath);

      try {
        // Save the new profile picture
        await profilePicture.mv(uploadPath);
        console.log("Profile picture uploaded successfully.");

        // Update the profile picture name in the database
        user.profile_picture = newFileName;
        user.last_profile_picture_updated = new Date(timestamp); // Ensure the last update timestamp is in sync with the filename
      } catch (err) {
        console.error("Error uploading new profile picture:", err);
        return res.status(500).json({ error: "Error uploading new profile picture." });
      }
    } else {
      console.log("No new profile picture uploaded. Retaining the existing picture.");
    }

    // Update bio if provided
    if (req.body.bio) {
      user.bio = req.body.bio.trim();
      console.log("Bio updated:", user.bio);
    } else {
      console.log("No bio update provided.");
    }

    // Update username if provided
    if (req.body.username) {
      user.name = req.body.username.trim();
      console.log("Username updated:", user.name);
    } else {
      console.log("No username update provided.");
    }

    // Save the updated user details to the database
    await user.save();
    console.log("User profile updated in database.");

    // Generate an immutable URL for the profile picture
    const avatarUrl = user.profile_picture
      ? `${req.protocol}://${req.get("host")}/uploads/${user.profile_picture}?t=${Date.now()}`
      : null;

    console.log("Avatar URL generated:", avatarUrl);

    // Respond with updated user details
    return res.json({
      message: "Profile updated successfully.",
      data: {
        phone_number: user.phone_number,
        name: user.name,
        bio: user.bio,
        profile_picture: avatarUrl,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Failed to update profile." });
  }
};




exports.deleteProfilePicture = async (req, res) => {
  try {
    const phone_number = req.body.userId;

    // Ensure the user exists
    const user = await User.findOne({ phone_number });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Remove the profile picture from the filesystem if it exists
    if (user.profile_picture) {
      const oldPicturePath = path.join(
        __dirname,
        "..",
        "uploads",
        user.profile_picture
      );

      try {
        if (fs.existsSync(oldPicturePath)) {
          // Delete the profile picture from the file system
          await fs.promises.unlink(oldPicturePath);
        }
      } catch (err) {
        console.error("Error deleting old profile picture:", err);
      }

      // Set the profile picture field to null in the database
      const timestamp = Date.now(); // Generate a unique timestamp for the URL
      user.profile_picture = null;
      user.last_profile_picture_updated = new Date(timestamp); 
      await user.save();
    }
console.log("deletedSuccessfully")
    // Respond with success
    return res.json({
      message: "Profile picture deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting profile picture:", error);
    return res.status(500).json({ error: "Failed to delete profile picture." });
  }
};
exports.getUpdatedContacts = async (req, res) => {
  try {
    console.log("Received request to get updated contacts.", { query: req.query });

    const { phone_number, lastSyncTimestamp } = req.query; // User's phone number and last sync timestamp from query params

    // Validate lastSyncTimestamp
    if (!lastSyncTimestamp) {
      console.log("Missing last-sync-timestamp header.");
      return res.status(400).json({ error: "Missing last-sync-timestamp header." });
    }

    // Validate phone_number
    if (!phone_number) {
      console.log("Missing phone number in the request.");
      return res.status(400).json({ error: "Missing phone number in the request." });
    }

    console.log("Fetching user with phone number:", phone_number);

    // Fetch the user to get their contacts (friends list)
    const user = await User.findOne({ phone_number });
    if (!user) {
      console.log("User not found for phone number:", phone_number);
      return res.status(404).json({ error: "User not found." });
    }

    console.log("User found:", user);
    const contacts = user.friends; // Assuming 'friends' stores the phone numbers or user IDs of the user's contacts
    console.log("User's contacts (friends list):", contacts);

    // Query to get all users from the contacts list who have been updated after the last sync timestamp
    const updatedContacts = await User.find({
      phone_number: { $in: contacts },
      updated_at: { $gt: new Date(lastSyncTimestamp) },
    });

    console.log("Updated contacts found:", updatedContacts);

    // Map to return only specific fields
    const updatedContactsDetails = updatedContacts.map((user) => ({
      phone_number: user.phone_number,
      name: user.name,
      profile_picture: user.profile_picture,
      bio: user.bio,
      last_bio_updated: user.last_bio_updated,
      last_public_key_updated: user.last_public_key_updated,
      last_profile_picture_updated: user.last_profile_picture_updated,
    }));

    console.log("Mapped updated contact details:", updatedContactsDetails);

    res.json(updatedContacts);
  } catch (error) {
    console.error("Error fetching updated contacts:", error);
    res.status(500).json({ error: "Error fetching updated contacts." });
  }
};



exports.deleteUserAccount = async (req, res) => {
  console.log(req.params);

  const { userId: phoneNumber } = req.params;

  try {
    // Step 1: Find the user by phone_number
    console.log(`Attempting to find user with phone number: ${phoneNumber}`);
    const user = await User.findOne({ phone_number: phoneNumber });
    
    if (!user) {
      console.log(`User with phone number ${phoneNumber} not found`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`User with phone number ${phoneNumber} found. Proceeding with deletion.`);

    // Step 2: Delete user from the User collection
    await User.deleteOne({ phone_number: phoneNumber });
    console.log(`User with phone number ${phoneNumber} has been deleted successfully.`);

    // Step 3: Send success response
    res.status(200).json({
      success: true,
      message: `User with phone number ${phoneNumber} has been deleted successfully.`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};




exports.getProfileImage = async (req, res) => {
  try {
    const { filename } = req.params;
    console.log(req.params, "params");
    console.log(`Received request for image: ${filename}`);

    // Validate the filename format: +<country_code><phone_number>_<timestamp>.<extension>
    const filenamePattern = /^\+\d{1,4}\d{7,15}_\d+\.[a-zA-Z0-9]+$/; // E.g., +918897540734_1696543200.jpg
    if (!filenamePattern.test(filename)) {
      console.warn(`Invalid filename format: ${filename}`);
      return res.status(400).json({ error: "Invalid filename format." });
    }

    // Extract phone number and timestamp from the filename (splitting based on _)
    const [phone_number, timestampWithExtension] = filename.split("_");
    const fileExtension = path.extname(filename);
    const timestamp = timestampWithExtension.replace(fileExtension, ""); // Remove the extension from timestamp

    // Ensure the user exists based on phone number
    const user = await User.findOne({ phone_number });
    if (!user) {
      console.error(`User not found with phone number: ${phone_number}`);
      return res.status(404).json({ error: "User not found." });
    }

    // Validate and compare the timestamp
    const parsedTimestamp = Number(timestamp); // Convert the timestamp to a number
    if (isNaN(parsedTimestamp)) {
      console.warn(`Invalid timestamp format in filename: ${filename}`);
      return res.status(400).json({ error: "Invalid image timestamp format." });
    }

    if (parsedTimestamp !== user.last_profile_picture_updated.getTime()) {
      console.warn(`Timestamp mismatch for user: ${phone_number}`);
      return res.status(400).json({ error: "Invalid image timestamp." });
    }

    // Construct the file path based on the validated filename
    const filePath = path.join(uploadDirectory, filename);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Image not found: ${filePath}`);
      return res.status(404).json({ error: "Image not found." });
    }

    // Log that the image will be sent
    console.log(`Sending image: ${filePath}`);

    // Set caching headers for optimal performance
    res.set({
      "Cache-Control": "public, max-age=31536000, immutable", // Caching for 1 year
    });

    // Send the image file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("Error sending image:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error serving the image." });
        }
      } else {
        console.log(`Successfully sent image: ${filename}`);
      }
    });
  } catch (error) {
    // Log any unexpected errors
    console.error("Error fetching image:", error);
    res.status(500).json({ error: "Failed to fetch image." });
  }
};


