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

  // 초기 슬라이더 색상 설정
  updateSliderTrackColor(
    "currentTemp",
    document.getElementById("tempColorMin").value,
    document.getElementById("tempColorMax").value
  );
  updateSliderTrackColor(
    "currentPm",
    document.getElementById("pmColorMin").value,
    document.getElementById("pmColorMax").value
  );
});

// ============================
// 설정 로드 및 저장
// ============================

function loadSettings() {
  const settingsInputs = [
    "pmMax",
    "pmMin",
    "tempMin",
    "tempMax",
    "tempColorMin",
    "tempColorMax",
    "pmColorMin",
    "pmColorMax",
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
      console.log("Current Temperature:", data.temperature);
      console.log("Current Dust Level:", data.currentDustLevel);
    })
    .catch((error) => {
      console.error("Error updating settings and current state:", error);
      alert("서버와의 통신 중 오류가 발생했습니다. 다시 시도해 주세요.");
    });
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

// ============================
// UI 업데이트 함수
// ============================

function updateDisplay(data) {
  if (data) {
    try {
      // 현재 미세먼지 수치 업데이트
      const currentPmValueElement = document.getElementById("currentPmValue");
      const currentPmRangeElement = document.getElementById("currentPm");
      if (
        currentPmValueElement &&
        currentPmRangeElement &&
        data.currentDustLevel
      ) {
        const pmValue = parseInt(data.currentDustLevel);
        currentPmValueElement.innerText = pmValue;
        currentPmRangeElement.value = pmValue;
        currentPm = pmValue;
      }

      // 현재 온도 업데이트
      const currentTempValueElement =
        document.getElementById("currentTempValue");
      const currentTempRangeElement = document.getElementById("currentTemp");
      if (
        currentTempValueElement &&
        currentTempRangeElement &&
        data.temperature
      ) {
        const tempValue = parseInt(data.temperature);
        currentTempValueElement.innerText = tempValue;
        currentTempRangeElement.value = tempValue;
        currentTemp = tempValue;
      }

      // 색상 업데이트
      if (data.hourlyTempColors && data.hourlyTempColors.length > 0) {
        updateSliderTrackColor(
          "currentTemp",
          "#" + data.hourlyTempColors[0],
          "#" + data.hourlyTempColors[0]
        );
      }
      if (data.hourlyPmColors && data.hourlyPmColors.length > 0) {
        updateSliderTrackColor(
          "currentPm",
          "#" + data.hourlyPmColors[0],
          "#" + data.hourlyPmColors[0]
        );
      }

      console.log("Display updated successfully with data:", data);
    } catch (error) {
      console.error("Error updating display:", error);
    }
  } else {
    console.warn("No data provided to updateDisplay function");
  }
}

function updateSliderTrackColor(sliderId, colorStart, colorEnd) {
  const slider = document.getElementById(sliderId);
  if (slider) {
    const percentage =
      ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(to right, ${colorStart} 0%, ${colorEnd} ${percentage}%, #ddd ${percentage}%, #ddd 100%)`;
  }
}

function updateTempDisplay() {
  currentTemp = this.value;
  document.getElementById("currentTempValue").innerText = currentTemp;
  updateSliderTrackColor(
    "currentTemp",
    document.getElementById("tempColorMin").value,
    document.getElementById("tempColorMax").value
  );
}

function updatePmDisplay() {
  currentPm = this.value;
  document.getElementById("currentPmValue").innerText = currentPm;
  updateSliderTrackColor(
    "currentPm",
    document.getElementById("pmColorMin").value,
    document.getElementById("pmColorMax").value
  );
}

function fetchSettingsFromDOM() {
  const settings = {
    pmMin: document.getElementById("pmMin").value,
    pmMax: document.getElementById("pmMax").value,
    tempMin: document.getElementById("tempMin").value,
    tempMax: document.getElementById("tempMax").value,
    tempColorMin: document.getElementById("tempColorMin").value,
    tempColorMax: document.getElementById("tempColorMax").value,
    pmColorMin: document.getElementById("pmColorMin").value,
    pmColorMax: document.getElementById("pmColorMax").value,
    deviceId: deviceId,
    location: document.getElementById("location").value,
  };

  Object.keys(settings).forEach((key) => {
    localStorage.setItem(key, settings[key]);
  });

  return settings;
}
