import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const frontendDir = join(__dirname, "..", "frontend");

let shares = [
  {
    id: "shr_001",
    title: "CloudMind architecture notes",
    type: "Document",
    owner: "Ayham",
    description: "A shared document explaining the multi-agent DevOps platform architecture.",
    url: "https://github.com/Hedi808",
    createdAt: new Date().toISOString()
  },
  {
    id: "shr_002",
    title: "Azure deployment checklist",
    type: "Checklist",
    owner: "DevOps Team",
    description: "A checklist for validating Azure Container Apps deployments.",
    url: "https://azure.microsoft.com",
    createdAt: new Date().toISOString()
  },
  {
    id: "shr_003",
    title: "Frontend demo preview",
    type: "Link",
    owner: "3S System",
    description: "A sample shared frontend preview link for testing.",
    url: "https://example.com/demo",
    createdAt: new Date().toISOString()
  }
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });

  response.end(body);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });

  response.end(text);
}

function notFound(response) {
  sendJson(response, 404, {
    error: "Not Found",
    message: "The requested resource does not exist."
  });
}

function methodNotAllowed(response) {
  sendJson(response, 405, {
    error: "Method Not Allowed",
    message: "This HTTP method is not allowed for this endpoint."
  });
}

function createShareId() {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);

  return `shr_${timestamp}_${random}`;
}

function isValidUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      resolve(body);
    });

    request.on("error", reject);
  });
}

async function parseJsonBody(request) {
  const rawBody = await readRequestBody(request);

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function validateSharePayload(payload) {
  const errors = [];

  const title = String(payload.title || "").trim();
  const type = String(payload.type || "").trim();
  const owner = String(payload.owner || "").trim();
  const description = String(payload.description || "").trim();
  const url = String(payload.url || "").trim();

  if (!title) {
    errors.push("title is required");
  }

  if (!type) {
    errors.push("type is required");
  }

  if (!owner) {
    errors.push("owner is required");
  }

  if (!description) {
    errors.push("description is required");
  }

  if (!isValidUrl(url)) {
    errors.push("url must be a valid http or https URL");
  }

  return {
    valid: errors.length === 0,
    errors,
    share: {
      title,
      type,
      owner,
      description,
      url
    }
  };
}

function getShareStats() {
  const byType = shares.reduce((accumulator, share) => {
    accumulator[share.type] = (accumulator[share.type] || 0) + 1;
    return accumulator;
  }, {});

  const byOwner = shares.reduce((accumulator, share) => {
    accumulator[share.owner] = (accumulator[share.owner] || 0) + 1;
    return accumulator;
  }, {});

  return {
    totalShares: shares.length,
    byType,
    byOwner,
    lastUpdated: new Date().toISOString()
  };
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (url.pathname === "/api/status") {
    if (request.method !== "GET") {
      methodNotAllowed(response);
      return;
    }

    sendJson(response, 200, {
      online: true,
      project: "3S",
      name: "Standard Sharing Software",
      service: "3S API",
      message: "The 3S Node.js backend is connected.",
      port: PORT,
      healthPath: "/api/status",
      timestamp: new Date().toISOString()
    });

    return;
  }

  if (url.pathname === "/api/shares") {
    if (request.method === "GET") {
      sendJson(response, 200, {
        items: shares,
        count: shares.length
      });
      return;
    }

    if (request.method === "POST") {
      try {
        const payload = await parseJsonBody(request);
        const validation = validateSharePayload(payload);

        if (!validation.valid) {
          sendJson(response, 400, {
            error: "Validation Error",
            messages: validation.errors
          });
          return;
        }

        const newShare = {
          id: createShareId(),
          ...validation.share,
          createdAt: new Date().toISOString()
        };

        shares = [newShare, ...shares];

        sendJson(response, 201, {
          message: "Share created successfully.",
          item: newShare
        });
      } catch (error) {
        sendJson(response, 400, {
          error: "Bad Request",
          message: error.message
        });
      }

      return;
    }

    methodNotAllowed(response);
    return;
  }

  if (url.pathname.startsWith("/api/shares/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/shares/", ""));

    if (!id) {
      notFound(response);
      return;
    }

    const share = shares.find((item) => item.id === id);

    if (!share) {
      notFound(response);
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, {
        item: share
      });
      return;
    }

    if (request.method === "DELETE") {
      shares = shares.filter((item) => item.id !== id);

      sendJson(response, 200, {
        message: "Share deleted successfully.",
        deletedId: id
      });
      return;
    }

    methodNotAllowed(response);
    return;
  }

  if (url.pathname === "/api/stats") {
    if (request.method !== "GET") {
      methodNotAllowed(response);
      return;
    }

    sendJson(response, 200, getShareStats());
    return;
  }

  notFound(response);
}

async function serveStaticFile(request, response, url) {
  let requestedPath = url.pathname;

  if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(frontendDir, safePath);

  if (!filePath.startsWith(frontendDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  const finalPath = existsSync(filePath) ? filePath : join(frontendDir, "index.html");
  const extension = extname(finalPath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  try {
    const content = await readFile(finalPath);

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });

    response.end(content);
  } catch {
    sendText(response, 500, "Could not read frontend file.");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStaticFile(request, response, url);
  } catch (error) {
    sendJson(response, 500, {
      error: "Internal Server Error",
      message: error.message
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`3S is running at http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/status`);
});