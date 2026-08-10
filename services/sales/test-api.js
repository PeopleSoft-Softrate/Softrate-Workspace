const axios = require('axios');
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/api/history?companyCode=STP-1603-2026&companyName=' + encodeURIComponent('SURYA SRI MANYAM PRODUCTS (OPC) PRIVATE LIMITED'));
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) { console.error(err.response ? err.response.data : err.message); }
}
run();
