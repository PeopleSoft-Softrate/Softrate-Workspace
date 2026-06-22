const axios = require('axios');
async function test() {
  try {
    const login = await axios.post('http://localhost:5001/api/auth/unified-login', {
      companyCode: 'SOFTRATE',
      identifier: '251001',
      password: 'Softrate@2024'
    });
    const token = login.data.token;
    console.log('Login success');
    
    const res = await axios.get('http://localhost:5001/api/employee-leave/balance/251001', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Balance response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('Error:', err.response?.data || err.message);
  }
}
test();
