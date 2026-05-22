# Softrate HRM Frontend Application

This is the Flutter frontend codebase for the **Softrate HRM (Human Resource Management) Application**. It features a modern, adaptive, and premium user experience designed for employees and interns alike, unified under a single login page.

---

## 🔑 Google Play Store / App Store Review Credentials

For store approval and submission reviews, the application includes a **fully offline mock bypass** that ensures instant login and complete profile loading even if database endpoints are sleeping or down.

### 1. Intern Review Account
* **Email / ID:** `testintern@softrate.com`
* **Password:** `Test@1234`
* **Bypasses:** All live network requests. Logs directly into the Intern Dashboard (`AttendancePage`) with mock profile data for *Alex Rivera*.

### 2. Employee Review Account
* **Email / ID:** `testemployee@softrate.com`
* **Password:** `Test@1234`
* **Bypasses:** All live location check-ins and server synchronization. Logs directly into the Employee Dashboard (`Employeedashboard`) with mock profile data for *Jane Doe*.

---

## 🛠️ Features Implemented

* **Unified Login Screen (`UnifiedLoginPage`)**: Resolves role-based access for Employees, Interns, Managers, and HR admins.
* **Smart Redirection**: After onboarding document submission, the system automatically redirects users to their dynamic dashboards instead of resetting to the homescreen.
* **Auto-Increment ID System**: Consistent identification formatting across all corporate dashboards.
* **Premium Glassmorphic Design**: Sleek gradients and adaptive layouts built using standard design system standards.
