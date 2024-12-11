const fs = require("fs");
const path = require("path");
const {
  getUserSocketId,
  setUserSocketId,
  setUndeliveredMessages,
  getUndeliveredMessages,
  deleteUndeliveredMessages,
  deleteUserSocketId,
  notifyUndeliveredMessages,
  getUserIdfomSocketId,
  addSenderToList,
  removeSenderFromList,
  getUndeliveredMessageStatus,
  setUndeliveredMessageStatus,
  deleteUndeliveredMessageStatus,
} = require("../redis/redis");

const {
  handleRegister,
  handleBatchMessageStatusUpdate,
  handleSendMessage,
  handleResendMessage,
  handleMessageAcknowledge,
  handleSendFileChunk,
  handleFileTransferComplete,
  handleForwardMessage,
  handleReactToMessage,
  handleDeleteMessage,
  handleEditMessage,
  handleUploadMedia,
  handleSetTimer,
  handleJoinRoom,
  handleCheckUserStatus,
  handleCallInitiation,
  handleCallAccepted,
  handleOffer,
  handleAnswer,
  handleIceCandidate,
  handleEndCall,
  handleDisconnect,
  handleReceiveFileChunk,
  handleReceiveThumbnail,
  handleThumbnail,
  handleDeleteMessageonBothSides,
  handleTypingStatus,
  handleRemoveFromBlockedCache,
  handleAddToBlockedCache,
} = require("../socketEvents/SocketEvents");
const User = require("../models/usersModel");
const FileMetadata = require("../models/FileMetaDataModel");

// Use Glitch's writable path for file storage
// const uploadDir = path.join(__dirname, "uploads/documents");

const uploadDir = path.join(__dirname, "..", "uploads", "attachments");

const thumbnailDir = path.join(__dirname, "..", "uploads", "thumbnails");
// Ensure the upload directory exists at startup
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Ensure the upload directory exists at startup
if (!fs.existsSync(thumbnailDir)) {
  fs.mkdirSync(thumbnailDir, { recursive: true });
}

const saveChunkToFile = (chunk, chunkIndex, uploadId) => {
  try {
    console.log(
      `Starting to save chunk ${chunkIndex} for uploadId ${uploadId}...`
    );

    // Ensure the upload directory exists before saving the chunk
    if (!fs.existsSync(uploadDir)) {
      console.log(
        `Upload directory does not exist. Creating directory: ${uploadDir}`
      );
      fs.mkdirSync(uploadDir, { recursive: true });
    } else {
      console.log(`Upload directory already exists: ${uploadDir}`);
    }

    const chunkPath = path.join(uploadDir, `${uploadId}_chunk_${chunkIndex}`);
    console.log(`Saving chunk to path: ${chunkPath}`);

    fs.writeFileSync(chunkPath, chunk, { encoding: "base64" });

    console.log(
      `Successfully saved chunk ${chunkIndex} for uploadId ${uploadId}`
    );
  } catch (error) {
    console.error(
      `Error while saving chunk ${chunkIndex} for uploadId ${uploadId}:`,
      error
    );
  }
};

// Helper function to save chunks
const saveThumbnailToFile = (chunk, uploadId) => {
  // Ensure the upload directory exists before saving the chunk
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
  }

  const chunkPath = path.join(thumbnailDir, uploadId);
  fs.writeFileSync(chunkPath, chunk, { encoding: "base64" });
};
// Helper function to combine chunks (without removing them after assembly)
const assembleChunks = async (uploadId, totalChunks, fileName) => {
  const finalFilePath = path.join(uploadDir, fileName);

  // Combine all chunks into a single file
  const writeStream = fs.createWriteStream(finalFilePath);
  let chunkCount = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(uploadDir, `${uploadId}_chunk_${i}`);
    if (fs.existsSync(chunkPath)) {
      try {
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        chunkCount++;
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
        return { error: `Error processing chunk ${i}` };
      }
    } else {
      console.error(`Chunk ${i} missing`);
      return { error: `Chunk ${i} missing` };
    }
  }

  writeStream.end();

  return new Promise((resolve, reject) => {
    writeStream.on("finish", () => {
      console.log(
        `File assembled at ${finalFilePath}, total chunks: ${chunkCount}`
      );
      resolve(finalFilePath); // Return the final file path after all chunks are combined
    });

    writeStream.on("error", (err) => {
      console.error("Error while writing the file:", err);
      reject("Error while writing the file");
    });
  });
};

