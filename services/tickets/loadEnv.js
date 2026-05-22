const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
].filter((candidate) => fs.existsSync(candidate));

if (envPaths.length === 0) {
  dotenv.config();
} else {
  envPaths.forEach((envPath) => {
    dotenv.config({ path: envPath });
  });
}

module.exports = { envPaths, rootEnvPath: envPaths[0] };
