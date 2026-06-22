const axios = require('axios');
async function test() {
  try {
    // login to get token
    const loginRes = await axios.post('http://localhost:5001/api/auth/unified-login', {
      companyCode: 'SOFTRATE',
      identifier: '262004',
      password: 'test'
    });
    const token = loginRes.data.token;
    
    // fetch balance
    const balRes = await axios.get('http://localhost:5001/api/employee-leave/balance/262004', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Balance result:', balRes.data);
  } catch(err) {
    console.error('Error:', err.response?.data || err.message);
  }
}
test();
