const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { publish_response } = require("./mqttClient.js");
require("dotenv").config();

const baseUrl = "https://api.sumup.com";
const PAYMENT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const POLL_INTERVAL_MS = 2000; // 2 seconds
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "transactions.log");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

async function axiosRequest(url, method, data = null) {
  try {
    const response = await axios({
      method: method,
      url: baseUrl + url,
      headers: { Authorization: `Bearer ${process.env.sum_up_key}` },
      data: data,
    });
    //console.log("API response: ", response.data);
    return response.data;
  } catch (error) {
    console.error(`API request failed: ${method} ${url}`, error.message);
    if (error.response) {
      console.error("API error response status:", error.response.status);
      console.error("API error response data:", error.response.data);
    }
    publish_response(
      "stripe_response",
      "ERROR",
      "stripe",
      false,
      error.response.data,
    ); /// stripe_response
    throw error;
  }
}

function logTransaction(action, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    transactionId:
      details.clientTransactionId || details.transactionId || "N/A",
    ...details,
  };

  const logLine = JSON.stringify(logEntry) + "\n";

  // Console log
  console.log(
    `[${timestamp}] Transaction ${action}:`,
    JSON.stringify(details, null, 2),
  );

  // File log
  fs.appendFile(LOG_FILE, logLine, (err) => {
    if (err) {
      console.error("Error writing to log file:", err.message);
    }
  });
}

class TPEclient {
  constructor() {
    this.readerid = process.env.sum_up_id;
    this.merchant = process.env.sum_up_merchant;
  }

  static async initialize() {
    const client = new TPEclient();
    try {
      const response = await axiosRequest(
        `/v0.1/merchants/${client.merchant}/readers/${client.readerid}`,
        "GET",
        null,
      );

      if (response && response.id) {
        console.log("TPE initialized successfully");
        logTransaction("INIT", {
          readerId: response.id,
          merchant: client.merchant,
        });
        client.readerid = response.id;
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error initializing TPE:", error.message);
      logTransaction("INIT_FAILED", { error: error.message });
      return false;
    }
  }

  async getClientTransaction(clientTransactionId) {
    try {
      const response = await axiosRequest(
        `/v2.1/merchants/${this.merchant}/transactions?client_transaction_id=${clientTransactionId}`,
        "GET",
        null,
      );

      if (response.transaction_code) {
        logTransaction("QUERY", {
          clientTransactionId,
          status: response.status,
          transactionData: response,
        });
        return response;
      } else {
        throw new Error("No transaction data found");
      }
    } catch (error) {
      console.error("Error getting transaction:", error.message);
      logTransaction("QUERY_FAILED", {
        clientTransactionId,
        error: error.message,
      });
      throw error;
    }
  }

  async terminatePayment(clientTransactionId = null) {
    try {
      const response = await axiosRequest(
        `/v0.1/merchants/${this.merchant}/readers/${this.readerid}/terminate`,
        "POST",
        null,
      );
      logTransaction("TERMINATED", {
        clientTransactionId,
        readerId: this.readerid,
      });
      return response;
    } catch (error) {
      console.error("Error terminating payment:", error.message);
      logTransaction("TERMINATE_FAILED", {
        clientTransactionId,
        error: error.message,
      });
      throw error;
    }
  }

  static async createPayment(amount, currency = "CHF") {
    const client = new TPEclient();
    const startTime = Date.now();
    let pollInterval = null;
    let timeoutTimer = null;

    try {
      const data = {
        total_amount: {
          currency: currency,
          minor_unit: 2,
          value: amount,
        },
      };

      const response = await axiosRequest(
        `/v0.1/merchants/${client.merchant}/readers/${client.readerid}/checkout`,
        "POST",
        data,
      );
      if (response && response.data.client_transaction_id) {
        const clientTransactionId = response.data.client_transaction_id;

        logTransaction("CREATED", {
          clientTransactionId,
          amount,
          currency,
          readerId: client.readerid,
          merchantId: client.merchant,
        });

        // Set up timeout to terminate payment after 2 minutes
        console.log("Setting up payment timeout...");
        timeoutTimer = setTimeout(async () => {
          clearInterval(pollInterval);
          console.warn(
            `Payment timeout exceeded for transaction ${clientTransactionId}`,
          );

          try {
            await client.terminatePayment(clientTransactionId);

            logTransaction("TIMEOUT", {
              clientTransactionId,
              duration: Date.now() - startTime,
              amount,
              currency,
            });
            publish_response("stripe_response", "TIMEOUT ERROR", "stripe"); /// stripe_response
          } catch (error) {
            console.error(
              "Error terminating payment on timeout:",
              error.message,
            );
            logTransaction("TIMEOUT_TERMINATE_FAILED", {
              clientTransactionId,
              error: error.message,
            });
          }
        }, PAYMENT_TIMEOUT_MS);

        // Poll transaction status
        console.log(
          "Transaction Created, polling status...",
          clientTransactionId,
        );
        pollInterval = setInterval(async () => {
          try {
            const transaction =
              await client.getClientTransaction(clientTransactionId);
            if (
              transaction.status === "SUCCESSFUL" ||
              transaction.status === "PAID"
            ) {
              clearInterval(pollInterval);
              clearTimeout(timeoutTimer);

              logTransaction("COMPLETED", {
                clientTransactionId,
                status: transaction.status,
                duration: Date.now() - startTime,
                amount,
                currency,
                transactionId: transaction.id || "N/A",
              });

              publish_response(
                "stripe_response",
                "Payment successful",
                "stripe",
                false,
                response,
              ); /// stripe_response
            } else if (
              transaction.status === "FAILED" ||
              transaction.status === "EXPIRED"
            ) {
              clearInterval(pollInterval);
              clearTimeout(timeoutTimer);

              logTransaction("FAILED", {
                clientTransactionId,
                status: transaction.status,
                duration: Date.now() - startTime,
                amount,
                currency,
                failureReason: transaction.failure_reason || "Termination",
              });
              publish_response("stripe_response", "ERROR", "stripe"); /// stripe_response
            }
          } catch (error) {
            clearInterval(pollInterval);
            clearTimeout(timeoutTimer);
            console.error("Error polling transaction status:", error.message);
            logTransaction("POLL_ERROR", {
              clientTransactionId,
              error: error.message,
            });
          }
        }, POLL_INTERVAL_MS);

        return clientTransactionId;
      }

      return null;
    } catch (error) {
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      console.error("Error creating payment:", error.message);
      logTransaction("CREATE_FAILED", {
        amount,
        currency,
        error: error.message,
      });
      return null;
    }
  }
}

module.exports = { TPEclient };
