const express = require("express");

const app = express();
app.use(express.static("public"));

app.get("/setColor", (req, res) => {
  const { firstColor, secondColor } = req.query;
  const colorStr = `${firstColor};${secondColor}\n`;
  console.log("Color set:", colorStr);
  res.send("Color updated");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
