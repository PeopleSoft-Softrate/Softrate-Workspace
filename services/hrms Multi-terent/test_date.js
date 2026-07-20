const drive = {
  endDate: new Date('2026-07-19T00:00:00.000Z'),
  endTime: '17:30'
};

const dateStr = drive.endDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
const timeStr = drive.endTime;
const endDateTime = new Date(`${dateStr}T${timeStr}:00`);

const now = new Date();

console.log('dateStr:', dateStr);
console.log('timeStr:', timeStr);
console.log('endDateTime:', endDateTime);
console.log('now:', now);
console.log('endDateTime > now:', endDateTime > now);
