import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Random from "expo-random";
import io from "socket.io-client";
import CryptoJS from "crypto-js";

// Polyfill Buffer for React Native
import { Buffer } from "buffer";
global.Buffer = global.Buffer || Buffer;

const chunkSize = 64 * 1024; // 64KB
const socketServer = "https://flat-hallowed-meadowlark.glitch.me"; // Your backend URL

export default function App() {
  const [socket, setSocket] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadLink, setDownloadLink] = useState("");

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(socketServer, {
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      console.log("Connected to server");
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    newSocket.on("upload_progress", (progress) => {
      setUploadProgress(progress);
    });

    newSocket.on("upload_complete", (data) => {
      Alert.alert("Upload Complete", `Download Link: ${data.link}`);
      setDownloadLink(data.link);
      setIsUploading(false);
    });

    setSocket(newSocket);

    // Cleanup socket on unmount
    return () => newSocket.disconnect();
  }, []);

  const pickFileAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });


console.log(res,"res")
      if (!res.canceled) {
        const fileUri = Platform.OS === "web" ? res.assets[0].uri :res.assets[0].uri;
        const secretKey = await generateSecureKey();
         const uploadId = new Date().toISOString(); // Generate a unique uploadId
        await encryptAndUpload(fileUri, secretKey, uploadId);
        
      } else {
        console.log("File picker was cancelled");
      }
    } catch (err) {
      console.error("Error picking file:", err);
      Alert.alert("Error", "Failed to pick the file. Try again.");
    }
  };

  const encryptAndUpload = async (fileUri, secretKey, uploadId) => {
  if (!socket || !socket.connected) {
    Alert.alert("Socket not connected", "Please try again later.");
    return;
  }

  let fileSize;
  if (Platform.OS === "web") {
    const fileBlob = await fetch(fileUri).then((res) => res.blob());
    fileSize = fileBlob.size;
  } else {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    fileSize = fileInfo.size;
  }

  let offset = 0;
  let chunkIndex = 0;

  setIsUploading(true);
  setUploadProgress(0);

  while (offset < fileSize) {
    try {
      const chunk = await readChunk(fileUri, offset, chunkSize);
      const iv = await generateSecureIV();
      const encryptedChunk = CryptoJS.AES.encrypt(chunk, secretKey, { iv }).toString();

      // Emit encrypted chunk
      socket.emit("upload_chunk", {
        chunk: encryptedChunk,
        chunkIndex,
        uploadId, // Send the uploadId with each chunk
      });

      console.log(`Chunk ${chunkIndex} emitted successfully`);

      offset += chunkSize;
      chunkIndex++;

      const progress = Math.min((offset / fileSize) * 100, 100);
      setUploadProgress(progress); // Update upload progress

      // Optional: Add small delay to prevent overwhelming the socket
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Error processing chunk at offset ${offset}:`, error);
      setIsUploading(false);
      Alert.alert("Error", "An error occurred during upload.");
      return;
    }
  }

  // Finalize upload
  socket.emit("upload_complete", {
    uploadId,
    totalChunks: chunkIndex,
    fileName: "RajeshBanoth",
  });

  console.log("Upload complete emitted");
  setIsUploading(false);
};

// const encryptAndUpload = async (fileUri, secretKey, uploadId) => {
//   if (!socket || !socket.connected) {
//     Alert.alert("Socket not connected", "Please try again later.");
//     return;
//   }

//   let fileSize;
//   if (Platform.OS === "web") {
//     const fileBlob = await fetch(fileUri).then((res) => res.blob());
//     fileSize = fileBlob.size;
//   } else {
//     const fileInfo = await FileSystem.getInfoAsync(fileUri);
//     fileSize = fileInfo.size;
//   }

//   let offset = 0;
//   let chunkIndex = 0;

//   setIsUploading(true);  // Start upload indicator
//   setUploadProgress(0);  // Reset progress

//   while (offset < fileSize) {
//     try {
//       const chunk = await readChunk(fileUri, offset, chunkSize);
//       const iv = await generateSecureIV();
//       const encryptedChunk = CryptoJS.AES.encrypt(chunk, secretKey, { iv }).toString();

//       // Emit encrypted chunk
//       socket.emit("upload_chunk", {
//         chunk: encryptedChunk,
//         chunkIndex,
//         uploadId, // Send the uploadId with each chunk
//       });

//       console.log(`Chunk ${chunkIndex} emitted successfully`);

//       // Update offset and chunkIndex after emitting the chunk
//       offset += chunkSize;
//       chunkIndex++;

//       // Calculate and set upload progress after each chunk
//       const progress = Math.min((offset / fileSize) * 100, 100);
//       setUploadProgress(progress);

//       // Optional: Delay to avoid overwhelming the socket
//       await new Promise((resolve) => setTimeout(resolve, 50));
//     } catch (error) {
//       console.error(`Error processing chunk at offset ${offset}:`, error);
//       setIsUploading(false);
//       Alert.alert("Error", "An error occurred during upload.");
//       return;
//     }
//   }

//   // Finalize upload when all chunks are sent
//   socket.emit("upload_complete", {
//     uploadId,
//     totalChunks: chunkIndex,
//     fileName: "Rajesh", // Set the file name here
//   });

//   console.log("Upload complete emitted");
//   setIsUploading(false);  // Stop upload indicator
// };



  const generateSecureKey = async () => {
    const keyBytes = await Random.getRandomBytesAsync(32); // 256-bit key
    return CryptoJS.enc.Hex.parse(Buffer.from(keyBytes).toString("hex"));
  };

  const generateSecureIV = async () => {
    const ivBytes = await Random.getRandomBytesAsync(16); // 128-bit IV
    return CryptoJS.enc.Hex.parse(Buffer.from(ivBytes).toString("hex"));
  };

  const readChunk = async (fileUri, start, length) => {
    if (Platform.OS === "web") {
      // Web: Read chunks using FileReader API
      const fileBlob = await fetch(fileUri).then((res) => res.blob());
      const slice = fileBlob.slice(start, start + length);
      return slice.text();
    } else {
      // Native platforms
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileContent.slice(start, start + length);
    }
  };

const downloadAndDecrypt = async () => {
  if (!socket || !downloadLink) {
    Alert.alert("Socket not connected", "Please try again later.");
    return;
  }

  // Request the file download
  socket.emit("download_request", { fileName: "Rajesh" });

  let fileData = [];
  let totalFileSize = 0;
  let receivedSize = 0;

  // Listen for file size info
  socket.on("file_info", (data) => {
    totalFileSize = data.size; // Set the total file size
  });

  // Listen for file chunks and update progress
  socket.on("download_chunk", (data) => {
    fileData.push(data.chunk);
    receivedSize += data.chunk.length; // Add the chunk's size to the received size

    // Calculate and update progress
    const progress = Math.min((receivedSize / totalFileSize) * 100, 100);
    setDownloadProgress(progress); // Update the state with progress percentage
  });

  // Listen for download completion
  socket.on("download_complete", () => {
    // Combine all the chunks into a single Blob and create a download link
    const fileBlob = new Blob(fileData);
    const fileURL = URL.createObjectURL(fileBlob);

    // Create a temporary link to trigger file download
    const a = document.createElement("a");
    a.href = fileURL;
    a.download = downloadLink; // Set the filename to the requested one
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    Alert.alert("Download Complete", "The file has been successfully downloaded and decrypted.");
  });

  // Handle error response
  socket.on("error", (error) => {
    Alert.alert("Download Error", error.error);
  });
};



// const downloadAndDecrypt = async () => {
//   if (!socket || !downloadLink) {
//     Alert.alert("Socket not connected", "Please try again later.");
//     return;
//   }

//   // Request the file download
//   socket.emit("download_request", { fileName: "Rajesh" });

//   let fileData = [];
//   let totalFileSize = 0;
//   let receivedSize = 0;
//   let secretKey = ""; // The key you used for encryption (retrieve or store it securely)

//   // Listen for file size info
//   socket.on("file_info", (data) => {
//     totalFileSize = data.size; // Set the total file size
//   });

//   // Listen for file chunks and update progress
//   socket.on("download_chunk", async (data) => {
//     try {
//       const decryptedChunk = await decryptChunk(data.chunk, secretKey);
//       fileData.push(decryptedChunk);
//       receivedSize += decryptedChunk.length; // Add the chunk's size to the received size

//       // Calculate and update progress
//       const progress = Math.min((receivedSize / totalFileSize) * 100, 100);
//       setDownloadProgress(progress); // Update the state with progress percentage
//     } catch (error) {
//       console.error("Error decrypting chunk:", error);
//       Alert.alert("Decryption Error", "An error occurred while decrypting the file.");
//     }
//   });

//   // Listen for download completion
//   socket.on("download_complete", () => {
//     // Combine all the decrypted chunks into a single Blob
//     const fileBlob = new Blob(fileData, { type: "application/octet-stream" });
//     const fileURL = URL.createObjectURL(fileBlob);

//     // Create a temporary link to trigger file download
//     const a = document.createElement("a");
//     a.href = fileURL;
//     a.download = downloadLink; // Set the filename to the requested one
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);

//     Alert.alert("Download Complete", "The file has been successfully downloaded and decrypted.");
//   });

//   // Handle error response
//   socket.on("error", (error) => {
//     Alert.alert("Download Error", error.error);
//   });
// };

// // Decrypt the chunk using AES decryption
// const decryptChunk = (encryptedChunk, secretKey) => {
//   return new Promise((resolve, reject) => {
//     try {
//       // Convert encrypted chunk from base64 and decrypt using AES
//       const bytes = CryptoJS.AES.decrypt(encryptedChunk, secretKey);
//       const decryptedData = bytes.toString(CryptoJS.enc.Utf8); // Convert decrypted bytes to string
//       resolve(decryptedData);
//     } catch (error) {
//       reject(error);
//     }
//   });
// };


  return (
    <View style={styles.container}>
      <Button title="Pick and Upload File" onPress={pickFileAndUpload} disabled={isUploading} />
      {isUploading && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Uploading... {Math.round(uploadProgress)}%</Text>
        </View>
      )}
      <View style={styles.spacer} />
      <TextInput
        style={styles.input}
        placeholder="Paste Download Link Here"
        value={downloadLink}
        onChangeText={setDownloadLink}
      />
      <Button
        title="Download and Decrypt File"
        onPress={downloadAndDecrypt}
        disabled={!downloadLink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  spacer: {
    height: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 20,
  },
  progressContainer: {
    marginTop: 20,
    alignItems: "center",
  },
});
