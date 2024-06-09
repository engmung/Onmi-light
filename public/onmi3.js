document.addEventListener("DOMContentLoaded", function () {
  const tempColorMin = document.getElementById("tempColorMin");
  const tempColorMax = document.getElementById("tempColorMax");
  const pmMaxInput = document.getElementById("pmMax");
  const currentPmState = document.getElementById("currentPmState");
  const currentPmValue = document.getElementById("currentPm");

  // 슬라이더 색상 업데이트
  function updateSliderTrackColor(color1, color2) {
    const style = document.createElement("style");
    document.head.appendChild(style);
    style.sheet.insertRule(
      `#currentTemp::-webkit-slider-runnable-track {
                background: linear-gradient(to right, ${color1}, ${color2});
            }`,
      0
    );
  }

  // PM 상태 업데이트 함수
  function updatePmState() {
    const pmMax = parseInt(pmMaxInput.value);
    const pmValue = parseInt(currentPmValue.value);

    if (!isNaN(pmMax) && pmValue >= pmMax) {
      currentPmState.innerHTML = "&#128567;"; // 😷
    } else {
      currentPmState.innerHTML = "&#128522;"; // 😊
    }
  }

  tempColorMin.addEventListener("input", function () {
    updateSliderTrackColor(tempColorMin.value, tempColorMax.value);
  });

  tempColorMax.addEventListener("input", function () {
    updateSliderTrackColor(tempColorMin.value, tempColorMax.value);
  });

  // PM 값이 변경될 때 PM 상태 업데이트
  currentPmValue.addEventListener("input", updatePmState);

  // PM Max 값이 변경될 때 PM 상태 업데이트
  pmMaxInput.addEventListener("input", updatePmState);
});
