const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

app.get("/getDustInfo", async (req, res) => {
  const location = req.query.location;
  const dustInfo = await fetchDustInfo(location);
  res.json(dustInfo);
});

app.get("/getWeatherInfo", async (req, res) => {
  const location = req.query.location;
  const weatherInfo = await fetchWeatherInfo(location);
  res.json(weatherInfo);
});

async function fetchDustInfo(location) {
  try {
    const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(
      location + " 미세먼지"
    )}`;
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    let dustLevel = "";
    for (let i = 1; i <= 4; i++) {
      dustLevel = $(
        `#main_pack > section.sc_new.cs_dust_weather_new._cs_dust_weather > div.content_wrap._current._panel > div:nth-child(1) > div > div.detail_content > div.state_info._fine_dust._info_layer > div.grade.level${i}._level > span.num._value`
      )
        .text()
        .trim();
      if (dustLevel) break;
    }

    return { dustLevel: dustLevel || "위치좀 제대로 입력하쇼" };
  } catch (error) {
    console.error("Error fetching dust info:", error.message);
    return { dustLevel: "비상비상 초비상" };
  }
}

async function fetchWeatherInfo(location) {
  try {
    const encodedLocation = encodeURIComponent(location + " 온도");
    const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodedLocation}`;
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const temperatureText = $(
      "#main_pack > section.sc_new.cs_weather_new._cs_weather > div > div:nth-child(1) > div.content_wrap > div.open > div:nth-child(1) > div > div.weather_info > div > div._today > div.weather_graphic > div.temperature_text > strong"
    )
      .text()
      .trim();
    const temperature = temperatureText.match(/-?\d+\.\d+/)
      ? temperatureText.match(/-?\d+\.\d+/)[0]
      : "도대체 뭘 입력하는거야;;";

    return { temperature };
  } catch (error) {
    console.error("Error fetching weather info:", error.message);
    return { temperature: "삐빅. 오류발생. 삐빅. 오류발생" };
  }
}

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
