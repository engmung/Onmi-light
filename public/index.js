// 기본값을 전역변수로 저장
let currentPm = 90;
let currentTemp = 25;
let deviceId = localStorage.getItem("deviceId") || "";

// ============================
// 초기화 및 이벤트 리스너 설정
// ============================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("deviceIdInput").value = deviceId;

  // 사용자 인터페이스 이벤트 핸들러
  document
    .getElementById("loginButton")
    .addEventListener("click", validateAndStoreDeviceId);
  document
    .getElementById("submitSettingsButton")
    .addEventListener("click", submitSettings);
  document
    .getElementById("updateLocation")
    .addEventListener("click", updateLocationAndFetchData);

  // 온도와 미세먼지 입력 변경 이벤트 리스너 추가
  document
    .getElementById("currentTemp")
    .addEventListener("input", updateTempDisplay);
  document
    .getElementById("currentPm")
    .addEventListener("input", updatePmDisplay);

  // 사용자가 이전에 설정한 값 가져오고 디스플레이 업데이트
  loadSettings();
  updateDisplay();
});

// ============================
// 설정 로드 및 저장
// ============================

function loadSettings() {
  const settingsInputs = [
    "pmMax",
    "tempMin",
    "tempMax",
    "tempColorMin",
    "tempColorMax",
    "deviceIdInput",
    "location",
    "currentPm",
    "currentTemp",
  ];

  settingsInputs.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      const storedValue = localStorage.getItem(id);
      if (storedValue) {
        element.value = storedValue;
      }
    }
  });

  updateDisplay();
}

function updateServer(settings) {
  settings.pm = currentPm;
  settings.temp = currentTemp;

  fetch(
    `/updateSettingsAndCalculateColor?deviceId=${encodeURIComponent(deviceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, ...settings }),
    }
  )
    .then((response) => response.json())
    .then((data) => {
      console.log("Settings and current state updated:", data);
      updateDisplay(data);
      // 현재 온도와 미세먼지 수치를 콘솔에 출력
      console.log("Current Temperature:", data.temperature);
      console.log("Current Dust Level:", data.currentDustLevel);
    })
    .catch((error) =>
      console.error("Error updating settings and current state:", error)
    );
}

// ============================
// 사용자 입력 처리
// ============================

function updateLocationAndFetchData() {
  const location = document.getElementById("location").value;
  if (location) {
    const settings = fetchSettingsFromDOM();
    settings.location = location;
    updateServer(settings);
  } else {
    console.log("Please enter a location.");
  }
}

function validateAndStoreDeviceId() {
  deviceId = document.getElementById("deviceIdInput").value;
  if (deviceId) {
    localStorage.setItem("deviceId", deviceId);
    validateDeviceId();
  } else {
    alert("유효한 ID를 입력하세요.");
  }
}

function validateDeviceId() {
  fetch(`/validateDeviceId?deviceId=${encodeURIComponent(deviceId)}`)
    .then((response) =>
      response.ok
        ? response.json()
        : Promise.reject("Failed to validate device ID")
    )
    .then((data) => {
      if (!data.isValid) {
        alert("Invalid Device ID. Please check and enter again.");
      }
    })
    .catch((error) => {
      alert("Error validating Device ID: " + error);
      console.error("Error validating Device ID:", error);
    });
}

function submitSettings() {
  updateLocationAndFetchData();
}

function fetchDustAndWeatherInfo(deviceId, location) {
  fetch(
    `/getDustAndWeatherInfo?deviceId=${encodeURIComponent(
      deviceId
    )}&location=${encodeURIComponent(location)}`
  )
    .then((response) => response.json())
    .then((data) => {
      console.log("Environmental data fetched:", data);
      displayEnvironmentalData(data);
    })
    .catch((error) =>
      console.error("Error fetching environmental data:", error)
    );
}

function displayEnvironmentalData(data) {
  currentPm = data.currentDustLevel;
  currentTemp = data.temperature;
  updateDisplay(data);
  updateServer(fetchSettingsFromDOM());
}

// ============================
// UI 업데이트 함수
// ============================

function updateDisplay(data) {
  if (data) {
    document.getElementById("currentPmValue").innerText =
      data.currentDustLevel || currentPm;
    document.getElementById("currentTempValue").innerText =
      data.temperature || currentTemp;
    document.getElementById("currentPm").value =
      data.currentDustLevel || currentPm;
    document.getElementById("currentTemp").value =
      data.temperature || currentTemp;

    const tempColorElement = document.getElementById("temperatureColor");
    const pmColorElement = document.getElementById("pmColor");

    if (data.tempColor && tempColorElement) {
      tempColorElement.style.backgroundColor = data.tempColor;
    }
    if (data.pmColor && pmColorElement) {
      pmColorElement.style.backgroundColor = data.pmColor;
    }

    // 여기에 hourlyTempColors와 hourlyPmColors를 사용하는 로직을 추가할 수 있습니다.
    console.log("Hourly Temp Colors:", data.hourlyTempColors);
    console.log("Hourly PM Colors:", data.hourlyPmColors);
  }
}

function updateTempDisplay() {
  currentTemp = this.value;
  document.getElementById("currentTempValue").innerText = currentTemp;
}

function updatePmDisplay() {
  currentPm = this.value;
  document.getElementById("currentPmValue").innerText = currentPm;
}

function fetchSettingsFromDOM() {
  const settings = {
    pmMax: document.getElementById("pmMax").value,
    tempMin: document.getElementById("tempMin").value,
    tempMax: document.getElementById("tempMax").value,
    tempColorMin: document.getElementById("tempColorMin").value,
    tempColorMax: document.getElementById("tempColorMax").value,
    deviceId: deviceId,
    location: document.getElementById("location").value,
  };

  Object.keys(settings).forEach((key) => {
    localStorage.setItem(key, settings[key]);
  });

  return settings;
}
