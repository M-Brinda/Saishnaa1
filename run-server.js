const fs = require('fs');
const path = require('path');

const logFile = 'd:/Brinda/Saishnaa/saiahnaa website/deploy.log';
fs.writeFileSync(logFile, ''); // clear log

function log(msg) {
  fs.appendFileSync(logFile, msg + '\n');
}

log('run-server.js started');

try {
  // Monkey patch fs.realpathSync
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

  log('Monkey patches applied, loading server-deploy.js...');
  
  // Require server-deploy.js
  require('./server-deploy.js');
  
  log('server-deploy.js loaded successfully.');
} catch (err) {
  log('FATAL ERROR: ' + err.stack);
  process.exit(1);
}
