import { ConvexHttpClient } from "convex/browser";

let client = null;

export function getConvexClient() {
  if (client) return client;

  const url = process.env.CONVEX_URL;
  if (!url) {
    console.warn("CONVEX_URL not set. Running in offline mode.");
    return null;
  }

  // Validate URL format
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    console.error(`Invalid CONVEX_URL: "${url}"`);
    console.error("URL must start with https:// or http://");
    console.warn("Running in offline mode due to invalid URL.");
    return null;
  }

  try {
    client = new ConvexHttpClient(url);
    return client;
  } catch (error) {
    console.error(`Failed to create Convex client: ${error.message}`);
    console.warn("Running in offline mode due to client error.");
    return null;
  }
}

export async function queryConvex(functionName, args = {}) {
  const convexClient = getConvexClient();
  if (!convexClient) return null;

  try {
    return await convexClient.query(functionName, args);
  } catch (error) {
    console.error(`Convex query error (${functionName}):`, error.message);
    return null;
  }
}

export async function mutateConvex(functionName, args = {}) {
  const convexClient = getConvexClient();
  if (!convexClient) return null;

  try {
    return await convexClient.mutation(functionName, args);
  } catch (error) {
    console.error(`Convex mutation error (${functionName}):`, error.message);
    return null;
  }
}
