const mongoose = require('mongoose');
require('dotenv').config();
const { faker } = require('@faker-js/faker');
const { getMasterConnection, getTenantConnection } = require('../db');
const { getModelsForConnection } = require('../utilities/modelLoader');
const CompanyModelExport = require('../models/CompanyModel');

const DEMO_COMPANY_CODE = 'demo';
const DEMO_DB_NAME = 'demo_db';

async function seedDemo() {
  try {
    const masterDb = getMasterConnection();
    const MasterCompany = masterDb.models.Company || masterDb.model('Company', CompanyModelExport.schema);

    // 1. Ensure Demo Company exists in Master
    let demoCompany = await MasterCompany.findOne({ companyCode: DEMO_COMPANY_CODE });
    if (!demoCompany) {
      demoCompany = new MasterCompany({
        name: 'Acme Demo Corp',
        companyCode: DEMO_COMPANY_CODE,
        dbName: DEMO_DB_NAME,
        status: 'Active',
        createdAt: new Date()
      });
      await demoCompany.save();
      console.log('Created Demo Company in Master DB:', demoCompany._id);
    } else {
      console.log('Demo Company already exists:', demoCompany._id);
    }

    // 2. Connect to Demo Tenant DB
    const demoDb = getTenantConnection(DEMO_DB_NAME);
    const models = getModelsForConnection(demoDb);
    const { Employee, Department, Role, Intern, Project, EmployeeAttendance, Attendance, Leave } = models;

    // Clear existing
    await Employee.deleteMany({});
    await Department.deleteMany({});
    await Role.deleteMany({});
    await Intern?.deleteMany({});
    await Project?.deleteMany({});
    await EmployeeAttendance?.deleteMany({});
    await Attendance?.deleteMany({});
    await Leave?.deleteMany({});

    // 3. Create Departments
    const depts = [];
    for (const name of ['Engineering', 'Sales', 'Marketing', 'HR']) {
      const d = await Department.create({ name, status: 'Active', companyId: demoCompany._id });
      depts.push(d.name);
    }

    // 4. Create Roles
    const roles = [];
    for (const title of ['Software Engineer', 'Sales Rep', 'Marketing Manager', 'HR Generalist']) {
      const r = await Role.create({ name: title, status: 'Active', companyId: demoCompany._id });
      roles.push(r.name);
    }

    // 5. Generate Employees
    const employees = [];
    for (let i = 0; i < 20; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      
      employees.push({
        EmployeeId: `EMP-${1000 + i}`,
        fullName: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName, provider: 'acme.demo' }),
        phone: faker.phone.number(),
        designation: faker.helpers.arrayElement(roles),
        department: faker.helpers.arrayElement(depts),
        status: 'approved',
        role: faker.helpers.arrayElement(roles),
        dob: faker.date.birthdate({ min: 22, max: 60, mode: 'age' }),
        age: faker.number.int({ min: 22, max: 60 }),
        gender: faker.person.sex(),
        maritalStatus: faker.helpers.arrayElement(['Single', 'Married']),
        aboutMe: faker.lorem.paragraph(),
        askMeAboutExpertise: faker.helpers.arrayElement(['React', 'Node.js', 'Salesforce', 'SEO', 'Recruitment']),
        nickName: firstName,
        password: 'password123', // Doesn't matter, auth is mocked
        roleType: 'Employee',
        companyId: demoCompany._id,
        onboardingDate: faker.date.past({ years: 3 })
      });
    }

    await Employee.insertMany(employees);
    console.log(`Successfully seeded ${employees.length} demo employees in ${DEMO_DB_NAME}`);

    // 6. Generate Interns
    if (Intern) {
      const interns = [];
      for (let i = 0; i < 15; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        
        interns.push({
          internid: `INT-${1000 + i}`,
          fullName: `${firstName} ${lastName}`,
          email: faker.internet.email({ firstName, lastName, provider: 'acme.demo' }),
          contact: faker.phone.number(),
          role: faker.helpers.arrayElement(['UI/UX Intern', 'Frontend Intern', 'Backend Intern']),
          department: faker.helpers.arrayElement(depts),
          status: 'approved',
          college: 'Demo University',
          year: '2025',
          linkedin: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
          emergencyContact: faker.phone.number(),
          companyId: demoCompany._id,
          onboardingDate: faker.date.past({ years: 1 })
        });
      }
      await Intern.insertMany(interns);
      console.log(`Successfully seeded ${interns.length} demo interns.`);
    }

    // 7. Generate Projects
    if (Project) {
      const projects = [];
      for (let i = 0; i < 5; i++) {
        projects.push({
          name: `Project ${faker.commerce.productName()}`,
          status: 'Active',
          companyId: demoCompany._id,
        });
      }
      await Project.insertMany(projects);
      console.log(`Successfully seeded ${projects.length} demo projects.`);
    }

    // 8. Generate Today's Attendance
    const todayStr = new Date().toISOString().split('T')[0];
    if (EmployeeAttendance) {
      const empAtts = employees.map(emp => ({
        employeeId: emp.EmployeeId,
        date: todayStr,
        status: faker.helpers.arrayElement(['Present', 'Present', 'Absent', 'Half Day']),
        companyId: demoCompany._id,
        checkInTime: '09:00 AM'
      }));
      await EmployeeAttendance.insertMany(empAtts);
    }
    
    if (Attendance) {
      const interns = await Intern.find({ companyId: demoCompany._id });
      const intAtts = interns.map(int => ({
        internId: int.internid,
        date: todayStr,
        status: faker.helpers.arrayElement(['Present', 'Present', 'Absent', 'Half Day']),
        companyId: demoCompany._id,
        checkInTime: '09:30 AM'
      }));
      await Attendance.insertMany(intAtts);
    }
    
    console.log(`Successfully seeded attendance data.`);

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seedDemo();
