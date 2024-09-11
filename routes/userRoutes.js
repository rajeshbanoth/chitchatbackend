const express = require('express');
const { check } = require('express-validator');
const userController = require('../controllers/userController');

const { checkContacts } = require('../controllers/userController');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

router.post('/users/authenticate', [
  
  check('mobile_number').isMobilePhone().withMessage('Invalid mobile number'),
  // check('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits long'),
  // check('profile_photo').optional().isURL().withMessage('Invalid URL for profile photo'),
], validateRequest, userController.createUser);

router.post('/checkContacts', checkContacts);

// Define other user routes...

module.exports = router;
