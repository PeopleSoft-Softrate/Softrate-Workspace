const http = require('http');

const data = JSON.stringify({
  companyCode: 'SOFTRATE',
  identifier: 'test@peoplesoft',
  password: '123456',
  deviceId: 'test_device_123'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/auth/unified-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
