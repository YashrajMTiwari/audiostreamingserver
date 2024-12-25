const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket server is listening on ws://localhost:8080');

// This object holds the active streams (audio data) for each device
const devices = {};

wss.on('connection', (ws) => {
  let deviceId = null;
  let streamId = null;  // Unique stream identifier per device

  // Handle incoming messages (audio data or requests)
  ws.on('message', (message) => {
    const msg = message.toString();

    if (!deviceId) {
      // The first message should be the device ID
      deviceId = msg;
      devices[deviceId] = devices[deviceId] || [];
      console.log(`Device ${deviceId} connected.`);
      ws.send(`Welcome device ${deviceId}`);
    } else if (msg.startsWith("REQUEST_AUDIO:")) {
      // Handle audio stream request
      const requestedDeviceId = msg.split(":")[1];
      if (devices[requestedDeviceId]) {
        // Device is available, start streaming audio to the client
        devices[requestedDeviceId].forEach(client => {
          // Forward audio data to the requesting client
          client.ws.send(`Streaming audio for device: ${requestedDeviceId}`);
        });
      } else {
        // Device is not available, notify client
        ws.send(`Device ${requestedDeviceId} is not available.`);
      }
    } else {
      // Audio data message: forward it to the requesting client
      if (!streamId) {
        // Create a unique stream ID for this session
        streamId = generateStreamId();
        devices[deviceId].push({ streamId, ws });
        console.log(`New stream created for device ${deviceId} with streamId ${streamId}`);
      }

      // Process the incoming audio data (no storage, just forwarding it)
      console.log(`Forwarding audio data from device ${deviceId}, streamId ${streamId}`);

      // Forward the audio data to any connected client who requested this stream
      devices[deviceId].forEach(client => {
        client.ws.send(message);  // Forward the raw audio data
      });
    }
  });

  // Handle disconnections
  ws.on('close', () => {
    if (deviceId) {
      // Remove the device's stream(s) from the list
      devices[deviceId] = devices[deviceId].filter(stream => stream.ws !== ws);
      console.log(`Device ${deviceId} disconnected.`);
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.log(`Error: ${error}`);
  });
});

// Helper function to generate a unique stream ID
function generateStreamId() {
  return Math.random().toString(36).substr(2, 9);  // Random 9-character ID
}

// To gracefully handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  wss.close(() => {
    process.exit(0);
  });
});
