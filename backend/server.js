
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

const fyersSymbols = {
  NIFTY: "NSE:NIFTY50-INDEX",
  BANKNIFTY: "NSE:NIFTYBANK-INDEX"
};

async function analyze(instrument) {
  if (!fyersAccessToken) {
    throw new Error("Connect FYERS first");
  }

  const to = new Date();
  const from = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    symbol: fyersSymbols[instrument],
    resolution: "5",
    date_format: "1",
    range_from: from.toISOString().slice(0, 10),
    range_to: to.toISOString().slice(0, 10)
  });

  const response = await fetch(
    `https://api-t1.fyers.in/data/history?${params}`,
    {
      headers: {
        Authorization: `${process.env.FYERS_APP_ID}:${fyersAccessToken}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok || data.s !== "ok" ||
      !Array.isArray(data.candles) || data.candles.length < 30) {
    throw new Error("Insufficient FYERS historical candle data");
  }

  const candles = data.candles;
const prices = candles.map(candle => Number(candle[4]));
const highs = candles.map(candle => Number(candle[2]));
const lows = candles.map(candle => Number(candle[3]));

  const fast = ema(prices, 9);
const slow = ema(prices, 21);
const rsi = calculateRSI(prices);

const ema12 = ema(prices, 12);
const ema26 = ema(prices, 26);
const macdLine = prices.map((_, i) => ema12[i] - ema26[i]);
const macdSignal = ema(macdLine, 9);

const trueRanges = candles.map((candle, i) => {
  if (i === 0) return highs[i] - lows[i];
  return Math.max(
    highs[i] - lows[i],
    Math.abs(highs[i] - prices[i - 1]),
    Math.abs(lows[i] - prices[i - 1])
  );
});

const atr = trueRanges.slice(-14).reduce((sum, value) => sum + value, 0) / 14;

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
    mode: "FYERS_HISTORICAL",
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
    disclaimer: "Based on FYERS historical 5-minute candles. Paper trading only; not a trading recommendation."
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "AI-TradePilot backend is running!",
    mode: "Paper Trading"
  });
});

app.get("/api/analyze", async (req, res) => {
  const instrument = String(
    req.query.instrument || "NIFTY"
  ).toUpperCase();

  if (!Object.prototype.hasOwnProperty.call(fyersSymbols, instrument)) {
    return res.status(400).json({
      error: "Choose NIFTY or BANKNIFTY"
    });
  }

  try {
    const result = await analyze(instrument);
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: error.message
    });
  }
});
const crypto = require("crypto");

let kiteAccessToken = null;
app.get("/kite/login", (req, res) => {
  const apiKey = process.env.KITE_API_KEY;

  if (!apiKey) {
    return res.status(503).send("Kite API key is not configured.");
  }

  const loginUrl = new URL("https://kite.zerodha.com/connect/login");
  loginUrl.searchParams.set("v", "3");
  loginUrl.searchParams.set("api_key", apiKey);

  res.redirect(loginUrl.toString());
});
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
let fyersAccessToken = null;
let fyersLoginState = null;

app.get("/fyers/login", (req, res) => {
  const appId = process.env.FYERS_APP_ID;
  const redirectUri = "https://ai-tradepilot-backend.onrender.com/fyers/callback";

  if (!appId || !process.env.FYERS_SECRET_ID) {
    return res.status(500).send("FYERS credentials are not configured.");
  }

  fyersLoginState = require("crypto").randomBytes(16).toString("hex");

  const loginUrl = new URL("https://api-t1.fyers.in/api/v3/generate-authcode");
  loginUrl.searchParams.set("client_id", appId);
  loginUrl.searchParams.set("redirect_uri", redirectUri);
  loginUrl.searchParams.set("response_type", "code");
  loginUrl.searchParams.set("state", fyersLoginState);

  res.redirect(loginUrl.toString());
});

app.get("/fyers/callback", async (req, res) => {
  const { auth_code, state } = req.query;

  if (!auth_code || state !== fyersLoginState) {
    return res.status(400).send("FYERS login failed. Please try again.");
  }

  try {
    const appId = process.env.FYERS_APP_ID;
    const secret = process.env.FYERS_SECRET_ID;

    const appIdHash = require("crypto")
      .createHash("sha256")
      .update(appId + ":" + secret)
      .digest("hex");

    const response = await fetch(
      "https://api-t1.fyers.in/api/v3/validate-authcode",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          appIdHash,
          code: auth_code
        })
      }
    );

    const result = await response.json();

    if (result.s !== "ok" || !result.access_token) {
      return res.status(401).send("FYERS authentication failed.");
    }

    fyersAccessToken = result.access_token;
    fyersLoginState = null;

    res.send("AI-TradePilot connected to FYERS successfully!");
  } catch (error) {
    res.status(500).send("FYERS connection error.");
  }
});

app.get("/api/fyers/status", (req, res) => {
  res.json({ connected: Boolean(fyersAccessToken) });
});
app.get("/api/fyers/quote", async (req, res) => {
  if (!fyersAccessToken) {
    return res.status(401).json({ error: "Connect FYERS first" });
  }

  const instrument = String(req.query.instrument || "NIFTY").toUpperCase();

  const symbols = {
    NIFTY: "NSE:NIFTY50-INDEX",
    BANKNIFTY: "NSE:NIFTYBANK-INDEX"
  };

  const symbol = symbols[instrument];

  if (!symbol) {
    return res.status(400).json({
      error: "Choose NIFTY or BANKNIFTY"
    });
  }

  try {
    const response = await fetch(
      `https://api-t1.fyers.in/data/quotes?symbols=${encodeURIComponent(symbol)}`,
      {
        headers: {
          Authorization: `${process.env.FYERS_APP_ID}:${fyersAccessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const raw = await response.text();
console.log("FYERS RAW RESPONSE:", raw);
const data = JSON.parse(raw);

    if (!response.ok || data.s !== "ok" || !data.d?.[0]?.v) {
      return res.status(502).json({
        error: "FYERS quote request failed",
        details: data
      });
    }

    res.json({
      instrument,
      symbol,
      ltp: data.d[0].v.lp,
      quote: data.d[0].v,
      mode: "LIVE"
    });
  } catch (error) {console.error("FYERS QUOTE ERROR:", error);
    res.status(500).json({ error: "Unable to fetch FYERS quote" });
  }
});const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("AI-TradePilot running on port " + PORT);
});

