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

// 온도 배열을 색상 배열로 변환하는 함수
function convertTemperaturesToColors(
  tempArray,
  tempMin,
  tempMax,
  tempColorMin,
  tempColorMax
) {
  return tempArray.map((temp) =>
    interpolateColor(
      tempMin,
      tempMax,
      tempColorMin,
      tempColorMax,
      parseInt(temp)
    )
  );
}

// 설정값 업데이트 및 색상계산
app.post("/updateSettingsAndCalculateColor", async (req, res) => {
  const { deviceId, ...settings } = req.body;
  const client = clients.get(deviceId);
  if (client && client.socket.readyState === WebSocket.OPEN) {
    client.settings = { ...client.settings, ...settings };
    saveSettings();

    // 현재 PM과 온도 색상 계산

    const tempColor = interpolateColor(
      client.settings.tempMin,
      client.settings.tempMax,
      client.settings.tempColorMin,
      client.settings.tempColorMax,
      settings.temp
    );

    // 미세먼지 농도가 최대 범위를 초과하는 경우 빨간색, 아니면 하얀색
    const pmAlertColor =
      settings.pm > client.settings.pmMax ? "#FF0000" : "#FFFFFF";

    // 위치 기반으로 12시간 온도 데이터를 가져오기
    const { hourlyTemperatures } = await fetchDustAndWeatherInfo(
      client.settings.location
    );

    // 12시간 동안의 온도 색상 계산
    const hourlyTempColors = convertTemperaturesToColors(
      hourlyTemperatures,
      client.settings.tempMin,
      client.settings.tempMax,
      client.settings.tempColorMin,
      client.settings.tempColorMax
    );

    // 클라이언트로 데이터 전송
    client.socket.send(
      JSON.stringify({ tempColor, pmAlertColor, hourlyTempColors })
    );
    res.json({
      message: "Settings updated and colors calculated.",
      tempColor,
      pmAlertColor,
      hourlyTempColors,
    });
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

// 날씨 정보와 미세먼지 정보를 파싱하는 함수
async function fetchDustAndWeatherInfo(location) {
  try {
    const dustUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(
      location + " 미세먼지"
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

    // 미세먼지 정보 파싱
    let dustLevel = dustData("#main_pack .num._value").first().text().trim();

    // 현재 온도 파싱
    let temperature = weatherData("#main_pack .temperature_text strong")
      .text()
      .trim()
      .match(/-?\d+/)[0];

    // 12시간 동안의 온도 파싱
    let hourlyTemperatures = [];
    weatherData("#main_pack .graph_inner._hourly_weather ul li").each(
      (index, element) => {
        if (index < 12) {
          // 12개의 데이터를 가져오기 위해
          let temp = weatherData(element)
            .find("dd.degree_point > div > div > span")
            .text()
            .trim()
            .replace("°", "");
          hourlyTemperatures.push(temp);
        }
      }
    );

    // 결과를 로그로 출력
    console.log(`12-hour Forecast: ${hourlyTemperatures.join(", ")}`);

    return { dustLevel, temperature, hourlyTemperatures };
  } catch (error) {
    console.error("Error fetching environment data:", error);
    return {
      dustLevel: "유효한 위치를 입력하세욤",
      temperature: "이하동문",
      hourlyTemperatures: [],
    };
  }
}

/**
 * 색상처리 함수
 */

function interpolateColor(min, max, colorStart, colorEnd, value) {
  let ratio = (value - min) / (max - min);
  ratio = Math.max(0, Math.min(1, ratio));
  const startRgb = hexToRgb(colorStart);
  const endRgb = hexToRgb(colorEnd);
  const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * ratio);
  const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * ratio);
  const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * ratio);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  if (!hex) {
    console.error("Invalid or undefined hex color:", hex);
    return null; // 또는 적절한 기본값 반환
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
function updateAllDevices() {
  clients.forEach(async (client, clientId) => {
    if (
      client.socket.readyState === WebSocket.OPEN &&
      client.settings.location
    ) {
      try {
        // 실시간 환경 데이터 가져오기
        const { dustLevel, temperature } = await fetchDustAndWeatherInfo(
          client.settings.location
        );

        // 미세먼지 및 온도에 따른 색상 계산

        const tempColor = interpolateColor(
          client.settings.tempMin,
          client.settings.tempMax,
          client.settings.tempColorMin,
          client.settings.tempColorMax,
          parseInt(temperature)
        );

        // 클라이언트에 색상 데이터 전송
        client.socket.send(JSON.stringify({ tempColor }));

        // 로그에 환경 데이터 기록
        console.log(
          `Updated ${clientId}: PM - ${dustLevel}, Temp - ${temperature}`
        );
      } catch (error) {
        console.error(`Failed to update device ${clientId}:`, error);
      }
    }
  });
}

// 주기적으로 업데이트
// setInterval(updateAllDevices, 1000 * 60 * 10);

// 3000포트에서 서버실행
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
