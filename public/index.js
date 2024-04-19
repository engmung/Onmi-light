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
    "currentPm",
    "currentTemp", // range 인풋을 위한 설정 추가
  ];

  settingsInputs.forEach((inputId) => {
    document.getElementById(inputId).addEventListener("input", () => {
      if (inputId === "currentPm" || inputId === "currentTemp") {
        updateRangeValueDisplay(inputId); // range 값 변경 시 텍스트 업데이트
      } else {
        submitSettings();
      }
      calculateAndSendColor();
    });
  });

  document
    .getElementById("updateLocation")
    .addEventListener("click", function () {
      const location = document.getElementById("userLocation").value;
      if (location) {
        fetchDustAndWeatherInfo(location);
      } else {
        console.log("Please enter a location.");
      }
    });

  document.addEventListener("click", calculateAndSendColor);
  submitSettings();
  calculateAndSendColor();
});

function fetchDustAndWeatherInfo(location) {
  Promise.all([
    fetch(`/getDustInfo?location=${encodeURIComponent(location)}`),
    fetch(`/getWeatherInfo?location=${encodeURIComponent(location)}`),
  ])
    .then(async ([dustRes, weatherRes]) => {
      const dustData = await dustRes.json();
      const weatherData = await weatherRes.json();
      updateValueAndDisplay("currentPm", dustData.dustLevel);
      updateValueAndDisplay("currentTemp", weatherData.temperature);
      calculateAndSendColor();
    })
    .catch((error) => console.error("Error fetching data:", error));
}

function updateValueAndDisplay(id, value) {
  const inputElement = document.getElementById(id);
  const valueDisplayElement = document.getElementById(`${id}Value`);
  inputElement.value = value;
  valueDisplayElement.innerText = value;
}

function updateRangeValueDisplay(id) {
  const inputElement = document.getElementById(id);
  const valueDisplayElement = document.getElementById(`${id}Value`);
  valueDisplayElement.innerText = inputElement.value;
}

// 나머지 함수들(submitSettings, calculateAndSendColor, interpolateColor, hexToRgb, rgbToHex)은 이전 코드를 그대로 사용합니다.

function submitSettings() {
  pmMin = parseInt(document.getElementById("pmMin").value) || 40;
  pmMax = parseInt(document.getElementById("pmMax").value) || 90;
  pmColorMin = document.getElementById("pmColorMin").value || "#00FF00";
  pmColorMax = document.getElementById("pmColorMax").value || "#919191";
  tempMin = parseInt(document.getElementById("tempMin").value) || 10;
  tempMax = parseInt(document.getElementById("tempMax").value) || 25;
  tempColorMin = document.getElementById("tempColorMin").value || "#0000ff";
  tempColorMax = document.getElementById("tempColorMax").value || "#ff0000";
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

function interpolateColor(minValue, maxValue, colorStart, colorEnd, value) {
  let ratio = (value - minValue) / (maxValue - minValue);
  ratio = Math.max(0, Math.min(1, ratio));

  const startRgb = hexToRgb(colorStart);
  const endRgb = hexToRgb(colorEnd);

  const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * ratio);
  const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * ratio);
  const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * ratio);

  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
