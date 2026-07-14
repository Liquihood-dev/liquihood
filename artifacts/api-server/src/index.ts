import app from "./app";
import { logger } from "./lib/logger";
import { startKeeper } from "./lib/keeper";
import { startLiquidationBot } from "./lib/liquidation-bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start price keeper: pushes live prices to OracleRouter every 4 minutes
  const apiBase = process.env["API_BASE_URL"] ?? `http://localhost:${port}`;
  startKeeper(apiBase);

  // Start liquidation bot: scans for underwater positions every 30 seconds
  startLiquidationBot();
});
