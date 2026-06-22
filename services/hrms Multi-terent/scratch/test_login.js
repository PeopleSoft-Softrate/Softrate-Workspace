const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/auth/unified-login', {
      companyCode: 'SOFTRATE',
      identifier: '251001',
      password: 'Softrate@2024'
    });
    console.log('Login success! dbName:', res.data.user.dbName);
    console.log('Token:', res.data.token.substring(0, 50));
  } catch (err) {
    console.log('Login fail:', err.response?.data);
  }
}
test();
