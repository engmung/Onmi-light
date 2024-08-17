document.addEventListener("DOMContentLoaded", function () {
  const tempColorMin = document.getElementById("tempColorMin");
  const tempColorMax = document.getElementById("tempColorMax");
  const pmColorMin = document.getElementById("pmColorMin");
  const pmColorMax = document.getElementById("pmColorMax");
  const pmMinInput = document.getElementById("pmMin");
  const pmMaxInput = document.getElementById("pmMax");
  const currentPmValue = document.getElementById("currentPmValue");

  // 슬라이더 색상 업데이트
  function updateSliderTrackColor(sliderId, color1, color2) {
    const style = document.createElement("style");
    document.head.appendChild(style);
    style.sheet.insertRule(
      `#${sliderId}::-webkit-slider-runnable-track {
        background: linear-gradient(to right, ${color1}, ${color2});
      }`,
      0
    );
  }

  function updateTempSlider() {
    updateSliderTrackColor(
      "currentTemp",
      tempColorMin.value,
      tempColorMax.value
    );
  }

  function updatePmSlider() {
    updateSliderTrackColor("currentPm", pmColorMin.value, pmColorMax.value);
  }

  tempColorMin.addEventListener("input", updateTempSlider);
  tempColorMax.addEventListener("input", updateTempSlider);
  pmColorMin.addEventListener("input", updatePmSlider);
  pmColorMax.addEventListener("input", updatePmSlider);

  // 초기 슬라이더 색상 설정
  updateTempSlider();
  updatePmSlider();
});
