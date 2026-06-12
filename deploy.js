const fs = require('fs');
const path = require('path');

const logFile = 'd:/Brinda/Saishnaa/saiahnaa website/deploy.log';
fs.writeFileSync(logFile, ''); // clear log
const originalLog = console.log;
const originalError = console.error;
console.log = function(...args) {
  originalLog.apply(console, args);
  fs.appendFileSync(logFile, args.join(' ') + '\n');
};
console.error = function(...args) {
  originalError.apply(console, args);
  fs.appendFileSync(logFile, 'ERROR: ' + args.join(' ') + '\n');
};


// Monkey patch fs.realpathSync to bypass sandbox lstat restriction on root of C: or D:
const originalRealpathSync = fs.realpathSync;
fs.realpathSync = function(p, options) {
  try {
    return originalRealpathSync(p, options);
  } catch (e) {
    if (e.code === 'EPERM') {
      return path.resolve(p);
    }
    throw e;
  }
};
fs.realpathSync.native = fs.realpathSync;

if (fs.promises && fs.promises.realpath) {
  const originalRealpath = fs.promises.realpath;
  fs.promises.realpath = async function(p, options) {
    try {
      return await originalRealpath(p, options);
    } catch (e) {
      if (e.code === 'EPERM') {
        return path.resolve(p);
      }
      throw e;
    }
  };
}

const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Read the Vercel token from command line or environment
const token = process.env.VERCEL_TOKEN || process.argv[2];
if (!token) {
  console.error('Error: Please provide a Vercel token as an environment variable (VERCEL_TOKEN) or as the first argument.');
  process.exit(1);
}

const projectRoot = 'd:/Brinda/Saishnaa/saiahnaa website';

// Read .vercel/project.json
let projectInfo;
try {
  const projectJson = fs.readFileSync(path.join(projectRoot, '.vercel/project.json'), 'utf8');
  projectInfo = JSON.parse(projectJson);
} catch (e) {
  console.error('Error reading .vercel/project.json:', e.message);
  process.exit(1);
}

const { projectId, orgId, projectName } = projectInfo;
console.log(`Deploying project "${projectName}" (${projectId}) to org "${orgId}"...`);

// Helper to recursively list files
function getFiles(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    
    // Ignore patterns
    if (
      entry.name === '.git' ||
      entry.name === 'node_modules' ||
      entry.name === 'node-portable' ||
      entry.name === '.vercel' ||
      entry.name === '.vscode' ||
      entry.name.startsWith('.env') ||
      entry.name.endsWith('.log') ||
      entry.name === 'run-bat-out.txt' ||
      entry.name === 'server-error.txt' ||
      entry.name === 'server-out.txt' ||
      entry.name === 'stderr_ver.log' ||
      entry.name === 'stdout_ver.log' ||
      entry.name === 'deploy.js'
    ) {
      continue;
    }
    
    if (entry.isDirectory()) {
      results = results.concat(getFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push({
        file: relPath,
        content: fs.readFileSync(fullPath)
      });
    }
  }
  return results;
}

console.log('Reading project files...');
const allFiles = getFiles(projectRoot);
console.log(`Found ${allFiles.length} files to deploy.`);

// Map to Vercel API payload format
const filesPayload = allFiles.map(f => ({
  file: f.file,
  data: f.content.toString('base64'),
  encoding: 'base64'
}));

// Read vercel.json if exists
let vercelConfig = {};
try {
  const configContent = fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8');
  vercelConfig = JSON.parse(configContent);
} catch (e) {
  console.log('No vercel.json found or failed to parse. Proceeding without specific configuration.');
}

const payload = JSON.stringify({
  name: projectName,
  cleanUrls: vercelConfig.cleanUrls,
  rewrites: vercelConfig.rewrites,
  redirects: vercelConfig.redirects,
  headers: vercelConfig.headers,
  files: filesPayload,
  projectSettings: {
    framework: null
  }
});

console.log('Uploading and deploying to Vercel (this may take a moment due to image sizes)...');

// Configure Proxy Agent
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
let agent;
if (proxyUrl) {
  console.log(`Using proxy: ${proxyUrl}`);
  agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });
} else {
  console.log('No proxy environment variable detected. Running direct connection.');
}

const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: `/v13/deployments?teamId=${orgId}`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

if (agent) {
  options.agent = agent;
}

const req = https.request(options, (res) => {
  console.log(`Received response: status code ${res.statusCode}`);
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const responseJson = JSON.parse(responseData);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('SUCCESS: Deployment successful!');
        console.log('URL: https://' + responseJson.url);
        console.log('Inspector URL: https://' + responseJson.inspectorUrl);
        process.exit(0);
      } else {
        console.error(`ERROR: Deployment failed with status ${res.statusCode}:`, responseJson.error ? responseJson.error.message : responseJson);
        process.exit(1);
      }
    } catch (e) {
      console.error('Failed to parse response JSON:', e.message);
      console.log('Response body was:', responseData);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.setTimeout(60000, () => {
  console.error('Request timed out after 60 seconds.');
  req.destroy();
  process.exit(1);
});

console.log('Sending request data...');
req.write(payload);
req.end();
console.log('Request payload sent, waiting for response...');
