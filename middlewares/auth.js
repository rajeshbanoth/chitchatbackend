const jwt = require('jsonwebtoken');
const AuthSession = require('../models/authSessionModel');
const User = require('../models/usersModel');


exports.authenticate = async (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ error: 'No token provided.' });
    }

    jwt.verify(token, 'your_jwt_secret', async (err, decoded) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to authenticate token.' });
        }

        const session = await AuthSession.findOne({ session_token: token, is_active: true });
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session.' });
        }

        req.user = decoded;
        next();
    });
};



// const authMiddleware = async (req, res, next) => {
//   const token = req.headers['authorization'];

//   if (!token) {
//     return res.status(401).json({ error: 'No token provided.' });
//   }

//   try {
//     const decoded = jwt.verify(token, 'your_jwt_secret'); // Replace with your secret key
//     req.user = await User.findById(decoded.userId); // Attach the user object to the request
//     if (!req.user) {
//       return res.status(404).json({ error: 'User not found.' });
//     }
//     next();
//   } catch (error) {
//     console.error('Error verifying token:', error);
//     return res.status(401).json({ error: 'Invalid token.' });
//   }
// };

// module.exports = authMiddleware;

