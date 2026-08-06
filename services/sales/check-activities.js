require('dotenv').config();
const mongoose = require('mongoose');
const Activity = require('./src/modules/activities/activity.model');
const { companyMiddleware } = require('./src/common/tenantMiddleware');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to', process.env.MONGO_URI.split('@')[1]);
    
    // Simulate req/res
    const req = {
      header: (name) => name === 'Company-Code' ? 'STP-1603-2026' : undefined,
      user: { companyCode: 'STP-1603-2026' }
    };
    
    // Manually run middleware logic or just connect directly
    // Since tenant db is salesdb_stp_1603_2026
    const tenantDb = mongoose.connection.useDb('salesdb_stp_1603_2026');
    const LeadSchema = require('./models/Lead').schema;
    const ClientSchema = require('./models/Client').schema;
    const LeadModel = tenantDb.model('Lead', LeadSchema);
    const ClientModel = tenantDb.model('Client', ClientSchema);
    
    let activities = await Activity.find({ employeeId: '69b786de63515d37e3da7de1' }).lean();
    console.log('Activities raw:', activities);
    
    const leadIds = activities.map(a => a.leadId).filter(Boolean);
    console.log('leadIds to query:', leadIds);
    
    const leads = await LeadModel.find({ _id: { $in: leadIds } });
    const clients = await ClientModel.find({ _id: { $in: leadIds } });
    
    console.log('Found leads:', leads.length, 'Found clients:', clients.length);
    
    const entityMap = {};
    leads.forEach(l => {
      entityMap[l._id.toString()] = {
        companyName: l.leadCompanyName,
        contactName: l.contactName,
        companyCode: l.companyCode
      };
    });
    console.log("entityMap:", entityMap);

    activities = activities.map(a => {
      if (a.leadId && entityMap[a.leadId]) {
        const ent = entityMap[a.leadId];
        a.companyName = ent.companyName || 'No Name';
        a.contactName = ent.contactName || '';
      } else {
        console.log("No entityMap entry for a.leadId:", a.leadId, "type of a.leadId:", typeof a.leadId);
      }
      return a;
    });
    console.log('Mapped activities:', activities);
    
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
check();
