const request = require("request");
const fs = require("fs");
const os = require("os");
const util = require("util");
const { mqttClient } = require("./mqttClient.js");
var token = "",
  opened = { coin: false, cash: false };

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

function publish_response(event, message, device) {
  const mqttData = {
    device: device,
    event: event,
    value: message,
  };
  mqttClient.publish(
    process.env.topic + "/event",
    JSON.stringify(mqttData),
    (error) => {
      console.log(mqttData);
      if (error) {
        console.error("Publish error:", error);
      }
    }
  );
}

function setEnvValue(key, value) {
  // read file from hdd & split if from a linebreak to a array
  const ENV_VARS = fs.readFileSync("./.env", "utf8").split(os.EOL);

  // find the env we want based on the key
  const target = ENV_VARS.indexOf(
    ENV_VARS.find((line) => {
      return line.match(new RegExp(key));
    })
  );

  // replace the key/value with the new value
  ENV_VARS.splice(target, 1, `${key}=${value}`);

  // write everything back to the file system
  fs.writeFileSync("./.env", ENV_VARS.join(os.EOL));
}

function requestPromise(options) {
  return new Promise((resolve, reject) => {
    request(options, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      // Check if response exists and has body
      if (!response || !response.body) {
        reject(new Error("Empty response or response body"));
        return;
      }

      try {
        // Try to parse JSON if content-type suggests it
        const contentType = response.headers["content-type"] || "";
        const parsedResponse = contentType.includes("application/json")
          ? JSON.parse(response.body)
          : response.body;

        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body: parsedResponse,
        });
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

const init = async function (config = []) {
  try {
    const options = {
      method: "POST",
      url: `${process.env.itl_url}/api/Users/Authenticate`,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Username: process.env.itl_user,
        Password: process.env.itl_pass,
      }),
    };

    const response = await requestPromise(options);

    if (response.statusCode !== 200) {
      throw new Error(
        `Authentication failed: ${response.body.message || response.statusCode}`
      );
    }

    const body = response.body || {};
    if (!body.token) {
      console.error("Authentication response missing token:", body);
      new Error(
        `Authentication response missing token:: ${
          response.body.message || response.statusCode
        }`
      );
    }
    token = body.token;
    console.log(token);
    setEnvValue("token", token);
    return token;
  } catch (error) {
    console.error("Authentication error:", error);
    return error.errno;
    //throw error; // Re-throw to let caller handle it
  }
};

var previous_coinlevels = null;

// Quick open connection
const open_connection = async function (config1 = {}, config2 = {}) {
  try {
    // Ensure global or local opened object
    if (typeof opened === "undefined")
      global.opened = { coin: false, cash: false };

    // COIN DEVICE
    if (!opened.coin) {
      const coinBody = {
        ComPort: config1.com || process.env.coin_port || "/dev/coins",
        SspAddress: config1.addr || 16,
        LogFilePath: config1.log || "/tmp/SmartCoin_Log.log",
        SetFeederRoutes: config1.feed_rout || [
          { Denomination: "5 EUR", Route: 7 },
          { Denomination: "10 EUR", Route: 7 },
          { Denomination: "20 EUR", Route: 7 },
          { Denomination: "50 EUR", Route: 7 },
          { Denomination: "100 EUR", Route: 7 },
          { Denomination: "200 EUR", Route: 7 },
        ],
        SetRoutes: config1.feed_rout || [
          { Denomination: "5 EUR", Route: 7 },
          { Denomination: "10 EUR", Route: 7 },
          { Denomination: "20 EUR", Route: 7 },
          { Denomination: "50 EUR", Route: 7 },
          { Denomination: "100 EUR", Route: 7 },
          { Denomination: "200 EUR", Route: 7 },
        ],
        //SetCashBoxPayoutLimit: config1.payout_limit || [100, 50, 40, 30, 20, 10, 5, 0],
        EnableAcceptor: config1.acceptor ?? true,
        //EnablePayout: config1.payout ?? true
      };

      const options = {
        method: "POST",
        url: `${process.env.itl_url}/api/CashDevice/OpenConnection`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(coinBody),
      };

      const response = await requestPromise(options);
      if (response.statusCode == 200) {
        console.log("✅ Successfully connected to coin device!");
        publish_event("Connected", "/event/COIN_DEV");
        opened.coin = true;
      } else {
        console.warn("❌ Error connecting to coin device!");
        opened.coin = false;
      }
    }




    // wait 3 seconds then open cash
    new Promise((resolve) => setTimeout(resolve, 3000));

    // CASH DEVICE
    if (!opened.cash) {
      const cashBody = {
        ComPort: config2.com || process.env.cash_port || "/dev/cash",
        SspAddress: config2.addr || 0,
        LogFilePath: config2.log || "/tmp/SmartCash_Log.log",
        SetInhibits: config2.inhibits || [],
        SetRoutes: config2.feed_rout || [
          { Denomination: "500 EUR", Route: 7 },
          { Denomination: "1000 EUR", Route: 7 },
          { Denomination: "2000 EUR", Route: 7 },
          { Denomination: "5000 EUR", Route: 7 },
          { Denomination: "10000 EUR", Route: 0 },
          { Denomination: "20000 EUR", Route: 0 },
          { Denomination: "50000 EUR", Route: 0 },
        ],
        EnableAcceptor: true,
        EnableAutoAcceptEscrow: true,
        EnablePayout: true,
      };

      const options = {
        method: "POST",
        url: `${process.env.itl_url}/api/CashDevice/OpenConnection`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cashBody),
      };

      const response = await requestPromise(options);
      if (response.statusCode == 200) {
        console.log("✅ Successfully connected to NV22 cash device!");
        publish_event("Connected", "/event/CASH_DEV");
        opened.cash = true;
      } else {
        console.warn("❌ Error connecting to NV22 cash device!");
        opened.cash = false;
      }
    }


    await stop_devices();

    // get coin levels
    previous_coinlevels= await order(
    "GETALLLEVELS",
    {},
    `SMART_COIN_SYSTEM-${process.env.coin_port}`
  );
    
  } catch (error) {
    console.error("⚠️ Connection error:", error);
  }

  return { cash: opened.cash, coin: opened.coin };
};


