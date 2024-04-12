const WebSocket = require("ws");
const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let storedColors = { pmColor: "00FF00", tempColor: "FF0000" };

app.use(express.static("public"));

app.get("/setColor", (req, res) => {
  const { firstColor, secondColor } = req.query;
  storedColors = { pmColor: firstColor, tempColor: secondColor };
  broadcastColors();
  res.send("Colors updated and broadcasted");
});

wss.on("connection", function connection(ws) {
  ws.on("message", function incoming(message) {
    console.log("received: %s", message);
  });

  ws.on("close", () => {
    console.log("Client has disconnected");
  });
});

function broadcastColors() {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(storedColors));
    }
  });
}

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
