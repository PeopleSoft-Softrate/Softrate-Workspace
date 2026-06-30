const { getTenantConnection, waitForConnection } = require('../db');
const InternExport = require('../models/Intern');
const EmployeeExport = require('../models/EmployeeModel');
const AttendanceExport = require('../models/attendancemodel');
const EmployeeAttendanceExport = require('../models/Employeeattendancemodel');
const ProjectExport = require('../models/Project');

async function seedDemoData(companyId) {
    if (!companyId) return;
    try {
        const dbName = companyId.toString();
        const db = getTenantConnection(dbName);
        await waitForConnection(db);

        // Bind models
        const Intern = db.models.Intern || db.model('Intern', InternExport.schema);
        const Employee = db.models.Employee || db.model('Employee', EmployeeExport.schema);
        const Attendance = db.models.Attendance || db.model('Attendance', AttendanceExport.schema);
        const EmployeeAttendance = db.models.EmployeeAttendance || db.model('EmployeeAttendance', EmployeeAttendanceExport.schema);
        const Project = db.models.Project || db.model('Project', ProjectExport.schema);

        // Check if data already exists to avoid duplicate seeding
        const existingEmployees = await Employee.countDocuments();
        if (existingEmployees > 0) return; // Already seeded or used

        // 1. Create Interns
        const intern1 = new Intern({
            name: "Alex Johnson (Demo)",
            email: "alex.demo@example.com",
            phone: "555-0101",
            department: "Engineering",
            role: "Software Intern",
            status: "active",
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        });
        await intern1.save();

        const intern2 = new Intern({
            name: "Sam Taylor (Demo)",
            email: "sam.demo@example.com",
            phone: "555-0102",
            department: "Design",
            role: "UX Intern",
            status: "active",
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        });
        await intern2.save();

        // 2. Create Employees
        const emp1 = new Employee({
            name: "Sarah Miller (Demo)",
            email: "sarah.demo@example.com",
            phone: "555-0201",
            department: "HR",
            role: "HR Manager",
            status: "active",
            joinDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        });
        await emp1.save();

        const emp2 = new Employee({
            name: "David Chen (Demo)",
            email: "david.demo@example.com",
            phone: "555-0202",
            department: "Engineering",
            role: "Senior Developer",
            status: "active",
            joinDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        });
        await emp2.save();

        // 3. Create Attendance (Present today, punch in 9:00 AM, out 5:30 PM)
        const punchIn = new Date();
        punchIn.setHours(9, 0, 0, 0);
        const punchOut = new Date();
        punchOut.setHours(17, 30, 0, 0);

        await new Attendance({ internId: intern1._id, date: new Date(), punchInTime: punchIn, punchOutTime: punchOut, status: "Present" }).save();
        await new Attendance({ internId: intern2._id, date: new Date(), punchInTime: punchIn, punchOutTime: punchOut, status: "Present" }).save();
        
        await new EmployeeAttendance({ employeeId: emp1._id, date: new Date(), punchInTime: punchIn, punchOutTime: punchOut, status: "Present" }).save();
        await new EmployeeAttendance({ employeeId: emp2._id, date: new Date(), punchInTime: punchIn, punchOutTime: punchOut, status: "Present" }).save();

        // 4. Create an active Project
        const project = new Project({
            projectName: "Q3 Website Redesign",
            description: "Overhaul the corporate site with the new branding guidelines.",
            assignedTo: [emp2._id, intern1._id, intern2._id],
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "in progress",
            checklist: [
                { task: "Design Mockups", isCompleted: true },
                { task: "Frontend Implementation", isCompleted: true },
                { task: "Backend Integration", isCompleted: false },
                { task: "User Testing", isCompleted: false }
            ]
        });
        await project.save();

        console.log(`Demo data seeded successfully for tenant: ${dbName}`);
    } catch (err) {
        console.error("Error seeding demo data:", err);
    }
}

module.exports = { seedDemoData };