let creditAccumulator = 0;
let creditTimer = null;
const CREDIT_AGGREGATION_DELAY_MS = 10000; // 10 seconds

// checksum for coin machine (input to stored)
async function checksum_credit() {
  const coin_levels = await order(
    "GETALLLEVELS",
    {},
    `SMART_COIN_SYSTEM-${process.env.coin_port}`
  );
  //console.log("XXXXXX OLD",previous_coinlevels,"XXXXXX");
  //console.log("YYYYYY NEW",coin_levels,"YYYYYY");
  
  if (coin_levels && coin_levels.levels) {
    // Create a map of previous levels for easy lookup
    const previousMap = new Map();
    if (previous_coinlevels && previous_coinlevels.levels) {
      previous_coinlevels.levels.forEach(level => {
        const key = `${level.value}`;
        previousMap.set(key, level.stored*level.value || 0);
      });
    }
    
    // Compare and calculate differences
    const comparison = {
      differences: [],
      totalPrevious: 0,
      totalCurrent: 0,
      totalDifference: 0,
      details: []
    };
    
    coin_levels.levels.forEach(currentLevel => {
      const key = `${currentLevel.value}`;
      const previousAmount = previousMap.get(key) || 0;
      const currentAmount = currentLevel.stored*currentLevel.value || 0;
      //const difference = currentAmount - previousAmount;
      
      comparison.totalCurrent += currentAmount;
      comparison.totalPrevious += previousAmount;
      
      /*if (difference !== 0) {
        comparison.differences.push({
          countryCode: currentLevel.countryCode,
          value: currentLevel.value,
          previous: previousAmount,
          current: currentAmount,
          difference: difference
        });
      }
      
      comparison.details.push({
        countryCode: currentLevel.countryCode,
        value: currentLevel.value,
        previous: previousAmount,
        current: currentAmount,
        difference: difference
      });*/
    });
    
    comparison.totalDifference = comparison.totalCurrent - comparison.totalPrevious;
    // update previous coinlevel with the current coin levels
    previous_coinlevels = coin_levels;
    console.log(comparison);
    return comparison;
  }
  
  return null;
}


async function sendAggregatedCredit() {

 const difference = await checksum_credit();  
 if(difference.totalDifference != creditAccumulator) {
  console.warn("accumulated credits are different that actual value!",creditAccumulator," % ",difference.totalDifference);
 creditAccumulator= difference.totalDifference;
 }
  if (creditAccumulator > 0) {
    publish_response("credit", creditAccumulator, "cashvalidator");
    console.log("--- AGGREGATION COMPLETE ---");
  }
  // Reset state variables
  creditAccumulator = 0;
  creditTimer = null;
}

var msg;

