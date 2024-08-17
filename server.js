/**
 * 필요한 라이브러리 임포트
 */
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();

// 설정 파일 경로 설정
const SETTINGS_FILE = path.join(__dirname, "settings4Id.json");
app.use(express.static("public"));
app.use(express.json());

// 초기 테스트 더미 설정
clients.set("test", {
  socket: {
    send: (data) => console.log(`Sending data to test client: ${data}`),
    readyState: WebSocket.OPEN,
  },
  settings: {
    pmMax: 150,
    tempMin: -10,
    tempMax: 40,
    tempColorMin: "#0000FF",
    tempColorMax: "#FFFF00",
    location: "Seoul",
  },
});
/**
 * 앤드포인트들
 */

// ID확인
app.get("/validateDeviceId", (req, res) => {
  const { deviceId } = req.query;
  if (clients.has(deviceId)) {
    res.json({ isValid: true });
  } else {
    res.status(404).json({
      isValid: false,
      message: "Device ID not connected or does not exist.",
    });
  }
});

// 위치받고 색상계산
app.post("/setLocation", (req, res) => {
  const { deviceId, location, pm, temp } = req.body;
  const client = clients.get(deviceId);
  if (client) {
    if (client.socket.readyState === WebSocket.OPEN) {
      // 현재 설정에 따라 색상 계산

      const tempColor = interpolateColor(
        client.settings.tempMin,
        client.settings.tempMax,
        client.settings.tempColorMin,
        client.settings.tempColorMax,
        parseInt(temp)
      );

      client.settings.location = location; // 위치 정보를 설정에 추가

      saveSettings(); // 변경된 설정을 저장

      // 업데이트된 위치와 색상 정보를 클라이언트에 보내기
      client.socket.send(JSON.stringify({ tempColor }));
      res.json({
        message: "Location and environment data updated successfully.",
        tempColor,
      });
    } else {
      console.log(`WebSocket not open for ${deviceId}`);
      res.status(404).send("WebSocket connection not open.");
    }
  } else {
    res.status(404).send("Device not connected or not found");
  }
});

// 설정값 업데이트 및 색상계산
app.post("/updateSettingsAndCalculateColor", async (req, res) => {
  const { deviceId, ...settings } = req.body;
  const client = clients.get(deviceId);
  if (client && client.socket.readyState === WebSocket.OPEN) {
    client.settings = { ...client.settings, ...settings };
    saveSettings();

    try {
      const { hourlyDustLevels, hourlyTemperatures, currentTime } =
        await fetchDustAndWeatherInfo(client.settings.location);

      const hourlyTempColors = convertToColors(
        hourlyTemperatures,
        parseFloat(client.settings.tempMin || 0),
        parseFloat(client.settings.tempMax || 40),
        client.settings.tempColorMin || "#0000FF",
        client.settings.tempColorMax || "#FF0000"
      ).map(removeHash);

      const hourlyPmColors = convertToColors(
        hourlyDustLevels,
        parseFloat(client.settings.pmMin || 0),
        parseFloat(client.settings.pmMax || 150),
        client.settings.pmColorMin || "#00FF00",
        client.settings.pmColorMax || "#FF0000"
      ).map(removeHash);

      const dataToSend = {
        hourlyTempColors,
        hourlyPmColors,
        currentTime,
      };

      client.socket.send(JSON.stringify(dataToSend));
      console.log("Sending data to client:", dataToSend);

      res.json({
        message: "Settings updated and colors calculated.",
        ...dataToSend,
      });
    } catch (error) {
      console.error("Error calculating colors:", error);
      res
        .status(500)
        .json({ message: "Error calculating colors", error: error.message });
    }
  } else {
    res.status(404).send("Device not connected or not found");
  }
});

// 날씨정보 가져오기
app.get("/getDustAndWeatherInfo", async (req, res) => {
  const { location } = req.query;
  const info = await fetchDustAndWeatherInfo(location);
  res.json(info);
});

