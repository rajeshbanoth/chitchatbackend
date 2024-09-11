const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const User = require('../models/User'); // Assuming you have a User model


const { parsePhoneNumberFromString } = require('libphonenumber-js');
const normalizePhoneNumber = (number) => {
  try {
    // console.log(`Input number: ${number}`);
    
    // Parse the phone number
    const phoneNumber = parsePhoneNumberFromString(number, 'IN'); // Specify default region if needed

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

exports.createUser = async (req, res) => {

  console.log(req.body,"new")
  
  const { mobile_number } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ mobile_number });
    if (existingUser) {
      return res.status(200).json({ message: 'User already exists' , user_id: existingUser.user_id });
    }

    // Generate a unique user ID in UUID format
    const user_id = uuidv4();

    console.log(user_id,"asd")

    // Create a new user
    const newUser = new User({
      user_id,
      mobile_number,
      otp: null,
      is_verified: false,
      profile_photo: null,
      bio: null,
      last_online: null,
    });

    // Save the new user to the database
    await newUser.save();

    res.status(201).json({ message: 'User created successfully', user_id: newUser.user_id });
  } catch (error) {
    console.log(error,"as")
    res.status(400).json({ message: 'Error creating user', error: error.message });
  }
};


exports.checkContacts = async (req, res) => {
  try {
    const { contacts } = req.body; // Expecting an array of mobile numbers
     console.log(contacts,"contacts")
    console.log(contacts)
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Invalid contacts format' });
    }

    // Normalize the input contacts
    const normalizedContacts = contacts.map(normalizePhoneNumber).filter(Boolean);

    // Find registered users whose mobile numbers match the normalized contacts
    const registeredUsers = await User.find({ mobile_number: { $in: normalizedContacts } });

    res.status(200).json(registeredUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check contacts' });
  }
};
// Other user-related controller methods...
