require('dotenv').config({ path: 'services/sales/.env' });
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB');
    const db = mongoose.connection.db;
    
    // Check what collections exist
    const collections = await db.listCollections().toArray();
    const collNames = collections.map(c => c.name);
    console.log('Collections:', collNames);

    if (collNames.includes('proposals')) {
       await db.collection('proposals').deleteMany({});
       console.log('Deleted all proposals');
    } else {
       console.log('Proposals collection not found');
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
