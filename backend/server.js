
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const instruments = {
  NIFTY: 24850,
  BANKNIFTY: 56200
};

function ema(values, period) {
  const k = 2 / (period + 1);
  return values.reduce((result, value, i) => {
    result.push(
      i === 0 ? value :
      value * k + result[i - 1] * (1 - k)
    );
    return result;
  }, []);
}

function calculateRSI(values, period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  if (losses === 0) return 100;

  const rs = (gains / period) / (losses / period);
  return 100 - 100 / (1 + rs);
}

// Synthetic prices for testing only.
function demoPrices(base) {
  const prices = [];

  for (let i = 0; i < 80; i++) {
    prices.push(
      base - 70 + i * 2 +
      Math.sin(i / 5) * base * 0.0018 +
      Math.sin(i / 2.4) * base * 0.0007
    );
  }

  return prices;
}

function analyze(instrument) {
  const prices = demoPrices(instruments[instrument]);

  const fast = ema(prices, 9);
  const slow = ema(prices, 21);
  const rsi = calculateRSI(prices);

  const last = prices.length - 1;

  const bullishCross =
    fast[last] > slow[last] &&
    fast[last - 1] <= slow[last - 1];

  const bearishCross =
    fast[last] < slow[last] &&
    fast[last - 1] >= slow[last - 1];

  let signal = "HOLD";
  let explanation = "No clear trading setup. Waiting for confirmation.";

  if (bullishCross && rsi >= 45 && rsi <= 68) {
    signal = "BUY";
    explanation = "Bullish EMA crossover with RSI confirmation.";
  } else if (bearishCross && rsi >= 32 && rsi <= 55) {
    signal = "SELL";
    explanation = "Bearish EMA crossover with RSI confirmation.";
  }

  const entry = Number(prices[last].toFixed(2));

  return {
    instrument,
    mode: "SIMULATED_DATA",
    signal,
    explanation,
    entry,
    stopLoss: signal === "HOLD" ? null :
      Number((entry * (signal === "BUY" ? 0.992 : 1.008)).toFixed(2)),
    target: signal === "HOLD" ? null :
      Number((entry * (signal === "BUY" ? 1.016 : 0.984)).toFixed(2)),
    indicators: {
      ema9: Number(fast[last].toFixed(2)),
      ema21: Number(slow[last].toFixed(2)),
      rsi14: Number(rsi.toFixed(2))
    },
    disclaimer: "Synthetic demo prices only. Not live market data or a trading recommendation."
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "AI-TradePilot backend is running!",
    mode: "Paper Trading"
  });
});

app.get("/api/analyze", (req, res) => {
  const instrument = String(
    req.query.instrument || "NIFTY"
  ).toUpperCase();

  if (!Object.prototype.hasOwnProperty.call(instruments, instrument)) {
    return res.status(400).json({
      error: "Choose NIFTY or BANKNIFTY"
    });
  }

  res.json(analyze(instrument));
});
const crypto = require("crypto");

let kiteAccessToken = null;

app.get("/kite/callback", async (req, res) => {
  const { request_token, status } = req.query;

  if (status !== "success" || !request_token) {
    return res.status(400).send("Kite login failed.");
  }

  const apiKey = process.env.KITE_API_KEY;
  const apiSecret = process.env.KITE_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(503).send("Kite credentials are not configured.");
  }

  try {
    const checksum = crypto.createHash("sha256")
      .update(apiKey + request_token + apiSecret)
      .digest("hex");

    const response = await fetch(
      "https://api.kite.trade/session/token",
      {
        method: "POST",
        headers: {
          "X-Kite-Version": "3",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          api_key: apiKey,
          request_token,
          checksum
        })
      }
    );

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      return res.status(502).send("Kite authentication failed.");
    }

    kiteAccessToken = result.data.access_token;

    res.send("AI-TradePilot connected to Zerodha successfully.");
  } catch (error) {
    res.status(500).send("Authentication error.");
  }
});

app.get("/api/kite/status", (req, res) => {
  res.json({ connected: Boolean(kiteAccessToken) });
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("AI-TradePilot running on port " + PORT);
});

