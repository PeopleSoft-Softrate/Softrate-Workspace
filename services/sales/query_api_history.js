const axios = require('axios');
axios.get('http://localhost:3000/api/history?companyCode=STP-1603-2026&companyName=SURYA%20SRI%20MANYAM%20PRODUCTS%20(OPC)%20PRIVATE%20LIMITED', {
  headers: { 'x-company-code': 'STP-1603-2026' } // auth may be required though... let's just use mongoose directly?
})
.then(res => console.log(res.data))
.catch(err => console.log(err.message));
