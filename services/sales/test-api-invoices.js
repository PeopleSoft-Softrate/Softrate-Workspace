const http = require('http');

http.get('http://localhost:3000/api/invoices?companyCode=WEE-0306-2026', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const invoices = json.items || json.invoices || [];
      console.log('API returned invoices:', invoices.length);
      if (invoices.length > 0) {
        console.log('First invoice publicToken:', invoices[0].publicToken);
        console.log('First invoice publicUrl:', invoices[0].publicUrl);
      }
    } catch (e) {
      console.log('Error parsing JSON', e);
    }
  });
});
