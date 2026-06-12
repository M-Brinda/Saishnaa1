process.chdir(__dirname);
const http = require("http");
const fs = require("fs");
const path = require("path");


const PORT = process.env.PORT || 8080;


const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

function fetchHtml(urlStr, callback) {
  const https = require("https");
  const url = new URL(urlStr);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  };
  https.get(options, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      let redirectUrl = res.headers.location;
      if (!redirectUrl.startsWith("http")) {
        redirectUrl = url.origin + redirectUrl;
      }
      return fetchHtml(redirectUrl, callback);
    }
    if (res.statusCode !== 200) {
      callback(new Error(`Failed to load page: status code ${res.statusCode}`));
      return;
    }
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      callback(null, data);
    });
  }).on("error", (err) => {
    callback(err);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/archive") {
    const code = parsedUrl.searchParams.get("code");
    const page = parsedUrl.searchParams.get("page");
    if (!code || !page) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing parameters" }));
      return;
    }

    const targetUrl = `https://internationaljournalssrg.org/${code}/archive_details?page=${page}`;
    fetchHtml(targetUrl, (err, html) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      try {
        const titleMatch = html.match(/<h1[^>]*class="[^"]*h4[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
          html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

        const papers = [];
        const parts = html.split(/<div[^>]*class="card shadow-sm border-1 position-relative w-100/i);
        for (let i = 1; i < parts.length; i++) {
          const cardHtml = parts[i].split(/<div[^>]*class="card shadow-sm border-1 position-relative w-100/i)[0];

          const idMatch = cardHtml.match(/<strong>([^<]+)<\/strong>/i) ||
            cardHtml.match(/itemprop="identifier"[^>]*content="([^"]+)"/i);
          let id = idMatch ? (idMatch[1].includes("doi.org") ? idMatch[1].split("/").pop() : idMatch[1].trim()) : "";

          const sectionMatch = cardHtml.match(/itemprop="articleSection">([^<]+)<\/span>/i) ||
            cardHtml.match(/articleSection">([^<]+)<\/span>/i);
          const section = sectionMatch ? sectionMatch[1].trim() : "Research Article";

          const linkMatch = cardHtml.match(/href="[^"]*paper-details\?Id=(\d+)"/i);
          const paperId = linkMatch ? linkMatch[1].trim() : "";

          const titleMatchCard = cardHtml.match(/itemprop="headline"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
            cardHtml.match(/headline"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
            cardHtml.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
          const paperTitle = titleMatchCard ? titleMatchCard[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

          const authorMatch = cardHtml.match(/itemprop="author">([\s\S]*?)<\/span>/i) ||
            cardHtml.match(/author">([\s\S]*?)<\/span>/i);
          const authors = authorMatch ? authorMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

          if (paperTitle && paperId) {
            papers.push({ id, section, paperId, title: paperTitle, authors });
          }
        }
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ title, papers }));
      } catch (ex) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: "Failed to parse content: " + ex.message }));
      }
    });
    return;
  }

  if (pathname === "/api/paper") {
    const code = parsedUrl.searchParams.get("code");
    const id = parsedUrl.searchParams.get("id");
    if (!code || !id) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing parameters" }));
      return;
    }

    const targetUrl = `https://internationaljournalssrg.org/${code}/paper-details?Id=${id}`;
    fetchHtml(targetUrl, (err, html) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      try {
        const pdfMatch = html.match(/id="articlePdf"[^>]*href="([^"]+)"/i) ||
          html.match(/href="([^"]+)"[^>]*id="articlePdf"/i) ||
          html.match(/href="([^"]+\.pdf)"/i);
        let pdfUrl = pdfMatch ? pdfMatch[1].replace(/\s+/g, "").trim() : "";
        if (pdfUrl && !pdfUrl.startsWith("http")) {
          pdfUrl = pdfUrl.replace(/^\/?\.\.\//, "/");
          pdfUrl = "https://internationaljournalssrg.org" + pdfUrl;
        }

        const titleMatch = html.match(/<h1[^>]*class="h3"[^>]*>([\s\S]*?)<\/h1>/i) ||
          html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

        const authorsMatch = html.match(/<h2[^>]*class="fw-bold"[^>]*>([\s\S]*?)<\/h2>/i) ||
          html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        const authors = authorsMatch ? authorsMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

        const citationMatch = html.match(/id="citation"[^>]*>([\s\S]*?)<\/section>/i) ||
          html.match(/id="citation"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        let citation = "";
        if (citationMatch) {
          const pMatch = citationMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          citation = pMatch ? pMatch[1].trim() : citationMatch[1].trim();
          citation = citation.replace(/<b>Citation\s*:\s*<\/b>/i, "").replace(/Citation\s*:\s*/i, "");
        }

        const abstractMatch = html.match(/id="abstract"[^>]*>([\s\S]*?)<\/section>/i) ||
          html.match(/id="abstract"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        let abstract = "";
        if (abstractMatch) {
          const pMatch = abstractMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          abstract = pMatch ? pMatch[1].trim() : abstractMatch[1].trim();
          abstract = abstract.replace(/<b>Abstract\s*<\/b>/i, "").replace(/Abstract/i, "");
        }

        const keywordsMatch = html.match(/id="keywords"[^>]*>([\s\S]*?)<\/section>/i) ||
          html.match(/id="keywords"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        let keywords = "";
        if (keywordsMatch) {
          const pMatch = keywordsMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          keywords = pMatch ? pMatch[1].trim() : keywordsMatch[1].trim();
          keywords = keywords.replace(/<b>Keywords\s*<\/b>/i, "").replace(/Keywords/i, "");
        }

        const referencesMatch = html.match(/id="references"[^>]*>([\s\S]*?)<\/section>/i);
        let referencesHtml = "";
        if (referencesMatch) {
          referencesHtml = referencesMatch[1].trim();
          referencesHtml = referencesHtml.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/i, "");
          referencesHtml = referencesHtml.replace(/<style>[\s\S]*?<\/style>/gi, "");
        }

        const metaMatch = html.match(/<small style="font-size:13px">([\s\S]*?)<\/small>/i);
        const metaText = metaMatch ? metaMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ title, authors, pdfUrl, citation, abstract, keywords, references: referencesHtml, metaText }));
      } catch (ex) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: "Failed to parse content: " + ex.message }));
      }
    });
    return;
  }

  let filePath = "." + req.url;
  if (filePath === "./") {
    filePath = "./index.html";
  }

  filePath = filePath.split("?")[0].split("#")[0];

  // Route rewriting to handle missing/differently named files locally
  const ROUTE_MAP = {
    "./services.html": "./our-services.html",
    "./courses.html": "./training-courses.html",
    "./projects.html": "./our-projects.html",
    "./journals.html": "./academic-journals.html",
    "./contact.html": "./contact-us.html",
    "./services": "./our-services.html",
    "./courses": "./training-courses.html",
    "./projects": "./our-projects.html",
    "./journals": "./academic-journals.html",
    "./contact": "./contact-us.html",
    "./about": "./index.html",
    "./about.html": "./index.html"
  };

  if (ROUTE_MAP[filePath]) {
    filePath = ROUTE_MAP[filePath];
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        // Fallback for subpages or standard routing
        fs.readFile("./index.html", (err, html) => {
          if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 File Not Found");
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html, "utf-8");
          }
        });
      } else {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Server Error: " + error.code);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

function startServer(port) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("Server error:", err);
    }
  });

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
    console.log("Press Ctrl+C to stop.");
  });
}

startServer(PORT);


