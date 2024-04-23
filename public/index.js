let currentPm = 90;
let currentTemp = 25;
let deviceId = localStorage.getItem("deviceId") || "";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("deviceIdInput").value = deviceId;
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
      const location = document.getElementById("userLocation").value;
      if (location) {
        updateLocationAndFetchData(deviceId, location);
      } else {
        console.log("Please enter a location.");
      }
    });

  loadSettings();
  updateDisplay();
});

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

function updateLocation() {
  const location = document.getElementById("userLocation").value;
  if (location) {
    updateLocationOnServer(location);
  } else {
    console.log("Please enter a location.");
  }
}

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

//이거당 이거야
function displayEnvironmentalData(data) {
  currentPm = data.dustLevel;
  currentTemp = data.temperature;
  updateDisplay();
  updateServer(fetchSettingsFromDOM());
}

function loadSettings() {
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
    "currentTemp",
  ];
  settingsInputs.forEach((id) => {
    const storedValue = localStorage.getItem(id);
    if (storedValue) document.getElementById(id).value = storedValue;
  });
}

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
      console.log("Location update response:", data);
      updateDisplay(); // Assumes server returns updated pm and temp values
    })
    .catch((error) => console.error("Error updating location:", error));
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
  const settings = fetchSettingsFromDOM();
  updateServer(settings);
}

// 이부분에서 드래그인풋 바뀌게 ㄱㄱ
function updateCurrentPm() {
  currentPm = this.value;
  updateDisplay();
  updateServer(fetchSettingsFromDOM());
}

function updateCurrentTemp() {
  currentTemp = this.value;
  updateDisplay();
  updateServer(fetchSettingsFromDOM());
}

function updateDisplay() {
  document.getElementById("currentPmValue").innerText = `${currentPm} µg/m³`;
  document.getElementById("currentTempValue").innerText = `${currentTemp} °C`;
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
    .then((data) => console.log("Settings and current state updated:", data))
    .catch((error) =>
      console.error("Error updating settings and current state:", error)
    );
}

function fetchSettingsFromDOM() {
  return {
    pmMin: document.getElementById("pmMin").value,
    pmMax: document.getElementById("pmMax").value,
    pmColorMin: document.getElementById("pmColorMin").value,
    pmColorMax: document.getElementById("pmColorMax").value,
    tempMin: document.getElementById("tempMin").value,
    tempMax: document.getElementById("tempMax").value,
    tempColorMin: document.getElementById("tempColorMin").value,
    tempColorMax: document.getElementById("tempColorMax").value,
  };
}