async function order(command, data = {}, deviceID = null) {
  // make sure we have a token
  if (!token) {
    publish_event(
      "Authentication token not found. Please authenticate first.",
      "/event_resp"
    );
    throw new Error(
      "Authentication token not found. Please authenticate first."
    );
  }

  const endpoints = {
    // Authentication
    UPDATECREDENTIALS: {
      method: "POST",
      url: "/api/Users/UpdateCredentials",
      auth: true,
    },

    // Device Management
    OPENCONNECTION: {
      method: "POST",
      url: "/api/CashDevice/OpenConnection",
      auth: true,
    },
    DISCONNECTDEVICE: {
      method: "POST",
      url: "/api/CashDevice/DisconnectDevice",
      auth: true,
    },
    STARTDEVICE: {
      method: "POST",
      url: "/api/CashDevice/StartDevice",
      auth: true,
    },
    STOPDEVICE: {
      method: "POST",
      url: "/api/CashDevice/StopDevice",
      auth: true,
    },

    // Device Status & Information
    GETCOMPLETECASHDEVICE: {
      method: "GET",
      url: "/api/CashDevice/GetCompleteCashDevice",
      auth: true,
    },
    GETDEVICESTATUS: {
      method: "GET",
      url: "/api/CashDevice/GetDeviceStatus",
      auth: true,
    },
    GETCOUNTERS: {
      method: "GET",
      url: "/api/CashDevice/GetCounters",
      auth: true,
    },
    GETALLLEVELS: {
      method: "GET",
      url: "/api/CashDevice/GetAllLevels",
      auth: true,
    },
    GETCURRENCYASSIGNMENT: {
      method: "GET",
      url: "/api/CashDevice/GetCurrencyAssignment",
      auth: true,
    },

    // Configuration
    SETDENOMINATIONLEVEL: {
      method: "POST",
      url: "/api/CashDevice/SetDenominationLevel",
      auth: true,
    },
    SETDENOMINATIONINHIBITS: {
      method: "POST",
      url: "/api/CashDevice/SetDenominationInhibits",
      auth: true,
    },
    SETDENOMINATIONINHIBIT: {
      method: "POST",
      url: "/api/CashDevice/SetDenominationInhibit",
      auth: true,
    },
    SETDENOMINATIONROUTE: {
      method: "POST",
      url: "/api/CashDevice/SetDenominationRoute",
      auth: true,
    },
    SETDENOMINATIONINHIBITBYINDEX: {
      method: "POST",
      url: "/api/CashDevice/SetDenominationInhibitByIndex",
      auth: true,
    },

    // Acceptor/Payout Control
    ENABLEACCEPTOR: {
      method: "POST",
      url: "/api/CashDevice/EnableAcceptor",
      auth: true,
    },
    DISABLEACCEPTOR: {
      method: "POST",
      url: "/api/CashDevice/DisableAcceptor",
      auth: true,
    },
    ENABLEPAYOUT: {
      method: "POST",
      url: "/api/CashDevice/EnablePayout",
      auth: true,
    },
    ENABLEPAYOUTDEVICE: {
      method: "POST",
      url: "/api/CashDevice/EnablePayoutDevice",
      auth: true,
    },
    ENABLEPAYOUTDEVICEWITHBYTE: {
      method: "POST",
      url: "/api/CashDevice/EnablePayoutDeviceWithByte",
      auth: true,
    },
    DISABLEPAYOUT: {
      method: "POST",
      url: "/api/CashDevice/DisablePayout",
      auth: true,
    },
    SETAUTOACCEPT: {
      method: "POST",
      url: "/api/CashDevice/SetAutoAccept",
      auth: true,
    },

    // Escrow Operations
    ACCEPTFROMESCROW: {
      method: "POST",
      url: "/api/CashDevice/AcceptFromEscrow",
      auth: true,
    },
    RETURNFROMESCROW: {
      method: "POST",
      url: "/api/CashDevice/ReturnFromEscrow",
      auth: true,
    },

    // Payout Operations
    DISPENSEVALUE: {
      method: "POST",
      url: "/api/CashDevice/DispenseValue",
      auth: true,
    },
    PAYOUTBYDENOMINATION: {
      method: "POST",
      url: "/api/CashDevice/PayoutByDenomination",
      auth: true,
    },
    PAYOUTMULTIPLEDENOMINATIONS: {
      method: "POST",
      url: "/api/CashDevice/PayoutMultipleDenominations",
      auth: true,
    },
    FLOAT: { method: "POST", url: "/api/CashDevice/Float", auth: true },
    SETCASHBOXPAYOUTLIMIT: {
      method: "POST",
      url: "/api/CashDevice/SetCashboxPayoutLimit",
      auth: true,
    },

    // Device Operations
    RESETDEVICE: {
      method: "POST",
      url: "/api/CashDevice/ResetDevice",
      auth: true,
    },
    HALTPAYOUT: {
      method: "POST",
      url: "/api/CashDevice/HaltPayout",
      auth: true,
    },
    SMARTEMPTY: {
      method: "POST",
      url: "/api/CashDevice/SmartEmpty",
      auth: true,
    },
    SENDCUSTOMCOMMAND: {
      method: "POST",
      url: "/api/CashDevice/SendCustomCommand",
      auth: true,
    },
    ENABLECOINMECHORFEEDER: {
      method: "POST",
      url: "/api/CashDevice/EnableCoinMechOrFeeder",
      auth: true,
    },
    GETRCMODE: { method: "GET", url: "/api/CashDevice/GetRCMode", auth: true },
    REPLENISH: { method: "POST", url: "/api/CashDevice/Replenish", auth: true },
    REFILLMODE: {
      method: "POST",
      url: "/api/CashDevice/RefillMode",
      auth: true,
    },
    KEYEXCHANGELIMIT32BIT: {
      method: "POST",
      url: "/api/CashDevice/KeyExchangeLimit32bit",
      auth: true,
    },
    GETHOPPEROPTIONS: {
      method: "GET",
      url: "/api/CashDevice/GetHopperOptions",
      auth: true,
    },
    SETHOPPEROPTIONS: {
      method: "POST",
      url: "/api/CashDevice/SetHopperOptions",
      auth: true,
    },

    // Extra Device Info / Maintenance
    GETGLOBALERRORCODE: {
      method: "GET",
      url: "/api/CashDevice/GetGlobalErrorCode",
      auth: true,
    },
    GETSERVICEINFORMATION: {
      method: "GET",
      url: "/api/CashDevice/GetServiceInformation",
      auth: true,
    },
    GETSERVICEINFORMATIONFORMODULE: {
      method: "GET",
      url: "/api/CashDevice/GetServiceInformationForModule",
      auth: true,
    },
    SETSERVICEINFORMATIONMAINTENANCERESET: {
      method: "POST",
      url: "/api/CashDevice/SetServiceInformationMaintenanceReset",
      auth: true,
    },
    SETNOPAYINCOUNT: {
      method: "POST",
      url: "/api/CashDevice/SetNoPayinCount",
      auth: true,
    },
    PURGE: { method: "POST", url: "/api/CashDevice/Purge", auth: true },
    PURGEDEVICE: {
      method: "POST",
      url: "/api/CashDevice/PurgeDevice",
      auth: true,
    },
    PURGEDEVICEHOPPER: {
      method: "POST",
      url: "/api/CashDevice/PurgeDeviceHopper",
      auth: true,
    },
    COINSTIR: { method: "POST", url: "/api/CashDevice/CoinStir", auth: true },
    COINSTIRWITHMODE: {
      method: "POST",
      url: "/api/CashDevice/CoinStirWithMode",
      auth: true,
    },
    GETCOINACCEPTANCE: {
      method: "GET",
      url: "/api/CashDevice/GetCoinAcceptance",
      auth: true,
    },
    GETCOINSEXIT: {
      method: "GET",
      url: "/api/CashDevice/GetCoinsExit",
      auth: true,
    },
    SETREALTIMECLOCK: {
      method: "POST",
      url: "/api/CashDevice/SetRealTimeClock",
      auth: true,
    },
    GETREALTIMECLOCK: {
      method: "GET",
      url: "/api/CashDevice/GetRealTimeClock",
      auth: true,
    },
    SETCASHBOXLEVELS: {
      method: "POST",
      url: "/api/CashDevice/SetCashboxLevels",
      auth: true,
    },
    CLEARCASHBOXLEVELS: {
      method: "POST",
      url: "/api/CashDevice/ClearCashboxLevels",
      auth: true,
    },
    GETCASHBOXLEVELS: {
      method: "GET",
      url: "/api/CashDevice/GetCashboxLevels",
      auth: true,
    },
    SETSORTERROUTE: {
      method: "POST",
      url: "/api/CashDevice/SetSorterRoute",
      auth: true,
    },
    GETSORTERROUTEASSIGNMENT: {
      method: "GET",
      url: "/api/CashDevice/GetSorterRouteAssignment",
      auth: true,
    },
    SETPAYOUTLIMIT: {
      method: "POST",
      url: "/api/CashDevice/SetPayoutLimit",
      auth: true,
    },
    GETPAYOUTCOUNT: {
      method: "GET",
      url: "/api/CashDevice/GetPayoutCount",
      auth: true,
    },
    SETTWNMODE: {
      method: "POST",
      url: "/api/CashDevice/SetTWNMode",
      auth: true,
    },
    EXTENDEDGETDATASETVERSION: {
      method: "GET",
      url: "/api/CashDevice/ExtendedGetDatasetVersion",
      auth: true,
    },
    EXTENDEDGETFIRMWAREVERSION: {
      method: "GET",
      url: "/api/CashDevice/ExtendedGetFirmwareVersion",
      auth: true,
    },
    COMPORTREADERROR: {
      method: "GET",
      url: "/api/CashDevice/ComPortReadError",
      auth: true,
    },
    DEVICESTATESTARTUPREADY: {
      method: "GET",
      url: "/api/CashDevice/DeviceState_StartupReady",
      auth: true,
    },
    GETLIFTERSTATUS: {
      method: "GET",
      url: "/api/CashDevice/GetLifterStatus",
      auth: true,
    },
    GETLASTREJECTCODE: {
      method: "GET",
      url: "/api/CashDevice/GetLastRejectCode",
      auth: true,
    },
    DEVICEERRORLIMPMODE: {
      method: "GET",
      url: "/api/CashDevice/DeviceErrorLimpMode",
      auth: true,
    },
    DEVICESTATELIMPMODE: {
      method: "GET",
      url: "/api/CashDevice/DeviceStateLimpMode",
      auth: true,
    },
    STARTDOWNLOAD: {
      method: "POST",
      url: "/api/CashDevice/StartDownload",
      auth: true,
    },
    GETDOWNLOADSTATUS: {
      method: "GET",
      url: "/api/CashDevice/GetDownloadStatus",
      auth: true,
    },

    // Barcode Operations
    GETBARCODEINHIBIT: {
      method: "GET",
      url: "/api/CashDevice/GetBarcodeInhibit",
      auth: true,
    },
    GETBARCODEDATA: {
      method: "GET",
      url: "/api/CashDevice/GetBarcodeData",
      auth: true,
    },
    GETBARCODEREADERCONFIGURATION: {
      method: "GET",
      url: "/api/CashDevice/GetBarcodeReaderConfiguration",
      auth: true,
    },
    SETBARCODEREADERCONFIGURATION: {
      method: "POST",
      url: "/api/CashDevice/SetBarcodeReaderConfiguration",
      auth: true,
    },
    SETBARCODEINHIBIT: {
      method: "POST",
      url: "/api/CashDevice/SetBarcodeInhibit",
      auth: true,
    },

    // Log Operations
    LOGRAWPACKETS: {
      method: "POST",
      url: "/api/CashDevice/LogRawPackets",
      auth: true,
    },

    // Custom operations
    QUICKDISCONNECT: { function: close_connection, custom: true },
    ENABLE_CV: { function: start_devices, custom: true },
    DISABLE_CV: { function: stop_devices, custom: true },
    PAYOUT: { function: return_cash, custom: true, modifier:true }, 
    EMPTYALL: { function: empty_all, custom: true },
  };

  // custom => Uses a custom created function
  // modifier => Executes an extra operation before finishing

  const endpointConfig = endpoints[command];
  if (!endpointConfig) {
    publish_event(`Unknown command: ${command}`, "/event_resp");
    throw new Error(`Unknown command: ${command}`);
  }

  // custom end point logic
  if (endpointConfig.custom) {
    await endpointConfig.function(data);
    if(endpointConfig.modifier){
    //update coin levels
    previous_coinlevels= await order(
      "GETALLLEVELS",
      {},
      `SMART_COIN_SYSTEM-${process.env.coin_port}`
    );
    console.log("Finished update", previous_coinlevels);
    }
  }

  /// --- START API call Process -------- //
  // build url
  let url = `${process.env.itl_url}${endpointConfig.url}`;

  // if deviceID is provided, attach as query param
  if (deviceID) {
    url += `${url.includes("?") ? "&" : "?"}deviceID=${encodeURIComponent(
      deviceID
    )}`;
  }

  try {
    const options = {
      method: endpointConfig.method,
      url: url,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 20_000, // 20s timeout
    };

    // Add token to header
    if (endpointConfig.auth) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    // Add body for POST requests and non-empty data
    if (
      endpointConfig.method === "POST" &&
      data &&
      Object.keys(data).length > 0
    ) {
      options.body = JSON.stringify(data);
    }

    //console.log("Request URL:", url, "Body:", options.body || "{}");
     /// --- END API call Process -------- //
    /// --- START API Response parsing Process -------- //
    // await response from itl server
    const response = await requestPromise(options);

    if (response.body.success || response.body?.length > 0) {
      console.log(
        `[OK] ${command} →`,
        util.inspect(response.body, {
          depth: 1,
          colors: true,
          breakLength: 120,
        })
      );
    }

    // response parsing
    msg = response?.body?.message ?? response?.body?.reason ?? null;

    if (msg) {
      publish_event(msg, "/event_resp");
    }

    // Detailed state to state logging
    if (Array.isArray(response.body) && response.body?.length > 0) {
      const events = response.body
        .map((item) => {
          if (item.type === "DeviceStatusResponse") {
            return item.stateAsString;
          }
          if(item.type === "DispenserTransactionEventResponse"){
            console.log(`[Dispense] Transaction status: ${item.stateAsString}`);
          }
          if (item.type === "CashEventResponse") {
            // Determine the action based on the event type
            switch (item.eventTypeAsString) {
              case "STORED":
              case "STACKED":
                // Immediate credit events (no aggregation needed)
                console.log(
                  `[Immediate Credit] ${item.eventTypeAsString} event received.`
                );
                publish_response("credit", item.value, "cashvalidator");
                break;

              case "COIN_CREDIT":
              case "VALUE_ADDED":
                // This is the new aggregation logic:

                // 1. Add the current value to the accumulator
                creditAccumulator += item.value;

                // 2. Clear any existing timer to debounce the action
                if (creditTimer) {
                  clearTimeout(creditTimer);
                  console.log(
                    `[${item.eventTypeAsString}] Debouncing. Total accumulated: ${creditAccumulator}`
                  );
                } else {
                  console.log(
                    `[${item.eventTypeAsString}] Starting new ${
                      CREDIT_AGGREGATION_DELAY_MS / 1000
                    }s aggregation window.`
                  );
                }

                // 3. Set a new timer. If no new COIN_CREDIT arrives before the timer
                // expires, the accumulated value will be published.
                creditTimer = setTimeout(
                  sendAggregatedCredit,
                  CREDIT_AGGREGATION_DELAY_MS
                );
                break;

              case "DISPENSING":
                // Immediate payout event
                console.log(
                  `[Payout] ${item.eventTypeAsString} event received.`
                );
                publish_response("payout", item.value, "cashvalidator");
                break;

              default:
                console.log(
                  `[Other Event] ${item.eventTypeAsString} received.`
                );
            }
          }
          return null;
        })
        .filter(Boolean);

      const eventsStr = events.join(",");

      publish_event(eventsStr, "/event_resp");
    }
    /// --- END API Response parsing Process -------- //
     /// --- START MQTT Log Process -------- //

    // log response in mqtt to it's related device topic
    if (deviceID === `SMART_COIN_SYSTEM-${process.env.coin_port}`) {
      //publish_event({command,"device":"COIN_DEV"});
      if (response.body.success || response.body?.length > 0) {
        publish_event(response.body, "/event/COIN_DEV");
      }
    } else {
      //publish_event({command,"device":"CASH_DEV"});
      if (response.body.success || response.body?.length > 0) {
        publish_event(response.body, "/event/CASH_DEV");
      }
    }

    if (response.statusCode !== 200) {
      console.error(
        `[FAIL] ${command} (${response.statusCode}) →`,
        util.inspect(response.body, { depth: 2, colors: true })
      );
      publish_event(
        `[FAIL] ${command} (${response.statusCode}) → ${
          response.body.error ? response.body.error : response.body
        }`,
        "/event_resp"
      );
      throw new Error(
        `command failed: ${command} status ${response.statusCode}`
      );
    }
     /// --- END MQTT Log Process -------- //
     /// --- START Credentials Update process -------- //

    // Update environment variables on login update
    if (command === "UPDATECREDENTIALS") {
      publish_event("updating credentials", "/event_resp");
      setEnvValue("itl_user", data["NewUsername"]);
      setEnvValue("itl_pass", data["NewPassword"]);
    }
     /// --- END Credentials Update process -------- //

    return response.body;
  } catch (error) {
    console.error(`[ERR] ${command} →`, error.message || error, ", [MSG] ",msg,", [DEVICE] ",deviceID);
    // fix payout busy
    if(command === "PAYOUTMULTIPLEDENOMINATIONS" && msg== "BUSY"){
      console.log("payout error");
      return {"code":-2,"id":deviceID};
    }
    return -1;
  }
}