// 클라이언트 설정 업데이트 요청 처리
app.post("/updateSettings", (req, res) => {
  const { deviceId, settings } = req.body;
  const client = clients.get(deviceId);
  if (client) {
    // 클라이언트의 설정을 업데이트
    client.settings = { ...client.settings, ...settings };

    // 클라이언트에 설정 업데이트 반영
    client.socket.send(
      JSON.stringify({
        type: "settingsUpdate",
        settings: settings,
      })
    );

    // 변경된 설정을 파일에 저장
    saveSettings();

    res.send("Settings updated successfully.");
  } else {
    res.status(404).send("Device not found.");
  }
});

app.get("/getSettings", (req, res) => {
  const { deviceId } = req.query;
  const allSettings = loadSettings();

  // 해당 디바이스 ID의 설정 불러오기
  if (allSettings[deviceId]) {
    res.json(allSettings[deviceId]);
  } else {
    res.status(404).send({ message: "Settings not found for this device ID." });
  }
});

/**
 * 세팅값 관련 함수
 */

// 세팅값 받아오기
function loadSettings() {
  try {
    const rawData = fs.readFileSync(SETTINGS_FILE, "utf8");
    const loadedSettings = JSON.parse(rawData);
    for (const [clientId, settings] of Object.entries(loadedSettings)) {
      if (clients.has(clientId)) {
        clients.get(clientId).settings = settings;
      } else {
        clients.set(clientId, { settings: settings });
      }
    }
    console.log("Settings loaded successfully from file.");
  } catch (error) {
    console.error("Failed to load settings from file:", error);
  }
}

// 색상 문자열에서 '#' 제거하는 함수
function removeHash(color) {
  return color.startsWith("#") ? color.slice(1) : color;
}

// 세팅값 데이터베이스에 저장하기, 폴더 수정
function saveSettings() {
  const settingsData = {};
  clients.forEach((client, clientId) => {
    const { pm, temp, ...settingsWithoutDynamicValues } = client.settings;
    settingsData[clientId] = settingsWithoutDynamicValues;
  });

  fs.writeFile(SETTINGS_FILE, JSON.stringify(settingsData, null, 2), (err) => {
    if (err) {
      console.error("Failed to save settings to file:", err);
      return;
    }
    console.log("Settings saved successfully to file.");
  });
}

/**
 * 날씨정보 처리함수
 */

async function fetchDustAndWeatherInfo(location) {
  try {
    const dustUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(
      location + " 시간별 미세먼지"
    )}`;
    const weatherUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(
      location + " 온도"
    )}`;

    const [dustResponse, weatherResponse] = await axios.all([
      axios.get(dustUrl),
      axios.get(weatherUrl),
    ]);

    const dustData = cheerio.load(dustResponse.data);
    const weatherData = cheerio.load(weatherResponse.data);

    // 12시간 동안의 미세먼지 정보 파싱
    let hourlyDustLevels = [];
    dustData(
      "#main_pack .content_wrap._hour._panel .bar_graph_area .graph_body._button_scroller ul li"
    ).each((index, element) => {
      if (index >= 3 && index < 15) {
        // 4번째부터 12개의 li 요소
        let dustValue = dustData(element)
          .find(".ly_info > div:nth-child(1) > span")
          .text()
          .trim();
        dustValue = dustValue.replace(/[^0-9]/g, "");
        if (dustValue) {
          hourlyDustLevels.push(parseInt(dustValue));
        }
      }
    });

    // 현재 미세먼지 레벨을 12시간 예보의 첫 번째 요소로 설정
    let currentDustLevel = hourlyDustLevels[0]
      ? hourlyDustLevels[0].toString()
      : "";

    // 온도 정보 파싱
    let temperature = "";
    let temperatureElement = weatherData("#main_pack .temperature_text strong");
    if (temperatureElement.length > 0) {
      let tempMatch = temperatureElement.text().trim().match(/-?\d+/);
      if (tempMatch) {
        temperature = tempMatch[0];
      }
    }

    let hourlyTemperatures = [];
    weatherData("#main_pack .graph_inner._hourly_weather ul li").each(
      (index, element) => {
        if (index < 12) {
          let temp = weatherData(element)
            .find("dd.degree_point > div > div > span")
            .text()
            .trim()
            .replace("°", "");
          if (temp) {
            hourlyTemperatures.push(temp);
          }
        }
      }
    );

    // 현재 시간 가져오기
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    console.log("Current time:", currentTime); // 디버깅을 위한 로그 추가

    return {
      currentDustLevel,
      hourlyDustLevels,
      temperature,
      hourlyTemperatures,
      currentTime,
    };
  } catch (error) {
    console.error("Error fetching environment data:", error);
    return {
      currentDustLevel: "Error",
      hourlyDustLevels: [],
      temperature: "Error",
      hourlyTemperatures: [],
      currentTime: "Error",
    };
  }
}

