// nexthard-server.js
const { mqttClient } = require("./mqttClient.js");
const { init, open_connection, order } = require("./cash-device.js");
require("dotenv").config();
const host = process.env.host;
const topic = (process.env.topic || "nexthard").trim() + "/action";
var conn_opened = true;

// TOKEN REFRESH LOGIC
let tokenRefreshTimer = null;
const TOKEN_REFRESH_TIME = 6.5 * 24 * 60 * 60 * 1000; // Refresh every 6.5 days (6 days 12 hours)

// Store interval IDs for cleanup
let cashEventIntervals = [];
let isShuttingDown = false;

async function refreshToken() {
  console.log("Refreshing token...");

  try {
    const response = await init();
    if (response === -111) {
      throw new Error("Refresh failed");
    }
    console.log("Token refreshed successfully");
    startTokenRefreshTimer(); // Reset the timer
  } catch (error) {
    console.error("Token refresh failed, retrying in 1 minute:", error);
    setTimeout(refreshToken, 60000); // Retry after 1 minute
  }
}

function startTokenRefreshTimer() {
  // Clear any existing timer
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
  }

  // Set new timer
  tokenRefreshTimer = setTimeout(refreshToken, TOKEN_REFRESH_TIME);
  console.log(
    `Token refresh scheduled in ${
      TOKEN_REFRESH_TIME / (24 * 60 * 60 * 1000)
    } days`
  );
}

//********/

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// Poll event every 200 milliseconds
async function listenCashEvents(deviceID) {
  console.log("Starting cash event listener for", deviceID);

  let running = false;

  const intervalId = setInterval(async () => {
    if (running || isShuttingDown) return; // skip if last poll still running or shutting down
    running = true;

    try {
      await order("GETDEVICESTATUS", {}, deviceID);
    } catch (err) {
      console.error("GetDeviceStatus error:", err);
    } finally {
      running = false;
    }
  }, 200);

  // Store interval ID for cleanup
  cashEventIntervals.push(intervalId);
}

// shutdown handle
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log("Shutdown already in progress...");
    return;
  }

  isShuttingDown = true;
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Create a timeout promise
  const shutdownTimeout = new Promise((resolve) => {
    setTimeout(() => {
      console.log("Shutdown timeout reached (5s), forcing exit...");
      resolve();
    }, 10000);
  });

  // Create the actual shutdown promise
  const shutdownProcess = new Promise(async (resolve) => {
    try {
      // 1. Clear all intervals
      console.log("Clearing intervals...");
      cashEventIntervals.forEach((intervalId) => clearInterval(intervalId));
      cashEventIntervals = [];

      // 2. Clear token refresh timer
      if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
        tokenRefreshTimer = null;
      }

      // 3. Disconnect devices
      console.log("Disconnecting devices...");
      try {
        await Promise.all([
          order(
            "DISCONNECTDEVICE",
            {},
            `SMART_COIN_SYSTEM-${process.env.coin_port}`
          ),
          order(
            "DISCONNECTDEVICE",
            {},
            `SPECTRAL_PAYOUT-${process.env.cash_port}`
          ),
        ]);
        console.log("Devices disconnected successfully");
      } catch (err) {
        console.error("Error disconnecting devices:", err);
      }

      // 4. Close MQTT connection
      console.log("Closing MQTT connection...");
      if (mqttClient && mqttClient.connected) {
        mqttClient.end(false, {}, () => {
          console.log("MQTT connection closed");
        });
      }

      resolve();
    } catch (error) {
      console.error("Error during shutdown:", error);
      resolve();
    }
  });

  // Wait for either shutdown completion or timeout
  await Promise.race([shutdownProcess, shutdownTimeout]);

  console.log("Shutdown complete. Exiting...");
  process.exit(0);
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart

async function main() {
  // Keep trying to init() every 10 seconds until it succeeds
  let response;
  const RETRY_INTERVAL_MS = 10_000; // 10 seconds

  console.log("trying to connect to mqttbroker...");

  mqttClient.on("connect", async () => {
    console.log("Connected to MQTT Broker.");
    try {
      mqttClient.subscribe(topic, (err) => {
        if (err) console.error("Subscribe error:", err);
      });
    } catch (e) {
      console.error("Subscribe exception:", e);
    }
  });

  while (true) {
    if (isShuttingDown) break;

    let response;
    try {
      response = await init();
      console.log(response);
    } catch (err) {
      console.error("init() threw an error:", err);
      // If you really want retries even on thrown errors, set response here:
      response = { token: null, error: err };
    }

    if (response.error && response.token === null) {
      publish_event(
        `Unable to communicate with ITL api! Will retry in ${
          RETRY_INTERVAL_MS / 1000
        }s...`
      );
      console.error(
        `Unable to communicate with ITL api! Will retry in ${
          RETRY_INTERVAL_MS / 1000
        }s...`
      );
      await sleep(RETRY_INTERVAL_MS);
      continue; // Try again
    }

    if (response.token && !response.error) {
      console.log("Authenticated with ITL API.");
      startTokenRefreshTimer();
      // wait 2 seconds before opening connection
      setTimeout(async () => {
        await open_conn();
      }, 2000);
    }

    break;
  }

  if (isShuttingDown) return; // Exit if shutdown was triggered during init

  //publish_event(`Mqtt status: true, cash-device status: ${conn_opened}`);

  mqttClient.on("reconnect", () => {
    console.warn("Reconnecting to MQTT Broker...");
  });

  mqttClient.on("close", () => {
    console.warn("MQTT Connection closed.");
  });

  mqttClient.on("offline", () => {
    console.warn("MQTT Client is offline.");
  });

  mqttClient.on("error", (error) => {
    console.error("MQTT Error:", error);
  });

  // Actions Parser
  mqttClient.on("message", async (receivedtopic, payload) => {
    if (isShuttingDown) return; // Ignore messages during shutdown

    try {
      // payload might be Buffer
      const json = JSON.parse(payload.toString());
      console.log("Received Message:", receivedtopic, json);

      // quick open logic
      if (json.action.toUpperCase() === "QUICKCONNECT") {
        await open_conn();
        return;
      }
      device = null;

      if (json.device) {
        if (json.device.toUpperCase() === "COIN")
          device = `SMART_COIN_SYSTEM-${process.env.coin_port}`;
        else if (json.device.toUpperCase() === "CASH")
          device = `SPECTRAL_PAYOUT-${process.env.cash_port}`;
      }
      await order(json.action.toUpperCase(), json.data || {}, device);
    } catch (error) {
      publish_event(
        "Message handling error, Please verify your request structure!",
        "/event_resp"
      );
      console.error("Message handling error:", error);
    }
  });
}

async function open_conn() {
  // Proceed to open connection (once auth succeeded)
  try {
    var opened = await open_connection();
    console.log(opened);
    if (!opened.cash || !opened.coin) {
      console.warn(
        `open_connection() to coin_device reported failure. Reattempting connexion! || ${
          opened.cash ? "OK" : "ERROR"
        } | ${opened.coin ? "OK" : "ERROR"}`
      );
      await order(
        "DISCONNECTDEVICE",
        {},
        `SMART_COIN_SYSTEM-${process.env.coin_port}`
      ); // <---- added reconnect attempt
      await order(
        "DISCONNECTDEVICE",
        {},
        `SPECTRAL_PAYOUT-${process.env.cash_port}`
      );
      opened = await open_connection();
      console.log(opened);
      if (!opened.cash || !opened.coin) {
        console.warn("open_connection() reported failure. Unable to connect!");
        conn_opened = false;
        console.log(opened);
        throw new Error("Error on establishing connection!");
      }
    }
    conn_opened = true;
    // on conneciton attache listeners
    cashEventIntervals.forEach((intervalId) => clearInterval(intervalId));
    cashEventIntervals = [];

    listenCashEvents(`SMART_COIN_SYSTEM-${process.env.coin_port}`);
    listenCashEvents(`SPECTRAL_PAYOUT-${process.env.cash_port}`);
  } catch (err) {
    console.error("open_connection() threw an error:", err);
  }
}

main().catch((err) => {
  console.error("main() uncaught error:", err);
});

// Event publisher
function publish_event(event, channel = "/event") {
  //console.log(event);
  mqttClient.publish(
    process.env.topic + channel,
    JSON.stringify(event),
    (error) => {
      if (error) {
        console.error("Publish cash error:", error);
      }
    }
  );
}