module.exports = (io) => {
  io.use((socket, next) => {
    if (socket.handshake.query) {
      let callerId = socket.handshake.query.callerId;
      socket.user = callerId;
      next();
    } else {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.join(socket.user);

    socket.on("register", (data) => handleRegister(socket, io, data));
    socket.on("batchMessageStatusUpdate", (statusUpdates) =>
      handleBatchMessageStatusUpdate(io, statusUpdates)
    );
    socket.on("sendMessage", (msg) => handleSendMessage(io, msg));
    socket.on("typingStatus", (msg) => handleTypingStatus(io, socket, msg));

    socket.on('removeFromBlockedCache', (msg)=>handleRemoveFromBlockedCache(io,socket,msg));
    // Handle adding user to blocked list in cache
    socket.on('blockUser', (msg) => {
      handleAddToBlockedCache(io, socket, msg);
    });


    socket.on("resendMessage", (msg) => handleResendMessage(io, msg));
    socket.on("messageAcknowledge", (msg) => handleMessageAcknowledge(io, msg));
    socket.on("sendFileChunk", (msg) =>
      handleReceiveFileChunk(io, socket, msg)
    );

    socket.on("DeleteMessageOnBothSides", (msg) => {
      handleDeleteMessageonBothSides(io, socket, msg);
    });

    socket.on("sendThumbnail", (msg) => handleThumbnail(io, socket, msg));
    socket.on("sendFileThumbnail", (msg) => handleReceiveThumbnail(io, msg));
    socket.on("fileTransferComplete", (msg) =>
      handleFileTransferComplete(io, msg)
    );
    socket.on("forwardMessage", (data) => handleForwardMessage(socket, data));
    socket.on("reactToMessage", (data) => handleReactToMessage(io, data));
    socket.on("deleteMessage", (data) => handleDeleteMessage(io, data));
    socket.on("editMessage", (data) => handleEditMessage(io, data));
    socket.on("uploadMedia", (data) => handleUploadMedia(socket, data));
    socket.on("setTimer", (data) => handleSetTimer(io, data));
    socket.on("join", (roomId) => handleJoinRoom(socket, roomId));
    socket.on("checkUserStatus", ({ userId, chatId }) =>
      handleCheckUserStatus(socket, userId, chatId)
    );
    socket.on("call-initiation", (data) => handleCallInitiation(io, data));
    socket.on("call-accepted", (data) => handleCallAccepted(io, data));
    socket.on("offer", (offer, chatId) => handleOffer(socket, offer, chatId));
    socket.on("answer", (answer, chatId) =>
      handleAnswer(socket, answer, chatId)
    );
    socket.on("ice-candidate", (candidate, chatId) =>
      handleIceCandidate(socket, candidate, chatId)
    );
    socket.on("end-call", (chatId) => handleEndCall(socket, chatId));
    socket.on("disconnect", () => handleDisconnect(io, socket));

    // socket.on("upload_chunk",({ hunk, chunkIndex, uploadIdc })=>handleUploadChunk(io,socket,hunk, chunkIndex, uploadId))

    // Handle chunk uploads
    socket.on("upload_chunk", ({ chunk, chunkIndex, uploadId }) => {
      console.log(`Received chunk ${chunkIndex} for upload ID ${uploadId}`);
      saveChunkToFile(chunk, chunkIndex, uploadId);

      // Acknowledge the chunk
      socket.emit("upload_progress", {
        chunkIndex,
        status: "chunk_saved",
      });
    });

    // Handle chunk uploads
    socket.on("upload_thumnbail", ({ chunk, uploadId }) => {
      console.log(uploadId, "thumbnaui");
      saveThumbnailToFile(chunk, uploadId);
    });

    // Handle upload completion
    socket.on("upload_complete", async (msgdata) => {
      try {
        console.log(msgdata, "message");
        const { receiverId } = msgdata.msgdata;
        const receiver = await User.findOne({ phone_number: receiverId });
        // Retrieve device token from the receiver
        const deviceToken = receiver.deviceToken;
        console.log("Receiver's Device Token:", deviceToken);

        console.log(`Upload complete for ${msgdata}. Assembling file...`);
        const receiverSocketId = await getUserSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receiveMessage", msgdata.msgdata);

          // Save file metadata to the database
          const msgObj = {
            msg_id: msgdata.msgdata.id,
            chatId: msgdata.msgdata.chatId,
            senderId: msgdata.msgdata.senderId,
            receiverId: msgdata.msgdata.receiverId,
            fileName: JSON.parse(msgdata.msgdata.contentUri).uri,
            fileType: msgdata.msgdata.messageType,
            downloadStatus: false,
            expirationDate: new Date(
              new Date().setDate(new Date().getDate() + 10)
            ),
          };

          const fileMetaData = new FileMetadata(msgObj);
          await fileMetaData.save();
          console.log("File metadata saved.");
        } else {
          const newMessage = new Message(msgdata.msgdata);
          await newMessage.save();
          // await addSenderToList(receiverId, senderId);
        }
      } catch (err) {
        socket.emit("error", { error: err });
      }
    });

    // // Save metadata
    // socket.on("fileMetaData", (metadata) => {
    //   fs.writeFileSync(metadataFile, JSON.stringify(metadata));
    //   console.log("Metadata saved:", metadata);
    //   socket.emit("metadata_status", { status: "metadata_saved" });
    // });

    // Listening for download requests
    socket.on("download_request", async ({ fileName, uploadId, totalChunks }) => {
      // Initialize an array to hold the chunks
      const chunks = [];
      const fileCount = countFilesWithSameName(uploadId);
      console.log(
        `There are ${fileCount} files with the name '${uploadId}' in the directory.`
      );
    
      console.log(
        `Request to download: ${fileName} with uploadId: ${uploadId} and totalChunks: ${totalChunks}`
      );
    
      // Retry parameters
      const maxRetries = 3; // Max retries per chunk
      const retryCounts = Array(totalChunks).fill(0); // Array to track retry attempts
    
      // Function to load a chunk and handle errors
      const loadChunk = async (chunkIndex) => {
        const chunkPath = path.join(uploadDir, `${uploadId}_chunk_${chunkIndex}`);
    
        console.log(`Checking path: ${chunkPath}`);
    
        // Check if the chunk exists
        if (fs.existsSync(chunkPath)) {
          try {
            const chunkData = fs.readFileSync(chunkPath); // Read the chunk
            console.log(`Chunk #${chunkIndex} read successfully`);
    
            // Convert the chunk buffer to a Base64 string
            const chunkBase64 = chunkData.toString("base64");
            console.log(
              `Chunk #${chunkIndex} Base64 string length: ${chunkBase64.length}`
            );
    
            // Add the Base64 string to the array
            chunks[chunkIndex] = chunkBase64;
          } catch (error) {
            console.error(`Error reading chunk ${chunkIndex}:`, error);
            throw new Error(`Error reading chunk ${chunkIndex}`);
          }
        } else {
          console.error(`Chunk ${chunkIndex} missing`);
          throw new Error(`Chunk ${chunkIndex} missing`);
        }
      };
    
      // Loop over all the saved chunks and try to load them
      for (let i = 0; i < totalChunks; i++) {
        let retries = 0;
        while (retries < maxRetries) {
          try {
            await loadChunk(i);
            break; // Exit retry loop if chunk is successfully loaded
          } catch (error) {
            retries++;
            console.log(`Retrying chunk #${i}, attempt ${retries}`);
            if (retries === maxRetries) {
              socket.emit("error", { error: `Chunk ${i} failed after ${maxRetries} retries.` });
              return;
            }
          }
        }
      }
    
      console.log("All chunks loaded, starting to send...");
    
      // Send each chunk sequentially with progress
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Sending chunk #${i} of ${fileName}`);
        const progress = Math.floor((i / totalChunks) * 100); // Calculate progress percentage
    
        // Emit the chunk (Base64 string) to the client
        socket.emit("download_chunk", {
          chunk: chunks[i], // Base64 string
          chunkIndexDownloaded: i, // Current chunk index
          progress: progress, // Download progress
        });
    
        console.log(`Sent chunk #${i} of ${fileName}`);
      }
    
      // Finalize download
      socket.emit("download_complete", { status: "success", fileName });
    
      console.log(`All chunks sent for ${uploadId}`);
    });
    

    // Handling chunk retry request from the client
    socket.on("retry_chunk", ({ uploadId, chunkIndex, totalChunks }) => {
      const chunkPath = path.join(uploadDir, `${uploadId}_chunk_${chunkIndex}`);
      if (fs.existsSync(chunkPath)) {
        try {
          const chunkData = fs.readFileSync(chunkPath);
          const chunkBase64 = Buffer.from(chunkData).toString("base64");

          // Emit the chunk to the client again
          socket.emit("download_chunk", {
            chunk: chunkBase64,
            chunkIndexDownloaded: chunkIndex,
            progress: Math.floor((chunkIndex / totalChunks) * 100),
          });
          console.log(`Resending chunk #${chunkIndex} of ${uploadId}`);
        } catch (error) {
          console.error(`Error re-sending chunk #${chunkIndex}:`, error);
          socket.emit("error", {
            error: `Error re-sending chunk #${chunkIndex}`,
          });
        }
      } else {
        console.error(`Chunk ${chunkIndex} not found for ${uploadId}`);
        socket.emit("error", { error: `Chunk ${chunkIndex} not found` });
      }
    });

    // Function to count files with the same name
    const countFilesWithSameName = (filename) => {
      const files = fs.readdirSync(uploadDir); // Read all files in the directory
      const matchingFiles = files.filter((file) => file.includes(filename)); // Filter files with the same name

      console.log(`Matching files found: ${matchingFiles.length}`);
      return matchingFiles.length; // Return the count of matching files
    };
    // socket.on("download_request", async ({ fileName, uploadId, totalChunks }) => {
    //   // Initialize an array to hold the chunks
    //   const chunks = [];

    //   console.log(`Request to download: ${fileName} with uploadId: ${uploadId} and totalChunks: ${totalChunks}`);

    //   // Loop over all the saved chunks and read them
    //   for (let i = 0; i < totalChunks; i++) {
    //     const chunkPath = path.join(uploadDir, `${uploadId}_chunk_${i}`);
    //     console.log(`Checking path: ${chunkPath}`);

    //     // Check if the chunk exists
    //     if (fs.existsSync(chunkPath)) {
    //       try {
    //         const chunkData = fs.readFileSync(chunkPath); // Read the chunk
    //         chunks.push(chunkData); // Add chunk data to the array
    //       } catch (error) {
    //         console.error(`Error reading chunk ${i}:`, error);
    //         socket.emit("error", { error: `Error reading chunk ${i}` });
    //         return;
    //       }
    //     } else {
    //       console.error(`Chunk ${i} missing`);
    //       socket.emit("error", { error: `Chunk ${i} missing` });
    //       return;
    //     }
    //   }

    //   console.log("All chunks loaded, starting to send...");

    //   // Function to send the next chunk after a delay
    //   const sendChunkWithDelay = (index) => {
    //     if (index < chunks.length) {
    //       const chunk = chunks[index];
    //       const progress = Math.floor((index / totalChunks) * 100); // Calculate progress percentage
    //       console.log(`Sending chunk #${index} of ${fileName}`);

    //       if (Buffer.isBuffer(chunk)) {
    //         // Convert the chunk buffer to Base64
    //         const chunkBase64 = Buffer.from(chunk).toString("base64");

    //         // Emit the chunk with Base64 data to the client
    //         socket.emit("download_chunk", {
    //           chunk: chunkBase64,
    //           chunkIndexDownloaded: index,
    //           progress: progress,
    //         });

    //         console.log(`Sent chunk #${index} of ${fileName}`);
    //       } else {
    //         console.log(`Chunk #${index} is not a Buffer, skipping.`);
    //       }

    //       // Recursively send the next chunk after a delay (1 second in this case)
    //       setTimeout(() => sendChunkWithDelay(index + 1), 100); // Adjust the timeout (1000ms = 1 second)
    //     } else {
    //       // Finalize download after all chunks are sent
    //       socket.emit("download_complete", { status: "success", fileName });
    //       console.log(`All chunks sent for ${uploadId}`);
    //     }
    //   };

    //   // Start sending chunks from index 0
    //   sendChunkWithDelay(0);
    // });
  });
};
