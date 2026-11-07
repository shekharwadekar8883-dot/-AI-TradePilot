const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "AI-TradePilot backend is running!",
    mode: "Paper Trading"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AI-TradePilot server running on port ${PORT}`);
});
