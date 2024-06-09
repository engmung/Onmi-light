// 기본값을 전역변수로 저장
let currentPm = 90;
let currentTemp = 25;
let deviceId = localStorage.getItem("deviceId") || "";

// ============================
// 초기화 및 이벤트 리스너 설정
// ============================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("deviceIdInput").value = deviceId;

  // 사용자 인터페이스 이벤트 핸들러, html의 버튼 클릭시, 각각의 함수가 실행되도록 하는 부분.
  document
    .getElementById("loginButton")
    .addEventListener("click", validateAndStoreDeviceId);
  document
    .getElementById("submitSettingsButton")
    .addEventListener("click", submitSettings);
  document
    .getElementById("currentPm")
    .addEventListener("input", updateCurrentPm);
  document
    .getElementById("currentTemp")
    .addEventListener("input", updateCurrentTemp);
  document
    .getElementById("updateLocation")
    .addEventListener("click", function () {
      const location = document.getElementById("location").value;
      if (location) {
        updateLocationAndFetchData(deviceId, location);
      } else {
        console.log("Please enter a location.");
      }
    });

  // 사용자가 이전에 설정한 값 가져오고 디스플레이 업데이트
  loadSettings();
  updateDisplay();
});

// ============================
// 설정 로드 및 저장
// ============================

// 설정 값을 로드하고, 로컬 스토리지에 저장된 값을 UI에 반영
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

  // 슬라이더 값 디스플레이 업데이트
  updateDisplay();
}

// 설정 값들을 서버에 업데이트
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
    .then((data) => console.log("Settings and current state updated:", data))
    .catch((error) =>
      console.error("Error updating settings and current state:", error)
    );
}

// ============================
// 사용자 입력 처리
// ============================

// PM 값 입력 핸들러
function updateCurrentPm() {
  currentPm = this.value;
  updateDisplay();
  updateServer(fetchSettingsFromDOM());
}

// 온도 값 입력 핸들러
function updateCurrentTemp() {
  currentTemp = this.value;
  updateDisplay();
  updateServer(fetchSettingsFromDOM());
}

// 위칫값 업데이트
function updateLocation() {
  const location = document.getElementById("location").value;
  if (location) {
    updateLocationOnServer(location);
  } else {
    console.log("Please enter a location.");
  }
}

// ============================
// 서버 통신 및 데이터 처리
// ============================

// 서버에 새 위치 정보를 전송하고 결과를 처리
function updateLocationOnServer(location) {
  const settings = fetchSettingsFromDOM();
  settings.location = location;

  fetch("/setLocation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      location,
      pm: currentPm,
      temp: currentTemp,
      ...settings,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message === "Location and settings updated successfully.") {
        // 서버로부터 색상 정보를 받아 UI 업데이트
        updateDisplay(data.pmColor, data.tempColor);
        console.log("Successful update:", data);
      } else {
        alert(data.message);
      }
    })
    .catch((error) => console.error("Error updating location:", error));
}

// ID 유효성 검사와 저장
function validateAndStoreDeviceId() {
  deviceId = document.getElementById("deviceIdInput").value;
  if (deviceId) {
    localStorage.setItem("deviceId", deviceId);
    validateDeviceId();
  } else {
    alert("유효한 ID를 입력하세요.");
  }
}

// 서버에 ID가 유효한지 검사요청
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

// 설정값을 서버에 업로드
function submitSettings() {
  const settings = fetchSettingsFromDOM();
  updateServer(settings);
}

// 위치기반으로 날씨데이터를 서버에 요청, 계산에 필요한 현재 날씨상태도 전달
function updateLocationAndFetchData(deviceId, location) {
  fetch(`/setLocation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deviceId,
      location,
      pm: currentPm,
      temp: currentTemp,
    }),
  })
    .then((response) => response.text())
    .then((data) => {
      console.log("Location and data updated:", data);
      fetchDustAndWeatherInfo(deviceId, location);
    })
    .catch((error) =>
      console.error("Error updating location and data:", error)
    );
}

// 날씨상태 가져오기
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

// 가져온 날씨정보를 저장
function displayEnvironmentalData(data) {
  currentPm = data.dustLevel;
  currentTemp = data.temperature;
  updateDisplay();
  updateServer(fetchSettingsFromDOM());
}

// ============================
// UI 업데이트 함수
// ============================

// UI 디스플레이 업데이트
function updateDisplay() {
  document.getElementById("currentPmValue").innerText = `${currentPm} µg/m³`;
  document.getElementById("currentTempValue").innerText = `${currentTemp} °C`;
  document.getElementById("currentPm").value = currentPm;
  document.getElementById("currentTemp").value = currentTemp;
}

// 설정값들을 변수에 넣고, 이를 로컬스토리지에 저장
function fetchSettingsFromDOM() {
  const settings = {
    pmMax: document.getElementById("pmMax").value,
    tempMin: document.getElementById("tempMin").value,
    tempMax: document.getElementById("tempMax").value,
    tempColorMin: document.getElementById("tempColorMin").value,
    tempColorMax: document.getElementById("tempColorMax").value,
    deviceId: deviceId, // 현재 장치 ID 추가
    location: document.getElementById("location").value, // 사용자 위치 추가
  };

  // 설정을 localStorage에 저장
  Object.keys(settings).forEach((key) => {
    localStorage.setItem(key, settings[key]);
  });

  return settings;
}