/**
 * 색상처리 함수
 */

// 통합된 색상 보간 함수
function interpolateColor(value, min, max, colorStart, colorEnd) {
  if (!isValidHexColor(colorStart) || !isValidHexColor(colorEnd)) {
    console.error("Invalid color values:", { colorStart, colorEnd });
    return "#000000"; // 기본 색상 반환
  }

  let ratio = (value - min) / (max - min);
  ratio = Math.max(0, Math.min(1, ratio));
  const startRgb = hexToRgb(colorStart);
  const endRgb = hexToRgb(colorEnd);

  const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * ratio);
  const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * ratio);
  const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * ratio);
  return rgbToHex(r, g, b);
}

function isValidHexColor(color) {
  return typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)
    .padStart(6, "0")}`;
}

// 값 배열을 색상 배열로 변환하는 함수
function convertToColors(valueArray, min, max, colorStart, colorEnd) {
  return valueArray.map((value) =>
    interpolateColor(
      parseFloat(value),
      parseFloat(min),
      parseFloat(max),
      colorStart,
      colorEnd
    )
  );
}

/**
 * 웹소캣연결 및, 주기적인 정보송신
 */

// 웹소캣연결 제어
wss.on("connection", (ws) => {
  let clientId;
  ws.on("message", (data) => {
    let message = data.toString();
    if (message.startsWith("ID:")) {
      clientId = message.slice(3);
      if (clients.has(clientId)) {
        // 기존 연결 정보가 있는 경우, 소켓만 업데이트
        console.log(`Client ${clientId} reconnected.`);
        clients.get(clientId).socket = ws;
      } else {
        // 새 클라이언트 연결 처리
        clients.set(clientId, { socket: ws, settings: {} });
        console.log(`New client ${clientId} connected.`);
      }
    }
  });

  ws.on("close", () => {
    // 연결이 끊긴 클라이언트 처리
    if (clientId && clients.has(clientId)) {
      console.log(`Client ${clientId} disconnected.`);
      clients.delete(clientId);
    }
  });
});

// 주기적인 업데이트를 위한 코드
async function updateAllDevices() {
  for (const [clientId, client] of clients.entries()) {
    if (
      client.socket.readyState === WebSocket.OPEN &&
      client.settings.location
    ) {
      try {
        const { hourlyDustLevels, hourlyTemperatures, currentTime } =
          await fetchDustAndWeatherInfo(client.settings.location);

        const hourlyTempColors = convertToColors(
          hourlyTemperatures,
          parseFloat(client.settings.tempMin || 0),
          parseFloat(client.settings.tempMax || 40),
          client.settings.tempColorMin || "#0000FF",
          client.settings.tempColorMax || "#FF0000"
        ).map(removeHash);

        const hourlyPmColors = convertToColors(
          hourlyDustLevels,
          parseFloat(client.settings.pmMin || 0),
          parseFloat(client.settings.pmMax || 150),
          client.settings.pmColorMin || "#00FF00",
          client.settings.pmColorMax || "#FF0000"
        ).map(removeHash);

        const dataToSend = {
          hourlyTempColors,
          hourlyPmColors,
          currentTime,
        };

        client.socket.send(JSON.stringify(dataToSend));
        console.log(`Updated ${clientId}:`, dataToSend);
      } catch (error) {
        console.error(`Failed to update device ${clientId}:`, error);
      }
    }
  }
}

// 주기적으로 업데이트
// setInterval(updateAllDevices, 1000 * 60 * 10);

// 3000포트에서 서버실행
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
