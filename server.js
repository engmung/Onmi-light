const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let storedData = {
  pmColor: "00FF00",
  tempColor: "FF0000",
  dustLevel: "40",
  temperature: "25°C",
};

app.use(express.static("public"));

// 색상 업데이트 라우트
app.get("/setColor", (req, res) => {
  const { firstColor, secondColor } = req.query;
  storedData.pmColor = firstColor;
  storedData.tempColor = secondColor;
  broadcastData();
  res.send("Colors and data updated and broadcasted");
});

// 데이터 브로드캐스트 함수
function broadcastData() {
  const dataToSend = JSON.stringify(storedData);
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(dataToSend);
    }
  });
}

wss.on("connection", function connection(ws) {
  ws.on("message", function incoming(message) {
    console.log("received: %s", message);
  });

  ws.on("close", () => {
    console.log("Client has disconnected");
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