async function executePayout(notes,device){
   // 8️⃣ Execute payout
    if (notes.some((n) => n > 0)) {
      try {
        console.log(`[DISPENSE] Bills payout...`);
        var response=await order(
          "PAYOUTMULTIPLEDENOMINATIONS",
          notes,
          device
        );
      } catch (err) {
        console.log(err.message);
      }
    }
    console.log(response);
    return response;
}

const return_cash = async function (data = 0) {
  try {
    // 1️⃣ Get current levels
    const coin_levels = await order(
      "GETALLLEVELS",
      {},
      `SMART_COIN_SYSTEM-${process.env.coin_port}`
    );
    const cash_levels = await order(
      "GETALLLEVELS",
      {},
      `SPECTRAL_PAYOUT-${process.env.cash_port}`
    );

    // 2️⃣ Auto-extract available denominations (sorted ascending for payout arrays)
    const returnable_coins = [
      ...new Set(coin_levels.levels.map((l) => l.value)),
    ].sort((a, b) => a - b);
    const returnable_bills = [
      ...new Set(cash_levels.levels.map((l) => l.value)),
    ].sort((a, b) => a - b);

    // 3️⃣ Map storage levels
    const coins = coin_levels.levels.map((l) => ({
      type: "coin",
      value: l.value,
      stored: l.stored,
    }));
    const bills = cash_levels.levels.map((l) => ({
      type: "bill",
      value: l.value,
      stored: l.stored,
    }));

    // 4️⃣ Compute totals
    const total_coins = coins.reduce((sum, c) => sum + c.value * c.stored, 0);
    const total_bills = bills.reduce((sum, b) => sum + b.value * b.stored, 0);
    const total_available = total_coins + total_bills;

    console.log(`[INFO] Requested payout: ${data} cents`);
    console.log(
      `[INFO] Available: Coins=${total_coins}, Bills=${total_bills}, Total=${total_available}`
    );

    if (total_available < data) {
      publish_event(
        `[ERROR] Not enough funds. Required: ${data}, available: ${total_available}`,
        "/event_resp"
      );
      console.error(
        `[ERROR] Not enough funds. Required: ${data}, available: ${total_available}`
      );
      return {
        success: false,
        message: "Not enough funds available for payout.",
      };
    }

    // 5️⃣ Determine coverage type
    let coverage_type = "";
    if (total_bills >= data) coverage_type = "bills_only";
    else if (total_bills + total_coins >= data)
      coverage_type = "bills_and_coins";
    else coverage_type = "coins_only";

    console.log(`[INFO] Coverage type: ${coverage_type}`);

    // 6️⃣ Build payout plan (prioritize bills first)
    let remaining = data;
    const payout_plan = [];

    // Bills first
    for (const b of bills.sort((a, b) => b.value - a.value)) {
      if (remaining <= 0) break;
      const max_needed = Math.floor(remaining / b.value);
      const to_give = Math.min(max_needed, b.stored);
      if (to_give > 0) {
        payout_plan.push({ type: "bill", value: b.value, qty: to_give });
        remaining -= to_give * b.value;
      }
    }

    // Then coins
    if (remaining > 0) {
      for (const c of coins.sort((a, b) => b.value - a.value)) {
        if (remaining <= 0) break;
        const max_needed = Math.floor(remaining / c.value);
        const to_give = Math.min(max_needed, c.stored);
        if (to_give > 0) {
          payout_plan.push({ type: "coin", value: c.value, qty: to_give });
          remaining -= to_give * c.value;
        }
      }
    }

    if (remaining > 0) {
      publish_event(
        `[ERROR] Could not make exact payout. Remaining: ${remaining} cents`,
        "/event_resp"
      );
      console.error(
        `[ERROR] Could not make exact payout. Remaining: ${remaining} cents`
      );
      return {
        success: false,
        message: "Unable to make exact payout with available denominations.",
        payout_plan,
      };
    }

    const total_payout = payout_plan.reduce(
      (sum, p) => sum + p.value * p.qty,
      0
    );
    console.log(
      `[SUCCESS] Payout plan ready: ${JSON.stringify(
        payout_plan
      )} (total ${total_payout} cents)`
    );

    // 7️⃣ Build denomination arrays dynamically
    const noteCounts = returnable_bills.map((denom) => {
      const found = payout_plan.find(
        (p) => p.type === "bill" && p.value === denom
      );
      return found ? found.qty : 0;
    });

    const coinCounts = returnable_coins.map((denom) => {
      const found = payout_plan.find(
        (p) => p.type === "coin" && p.value === denom
      );
      return found ? found.qty : 0;
    });

    console.log(`[INFO] noteCounts (bills): ${JSON.stringify(noteCounts)}`);
    console.log(`[INFO] coinCounts (coins): ${JSON.stringify(coinCounts)}`);

    var resp_cash = await executePayout(noteCounts,`SPECTRAL_PAYOUT-${process.env.cash_port}`);

    // wait 3 seconds then open cash
    new Promise((resolve) => setTimeout(resolve, 3000));

    var resp_coin = await executePayout(coinCounts,`SMART_COIN_SYSTEM-${process.env.coin_port}`);

    if((resp_coin?.code==-2 && resp_coin.id == `SMART_COIN_SYSTEM-${process.env.coin_port}`) || (resp_cash?.code == -2 && resp_cash.id == `SPECTRAL_PAYOUT-${process.env.cash_port}`)){
      console.log(`[X] Dispense Error!`,(resp_coin.code!=-2 && resp_coin.id == `SMART_COIN_SYSTEM-${process.env.coin_port}`) ,(resp_cash.code!=-2 && resp_cash.id == `SPECTRAL_PAYOUT-${process.env.cash_port}`) );
      var attempts;
      if((resp_coin.code==-2 && resp_coin.id == `SMART_COIN_SYSTEM-${process.env.coin_port}`)){
        attempts = 0;
        while (attempts < 5 & resp_coin?.code==-2) {
          attempts++;
          console.log("attempt coin",attempts);
          resp_coin = await executePayout(coinCounts,`SMART_COIN_SYSTEM-${process.env.coin_port}`);
           // wait 3 seconds then open cash
           new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if((resp_cash.code==-2 && resp_cash.id == `SPECTRAL_PAYOUT-${process.env.cash_port}`)){
        attempts = 0;
        while (attempts < 5 & resp_cash?.code==-2) {
          attempts++;
          console.log("attempt cash",attempts);
          resp_cash = await executePayout(noteCounts,`SPECTRAL_PAYOUT-${process.env.cash_port}`);
          new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if((resp_coin?.code==-2 && resp_coin.id == `SMART_COIN_SYSTEM-${process.env.coin_port}`) || (resp_cash.code==-2 && resp_cash.id == `SPECTRAL_PAYOUT-${process.env.cash_port}`)){
        publish_event(`Dispense Error!`, "/event_resp");
        return false;
      }
    }

    console.log(`[✅] Dispense completed successfully!`);
    publish_event(`Dispense completed successfully!`, "/event_resp");


    return {
      success: true,
      coverage_type,
      payout_plan,
      noteCounts,
      coinCounts,
      total_payout,
    };
  } catch (err) {
    publish_event(
      `[ERROR] return_cash failed: ${err.message}`,
      "/event_resp"
    );
    console.error(`[ERROR] return_cash failed: ${err.message}`);
    return { success: false, message: err.message };
  }
};

// Empty all devices
const empty_all = async function (data = 0) {
  // check devices stock
  const coin_levels = await order(
    "GETALLLEVELS",
    {},
    `SMART_COIN_SYSTEM-${process.env.coin_port}`
  );
  const cash_levels = await order(
    "GETALLLEVELS",
    {},
    `SPECTRAL_PAYOUT-${process.env.cash_port}`
  );

  // 3️⃣ Filter and map usable levels
  const coins = coin_levels.levels.map((l) => ({
    type: "coin",
    value: l.value,
    stored: l.stored,
  }));

  const bills = cash_levels.levels.map((l) => ({
    type: "bill",
    value: l.value,
    stored: l.stored,
  }));

  // count devices available balance
  const total_coins = coins.reduce((sum, c) => sum + c.value * c.stored, 0);
  const total_bills = bills.reduce((sum, b) => sum + b.value * b.stored, 0);
  // if not empty -> empty
  if (total_coins > 0) {
    console.log("emptying coins");
    await order(
      "SMARTEMPTY",
      { ModuleNumber: 0, IsNV4000: false },
      `SMART_COIN_SYSTEM-${process.env.coin_port}`
    );
  }
  if (total_bills > 0) {
    console.log("emptying bills");
    await order(
      "SMARTEMPTY",
      { ModuleNumber: 0, IsNV4000: false },
      `SPECTRAL_PAYOUT-${process.env.cash_port}`
    );
  }
  publish_event("[OK] Empty Successfully", "/event_resp");
};

// Quick close connection
const close_connection = async function (data = 0) {
  try {
    await order(
      "DISCONNECTDEVICE",
      {},
      `SMART_COIN_SYSTEM-${process.env.coin_port}`
    );
    await order(
      "DISCONNECTDEVICE",
      {},
      `SPECTRAL_PAYOUT-${process.env.cash_port}`
    );
    publish_event("[OK] Connection closed Successfully", "/event_resp");
    opened.coin = false;
    opened.cash = false;
  } catch (err) {}
};

// Quick start devices
const start_devices = async function (data = 0) {
  await order("STARTDEVICE", {}, `SMART_COIN_SYSTEM-${process.env.coin_port}`);
  await order("STARTDEVICE", {}, `SPECTRAL_PAYOUT-${process.env.cash_port}`);
  publish_event("[OK] Devices Started Successfully", "/event_resp");
  await order(
    "COINSTIR",
    JSON.stringify(3),
    `SMART_COIN_SYSTEM-${process.env.coin_port}`
  );
};
const stop_devices = async function (data = 0) {
  await order("STOPDEVICE", {}, `SMART_COIN_SYSTEM-${process.env.coin_port}`);
  await order("STOPDEVICE", {}, `SPECTRAL_PAYOUT-${process.env.cash_port}`);
  publish_event("[OK] Devices Stopped Successfully", "/event_resp");
};

module.exports = { order, init, open_connection };
