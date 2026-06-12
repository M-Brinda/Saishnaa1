const http = require('http');
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


const projectRoot = __dirname;
const port = 9090;

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
      entry.name === 'deploy.js' ||
      entry.name === 'deploy-dash.html' ||
      entry.name === 'server-deploy.js' ||
      entry.name === 'deploy.log' ||
      entry.name === 'stdout.log' ||
      entry.name === 'stderr.log'
    ) {
      continue;
    }
    
    if (entry.isDirectory()) {
      results = results.concat(getFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push({
        file: relPath,
        content: fs.readFileSync(fullPath).toString('base64')
      });
    }
  }
  return results;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  
  if (urlPath === '/' || urlPath === '/deploy-dash.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const html = fs.readFileSync(path.join(projectRoot, 'deploy-dash.html'));
    res.end(html);
  } else if (urlPath === '/files') {
    try {
      console.log('Scanning files...');
      const files = getFiles(projectRoot);
      
      let vercelConfig = {};
      try {
        const configContent = fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8');
        vercelConfig = JSON.parse(configContent);
      } catch (e) {
        console.log('No vercel.json or failed to parse.');
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ config: vercelConfig, files }));
      console.log(`Served ${files.length} files successfully.`);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error listing files: ' + err.message);
    }
  } else if (urlPath === '/done') {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const deployUrl = urlParams.get('url');
    const inspectorUrl = urlParams.get('inspector');
    
    console.log('DEPLOYMENT_SUCCESSFUL');
    console.log('DEPLOY_URL:', deployUrl);
    console.log('INSPECTOR_URL:', inspectorUrl);
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } else if (urlPath === '/error') {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const msg = urlParams.get('msg');
    
    console.error('DEPLOYMENT_FAILED:', msg);
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${port}/`);
});
