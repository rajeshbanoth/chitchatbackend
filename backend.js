const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Use Glitch's writable path for file storage
const uploadDir = path.join(__dirname, "uploads");

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const metadataFile = path.join(uploadDir, "metadata.json");

// HTTP server with Socket.IO
const server = http.createServer(app);
const io = socketIo(server);

// Helper function to save chunks
const saveChunkToFile = (chunk, chunkIndex, uploadId) => {
  const chunkPath = path.join(uploadDir, `${uploadId}_chunk_${chunkIndex}`);
  fs.writeFileSync(chunkPath, chunk, { encoding: "base64" });
};

// Helper function to remove all chunks after merge
const removeChunks = (uploadId, totalChunks) => {
  const chunkRemovalPromises = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(uploadDir, `${uploadId}_chunk_${i}`);
    chunkRemovalPromises.push(fs.promises.unlink(chunkPath));  // Asynchronously remove chunk
  }

  return Promise.all(chunkRemovalPromises);
};

// Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log("Client connected.");

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

  // Handle upload completion
  socket.on("upload_complete", ({ uploadId, totalChunks, fileName }) => {
    console.log(`Upload complete for ${uploadId}. Assembling file...`);
    if (!fileName) {
      return socket.emit("error", { error: "File name is missing." });
    }

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
          socket.emit("error", { error: `Error processing chunk ${i}` });
          return;
        }
      } else {
        console.error(`Chunk ${i} missing`);
        socket.emit("error", { error: `Chunk ${i} missing` });
        return;
      }
    }

    writeStream.end();

    writeStream.on("finish", async () => {
      console.log(`File assembled at ${finalFilePath}, total chunks: ${chunkCount}`);

      // After the file is successfully assembled, remove all chunk files
      try {
        await removeChunks(uploadId, totalChunks);
        console.log("Chunks removed successfully.");

        // Notify the client that the upload is complete
        socket.emit("upload_complete", {
          status: "success",
          link: `https://flat-hallowed-meadowlark.glitch.me/download/${fileName}`,
        });
      } catch (err) {
        console.error("Error removing chunks:", err);
        socket.emit("error", { error: "Error removing chunks after file assembly" });
      }
    });

    writeStream.on("error", (err) => {
      console.error("Error while writing the file:", err);
      socket.emit("error", { error: "Error while writing the file" });
    });
  });

  // Save metadata
  socket.on("metadata", (metadata) => {
    fs.writeFileSync(metadataFile, JSON.stringify(metadata));
    console.log("Metadata saved:", metadata);
    socket.emit("metadata_status", { status: "metadata_saved" });
  });

  // Handle download requests
  socket.on("download_request", ({ fileName }) => {
    const filePath = path.join(uploadDir, fileName);

    // Check if file exists
    if (fs.existsSync(filePath)) {
      console.log(`Sending file ${fileName} to client.`);

      // Read the file in chunks and send via Socket.IO
      const fileStream = fs.createReadStream(filePath);
      fileStream.on("data", (chunk) => {
        socket.emit("download_chunk", { chunk });
      });

      fileStream.on("end", () => {
        console.log("File sent successfully.");
        socket.emit("download_complete", { status: "success" });
      });

      fileStream.on("error", (err) => {
        console.error("Error reading file:", err);
        socket.emit("error", { error: "Error downloading file." });
      });
    } else {
      console.log(`File ${fileName} not found.`);
      socket.emit("error", { error: "File not found." });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected.");
  });
});

// Serve files for download
app.get("/download/:fileName", (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(uploadDir, fileName);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send("File not found.");
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
