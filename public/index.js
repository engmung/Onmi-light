document.addEventListener("DOMContentLoaded", () => {
  const settingsInputs = [
    "pmMin",
    "pmMax",
    "pmColorMin",
    "pmColorMax",
    "tempMin",
    "tempMax",
    "tempColorMin",
    "tempColorMax",
  ];
  settingsInputs.forEach((inputId) => {
    document.getElementById(inputId).addEventListener("input", () => {
      submitSettings();
      calculateAndSendColor();
    });
  });

  document
    .getElementById("reciveAllData")
    .addEventListener("click", reciveAllData);
  document
    .getElementById("updateAllData")
    .addEventListener("click", calculateAndSendColor);

  // 페이지 로드 시 자동으로 초기 색상 계산 및 전송
  submitSettings();
  calculateAndSendColor();
});

function reciveAllData() {
  Promise.all([fetchPmDataAndUpdate(), fetchWeatherInfo()]);
}

// 이후의 함수들 (interpolateColor, submitSettings, calculateAndSendColor, fetchPmDataAndUpdate, fetchWeatherInfo)은 이전에 제공된 것을 그대로 사용하면 됩니다. fetchPmDataAndUpdate와 fetchWeatherInfo 함수에서는 각각의 데이터를 가져오는 로직을 수행한 뒤, 해당 데이터를 페이지에 업데이트만 하면 됩니다. calculateAndSendColor 함수는 최종적으로 색상을 계산하여 서버로 전송하는 역할을 합니다.

// 전역 변수 선언 및 기본값 설정
let pmMin = 40,
  pmMax = 90,
  pmColorMin = "#00FF00",
  pmColorMax = "#919191";
let tempMin = 10,
  tempMax = 25,
  tempColorMin = "#0000ff",
  tempColorMax = "#ff0000";

function interpolateColor(minValue, maxValue, colorStart, colorEnd, value) {
  // HEX 색상 코드를 RGB 값으로 파싱
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  // RGB 값에서 HEX 코드로 변환
  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // 값의 범위를 0과 1 사이로 정규화
  let ratio = (value - minValue) / (maxValue - minValue);
  ratio = Math.max(0, Math.min(1, ratio)); // 비율을 0과 1 사이로 제한

  const startRgb = hexToRgb(colorStart);
  const endRgb = hexToRgb(colorEnd);

  // R, G, B 각각에 대해 선형 보간 수행
  const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * ratio);
  const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * ratio);
  const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * ratio);

  // 결과 색상을 HEX 코드로 변환
  return rgbToHex(r, g, b);
}

function submitSettings() {
  // 사용자 입력 값이 없을 경우 기본값 유지
  pmMin = parseInt(document.getElementById("pmMin").value) || pmMin;
  pmMax = parseInt(document.getElementById("pmMax").value) || pmMax;
  pmColorMin = document.getElementById("pmColorMin").value || pmColorMin;
  pmColorMax = document.getElementById("pmColorMax").value || pmColorMax;

  tempMin = parseInt(document.getElementById("tempMin").value) || tempMin;
  tempMax = parseInt(document.getElementById("tempMax").value) || tempMax;
  tempColorMin = document.getElementById("tempColorMin").value || tempColorMin;
  tempColorMax = document.getElementById("tempColorMax").value || tempColorMax;
}

function calculateAndSendColor() {
  const currentPm = parseInt(document.getElementById("currentPm").value);
  const currentTemp = parseInt(document.getElementById("currentTemp").value);

  const pmColor = interpolateColor(
    pmMin,
    pmMax,
    pmColorMin,
    pmColorMax,
    currentPm
  );
  const tempColor = interpolateColor(
    tempMin,
    tempMax,
    tempColorMin,
    tempColorMax,
    currentTemp
  );

  console.log(`PM Color: ${pmColor}, Temp Color: ${tempColor}`);

  // 계산된 색상을 서버에 전송
  fetch(
    `/setColor?firstColor=${pmColor.substring(
      1
    )}&secondColor=${tempColor.substring(1)}`
  )
    .then((response) => response.text())
    .then((data) => console.log(`Color sent: ${data}`))
    .catch((error) => console.error("Error:", error));
}

function fetchPmDataAndUpdate() {
  const apiKey = encodeURIComponent(
    "Bb6Bl+13QuBFzhNoJGdjlGFQM+rzOHqgT3Z+K7T3MYbrPTPSTqY6V330Hee+p6Napd8CwnKV6A3ISOIYQgifQg=="
  );
  // returnType=json 추가
  const requestURL = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${apiKey}&numOfRows=1&pageNo=1&stationName=${encodeURIComponent(
    "신촌로"
  )}&dataTerm=DAILY&ver=1.0&returnType=json`;

  fetch(requestURL)
    .then((response) => response.json())
    .then((data) => {
      console.log("Received data:", data); // API 응답 로깅

      // JSON 응답 형식에 맞춰 경로 수정 필요
      const pmValue = data.response.body.items[0].pm10Value;
      console.log("미세먼지(PM10) 값:", pmValue); // 미세먼지 값 로깅

      document.getElementById("currentPm").value = pmValue; // 입력 필드에 값 설정
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}

function fetchWeatherInfo() {
  const now = new Date();
  now.setHours(now.getHours()); // UTC에서 KST로 조정
  const baseDate = now.toISOString().split("T")[0].replace(/-/g, "");

  let hour = now.getHours();
  let baseTime = `${hour < 10 ? "0" : ""}${hour}00`;

  // 기상청 데이터 업데이트 시간 조정
  // 기상청은 일반적으로 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300에 데이터를 업데이트합니다.
  // 현재 시각을 기준으로 가장 가까운 업데이트 시간을 계산해야 합니다.
  const updateTime = [2, 5, 8, 11, 14, 17, 20, 23];
  const currentHour = now.getHours();
  const closestHour = updateTime.reduce((prev, curr) =>
    Math.abs(curr - currentHour) < Math.abs(prev - currentHour) ? curr : prev
  );
  baseTime = `${closestHour < 10 ? "0" : ""}${closestHour}00`;

  const apiKey = encodeURIComponent(
    "Bb6Bl+13QuBFzhNoJGdjlGFQM+rzOHqgT3Z+K7T3MYbrPTPSTqY6V330Hee+p6Napd8CwnKV6A3ISOIYQgifQg=="
  );
  const requestURL = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${apiKey}&numOfRows=10&pageNo=1&base_date=${baseDate}&base_time=${baseTime}&nx=55&ny=127&dataType=JSON`;

  fetch(requestURL)
    .then((response) => response.json())
    .then((data) => {
      console.log("Received weather data:", data);
      if (data.response.header.resultCode === "00") {
        const items = data.response.body.items.item;
        let currentTempValue = null;

        // 데이터 목록에서 TMP(기온) 값을 찾음
        items.forEach((item) => {
          if (item.category === "TMP") {
            currentTempValue = item.fcstValue;
            console.log(`현재 기온(TMP): ${currentTempValue}°C`); // 콘솔에 현재 기온 출력
          }
        });

        // 현재 기온 값을 현재 기온 HTML 요소에 설정
        if (currentTempValue !== null) {
          document.getElementById("currentTemp").value = currentTempValue;
        }
      } else {
        console.error(
          "Failed to fetch weather data:",
          data.response.header.resultMsg
        );
      }
    })
    .catch((error) => {
      console.error("Error fetching weather data:", error);
    });
}
