const User = require("../models/usersModel");



// exports.blockUser = async (req, res) => {
//     const { userId, blockedUserId } = req.body;


  
//     try {
//       // Find the user by ID
//       const user = await User.findById(userId);
  
//       if (!user) {
//         return res.status(404).json({ success: false, message: 'User not found' });
//       }
  
//       // Check if the user is already blocked
//       const isAlreadyBlocked = user.blocked_users.some(
//         (blocked) => blocked.user_id === blockedUserId
//       );
  
//       if (isAlreadyBlocked) {
//         return res
//           .status(400)
//           .json({ success: false, message: 'User is already blocked' });
//       }
 
//       // Add the blocked user
//       user.blocked_users.push({ user_id: blockedUserId, blocked_at: new Date() });
//       await user.save();
  
//       res.status(200).json({
//         success: true,
//         message: `User ${blockedUserId} has been blocked successfully`,
//       });
//     } catch (error) {
//       console.error('Error blocking user:', error);
//       res.status(500).json({ success: false, message: 'Internal server error' });
//     }
//   };
  

//   exports.unblockUser = async (req, res) => {
//     const { userId, blockedUserId } = req.body;
  
//     try {
//       // Find the user by ID
//       const user = await User.findById(userId);
  
//       if (!user) {
//         return res.status(404).json({ success: false, message: 'User not found' });
//       }
  
//       // Check if the user is in the blocked list
//       const isBlocked = user.blocked_users.some(
//         (blocked) => blocked.user_id === blockedUserId
//       );
  
//       if (!isBlocked) {
//         return res
//           .status(400)
//           .json({ success: false, message: 'User is not blocked' });
//       }
  
//       // Remove the blocked user from the list
//       user.blocked_users = user.blocked_users.filter(
//         (blocked) => blocked.user_id !== blockedUserId
//       );
  
//       await user.save();
  
//       res.status(200).json({
//         success: true,
//         message: `User ${blockedUserId} has been unblocked successfully`,
//       });
//     } catch (error) {
//       console.error('Error unblocking user:', error);
//       res.status(500).json({ success: false, message: 'Internal server error' });
//     }
//   };
  
  
exports.blockUser = async (req, res) => {
    const { userId, blockedUserId } = req.body;
    
    console.log(`Block request received: userId=${userId}, blockedUserId=${blockedUserId}`);
  
    try {
      // Find the user by phone_number
      const user = await User.findOne({ phone_number: userId });
      if (!user) {
        console.log(`User not found with phone_number: ${userId}`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      // Check if the user is already blocked
      const isAlreadyBlocked = user.blocked_users.some(
        (blocked) => blocked.user_id === blockedUserId
      );
      
      if (isAlreadyBlocked) {
        console.log(`User ${blockedUserId} is already blocked.`);
        return res.status(400).json({ success: false, message: 'User is already blocked' });
      }
      
      // Add the blocked user
      user.blocked_users.push({ user_id: blockedUserId, blocked_at: new Date() });
      await user.save();
      console.log(`User ${blockedUserId} has been blocked successfully.`);
    
      res.status(200).json({
        success: true,
        message: `User ${blockedUserId} has been blocked successfully`,
      });
    } catch (error) {
      console.error('Error blocking user:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  
  exports.unblockUser = async (req, res) => {
    const { userId, blockedUserId } = req.body;
    
    console.log(`Unblock request received: userId=${userId}, blockedUserId=${blockedUserId}`);
  
    try {
      // Find the user by phone_number
      const user = await User.findOne({ phone_number: userId });
      if (!user) {
        console.log(`User not found with phone_number: ${userId}`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    
      // Check if the user is in the blocked list
      const isBlocked = user.blocked_users.some(
        (blocked) => blocked.user_id === blockedUserId
      );
    
      if (!isBlocked) {
        console.log(`User ${blockedUserId} is not blocked.`);
        return res.status(400).json({ success: false, message: 'User is not blocked' });
      }
    
      // Remove the blocked user from the list
      user.blocked_users = user.blocked_users.filter(
        (blocked) => blocked.user_id !== blockedUserId
      );
    
      await user.save();
      console.log(`User ${blockedUserId} has been unblocked successfully.`);
    
      res.status(200).json({
        success: true,
        message: `User ${blockedUserId} has been unblocked successfully`,
      });
    } catch (error) {
      console.error('Error unblocking user:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  
  