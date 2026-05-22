import 'dart:convert';

import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:hrmappfrontend/manager/managerrecrument.dart';
import 'package:hrmappfrontend/manager/managerattendance.dart';
import 'package:hrmappfrontend/manager/managerleave.dart';
import 'package:hrmappfrontend/manager/managershift.dart';
import 'package:hrmappfrontend/manager/managerpayroll.dart';
import 'package:hrmappfrontend/manager/managerappraisal.dart';
import 'package:hrmappfrontend/manager/managerdocuments.dart';
import 'package:hrmappfrontend/manager/managerteam.dart';
import 'package:hrmappfrontend/manager/managerprojects.dart';
import 'package:hrmappfrontend/manager/managerholiday.dart';
import 'package:hrmappfrontend/manager/manageroffboarding.dart';
import 'package:hrmappfrontend/network_aware_mixin.dart';
import 'package:hrmappfrontend/hr_pages/hrdash_board.dart';
import 'package:hrmappfrontend/Employee/EmployeeDashboard.dart';
import 'package:hrmappfrontend/fund_requests/fund_request_approval_page.dart';

class ManagerDashboard extends StatefulWidget {
  const ManagerDashboard({super.key});

  @override
  State<ManagerDashboard> createState() => _ManagerDashboardState();
}

class _ManagerDashboardState extends State<ManagerDashboard>
    with NetworkAwareMixin<ManagerDashboard> {
  String? managerEmail;
  bool _isLoading = true;

  // Real-time Stats
  int totalTeam = 0;
  String attendance = "00/00";
  int presentToday = 0;
  int lateToday = 0;
  int absentToday = 0;
  List<dynamic> _teamRecords = [];
  int projects = 3;
  int recruitment = 3;
  int leaveCount = 0;
  List<dynamic> _leaveRecords = [];
  int fundRequestCount = 0;

  // Lighter & Professional Color Palette
  static const Color primaryColor = Color(
    0xFF1E293B,
  ); // Slate 800 (Professional Text)
  static const Color accentColor = Color(0xFF3B82F6); // Bright Blue (Action)
  static const Color backgroundColor = Color(0xFFF8F7F4); // Subtle Warm White
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0); // Slate 200 (Subtle)
  static const Color subtitleColor = Color(0xFF64748B); // Slate 500

  // Light Shades for Status Badges
  static const Color successLight = Color(0xFFF0FDF4); // Green 50
  static const Color warningLight = Color(0xFFFFFBEB); // Amber 50
  static const Color infoLight = Color(0xFFEFF6FF); // Blue 50
  static const Color dangerLight = Color(0xFFFEF2F2); // Red 50
  static const Color neutralLight = Color(0xFFF8F7F4); // Subtle Warm

  @override
  void initState() {
    super.initState();
    _checkInitialRole();
    _loadManagerData();
  }

  Future<void> _checkInitialRole() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool('hr_logged_in') == true) {
      debugPrint("ManagerDashboard: HR role detected in prefs, redirecting...");
      _handleHrPromotion();
    }
  }

  String? managerName;
  String? managerId;
  String? managerDept;
  String? managerMongoId;

  Future<void> _loadManagerData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      managerEmail = prefs.getString("manager_email");
      managerName = prefs.getString("manager_name");
      managerId = prefs.getString("manager_id");
      managerDept = prefs.getString("manager_dept");
      managerMongoId = prefs.getString("manager_mongo_id");
    });
    // Now that we have managerMongoId, fetch stats
    _fetchDashboardStats();
  }

  Future<void> _fetchDashboardStats() async {
    if (managerMongoId == null) return;

    try {
      // 1. Fetch Recruitment (Pending) Count
      final recruitmentRes = await http.get(
        Uri.parse("${getBaseUrl()}/api/intern/assigned-to/$managerMongoId"),
      );

      // 2. Fetch Team (Active) Count
      final teamRes = await http.get(
        Uri.parse("${getBaseUrl()}/api/assignments/team/$managerMongoId"),
      );

      if (recruitmentRes.statusCode == 200) {
        final List<dynamic> data = jsonDecode(recruitmentRes.body);
        final pendingCount =
            data
                .where(
                  (intern) =>
                      intern['managerApprovalStatus'] == null ||
                      intern['managerApprovalStatus'] == 'pending',
                )
                .length;

        setState(() {
          recruitment = pendingCount;
        });
      }

      if (teamRes.statusCode == 200) {
        final data = jsonDecode(teamRes.body);
        final List<dynamic> interns = data['interns'] ?? [];
        final List<dynamic> employees = data['employees'] ?? [];
        final int total = interns.length + employees.length;

        // 3. Fetch Team Attendance
        final attendanceRes = await http.get(
          Uri.parse(
            "${getBaseUrl()}/api/assignments/team-attendance/$managerMongoId",
          ),
        );

        int presentCount = 0;
        int lateCount = 0;
        List<dynamic> records = [];
        if (attendanceRes.statusCode == 200) {
          final attendanceData = jsonDecode(attendanceRes.body);
          records = attendanceData['teamAttendance'] ?? [];

          for (var record in records) {
            if (record['punchIn'] != null) {
              presentCount++;
              // Check if late (after 09:30 AM)
              try {
                final dt = DateTime.parse(record['punchIn']).toLocal();
                if (dt.hour > 9 || (dt.hour == 9 && dt.minute > 30)) {
                  lateCount++;
                }
              } catch (e) {}
            }
          }
        }

        setState(() {
          totalTeam = total;
          attendance =
              "${presentCount.toString().padLeft(2, '0')}/${total.toString().padLeft(2, '0')}";
          presentToday = presentCount;
          lateToday = lateCount;
          absentToday = total - presentCount;
          _teamRecords = records;
        });
      }

      // 3. Fetch Leave (Manager Pending) Count
      final leaveRes = await http.get(
        Uri.parse(
          "${getBaseUrl()}/api/employee-leave/manager-pending/$managerMongoId",
        ),
      );

      if (leaveRes.statusCode == 200) {
        final List<dynamic> leaveData = jsonDecode(leaveRes.body);
        setState(() {
          leaveCount = leaveData.length;
          _leaveRecords = leaveData;
        });
      }

      final fundRes = await http.get(
        Uri.parse(
          "${getBaseUrl()}/api/fund-requests/manager-pending/$managerMongoId",
        ),
      );

      if (fundRes.statusCode == 200) {
        final List<dynamic> fundData = jsonDecode(fundRes.body);
        setState(() {
          fundRequestCount = fundData.length;
        });
      }

      setState(() => _isLoading = false);

      // 🔥 Check for role changes (Promotion/Demotion)
      await _checkRoleChange();
    } catch (e) {
      print("Error fetching dashboard stats: $e");
      setState(() => _isLoading = false);
    }
  }

  Future<void> _checkRoleChange() async {
    if (managerMongoId == null) return;
    try {
      final res = await http.get(
        Uri.parse("${getBaseUrl()}/api/employee/get/$managerMongoId"),
      );
      if (res.statusCode == 200) {
        final fullData = jsonDecode(res.body);
        final data = fullData['employee'] ?? fullData['user'] ?? fullData;
        final String role =
            (data['role']?.toString() ?? '').toLowerCase().trim();
        debugPrint("Role change check: Current backend role is '$role'");

        // 1. Check for HR Promotion
        if (role == 'hr' || role == 'hr_admin') {
          await _handleHrPromotion();
          return;
        }

        // 2. Check for Demotion to Employee
        final isManager =
            (data['isManager'] == true ||
                data['isManager']?.toString() == 'true' ||
                data['role']?.toString().toLowerCase() == 'manager');

        if (!isManager) {
          _handleManagerDemotion();
        }
      }
    } catch (e) {
      debugPrint("Role check error: $e");
    }
  }

  Future<void> _handleManagerDemotion() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('manager_logged_in', false);
    await prefs.setBool('employeeLoggedIn', true);
    await prefs.setString('employeeId', managerId ?? '');

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => Employeedashboard(employeeId: managerId ?? ''),
        ),
      );
    }
  }

  Future<void> _handleHrPromotion() async {
    final prefs = await SharedPreferences.getInstance();

    // 1. Set HR permissions
    await prefs.setBool('hr_logged_in', true);
    await prefs.setString('hr_id', managerId ?? 'hr_default');
    final String? mName = prefs.getString('manager_name');
    await prefs.setString('hr_name', mName ?? 'HR Manager');

    // 2. Clear Manager permissions
    await prefs.setBool('manager_logged_in', false);
    await prefs.setBool('employeeLoggedIn', false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Account promoted to HR. Redirecting..."),
          backgroundColor: Colors.green,
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HrdashBoard()),
      );
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("manager_logged_in");
    await prefs.remove("manager_email");
    await prefs.remove("manager_name");
    await prefs.remove("manager_id");
    await prefs.remove("manager_mongo_id");
    await prefs.remove("manager_dept");

    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const homescreen()),
        (route) => false,
      );
    }
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: const Text(
              "Confirm Logout",
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            content: const Text(
              "Are you sure you want to log out from the Manager Portal?",
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(
                  "Cancel",
                  style: TextStyle(color: subtitleColor),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  _logout();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF4444),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text("Logout"),
              ),
            ],
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: neutralLight,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: const Color(0xFF00657F),
          centerTitle: false,
          automaticallyImplyLeading: false,
          title: const Text(
            "Manager Portal",
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: Colors.white,
              fontSize: 22,
            ),
          ),
          actions: [
            IconButton(
              onPressed: _showLogoutDialog,
              icon: const Icon(
                Icons.logout_outlined,
                color: Colors.white70,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
          ],
        ),
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(color: neutralLight),
          child: RefreshIndicator(
            onRefresh: _fetchDashboardStats,
            color: const Color(0xFF00657F),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  buildNetworkStatusBanner(),
                  const SizedBox(height: 8),
                  // Simple Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Welcome Back,",
                            style: TextStyle(
                              fontSize: 15,
                              color: const Color.fromARGB(
                                255,
                                100,
                                116,
                                139,
                              ).withOpacity(0.9),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            managerName ?? "Manager",
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: primaryColor,
                              letterSpacing: -0.4,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            DateFormat("E, d MMMM yyyy").format(DateTime.now()),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: const Color.fromARGB(255, 100, 116, 139),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  if (_isLoading) ...[
                    _buildShimmerStats(),
                    const SizedBox(height: 24),
                    _buildShimmerOverview(),
                  ] else ...[
                    // Minimal Stats
                    Row(
                      children: [
                        _buildSimpleStat(
                          "Total Team Members",
                          totalTeam.toString().padLeft(2, '0'),
                          Icons.people_rounded,
                          const Color(0xFF818CF8), // Soft Indigo
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerTeamPage()),
                            );
                          },
                        ),
                        const SizedBox(width: 12),
                        _buildSimpleStat(
                          "Attendance",
                          attendance,
                          Icons.how_to_reg_rounded,
                          const Color(0xFFFBBF24), // Soft Amber
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerAttendancePage()),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildSimpleStat(
                          "Projects",
                          projects.toString().padLeft(2, '0'),
                          Icons.dashboard_rounded,
                          const Color(0xFF34D399), // Soft Emerald
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerProjectsPage()),
                            );
                          },
                        ),
                        const SizedBox(width: 12),
                        _buildSimpleStat(
                          "Recruitment",
                          recruitment.toString().padLeft(2, '0'),
                          Icons.person_search_rounded,
                          const Color(0xFFA78BFA), // Soft Violet
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerRecruitmentPage()),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildSimpleStat(
                          "Leaves",
                          leaveCount.toString().padLeft(2, '0'),
                          Icons.event_note_rounded,
                          const Color(0xFFF87171), // Soft Red
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerLeavePage()),
                            );
                          },
                        ),
                        const SizedBox(width: 12),
                        _buildSimpleStat(
                          "Shifts",
                          "Active",
                          Icons.schedule_rounded,
                          const Color(0xFF60A5FA), // Soft Blue
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerShiftPage()),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildSimpleStat(
                          "Payroll",
                          "My Salary",
                          Icons.account_balance_rounded,
                          const Color(0xFF4ADE80), // Soft Green
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerPayrollPage()),
                            );
                          },
                        ),
                        const SizedBox(width: 12),
                        _buildSimpleStat(
                          "Appraisal",
                          "Reviews",
                          Icons.reviews_rounded,
                          const Color(0xFFC084FC), // Soft Purple
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerAppraisalPage()),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildSimpleStat(
                          "Details",
                          "Team Mates",
                          Icons.person_rounded,
                          const Color(0xFFFB923C), // Soft Orange
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerDocumentsPage()),
                            );
                          },
                        ),
                        const SizedBox(width: 12),
                        _buildSimpleStat(
                          "Holiday",
                          "Calendar",
                          Icons.event_available_rounded,
                          const Color(0xFF2DD4BF), // Soft Teal
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerHolidayCalendarPage()),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildSimpleStat(
                          "Offboarding",
                          "Team Exits",
                          Icons.person_off_rounded,
                          const Color(0xFFF43F5E), // Rose / Red
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerOffboardingPage()),
                            );
                          },
                        ),
                        const SizedBox(width: 12),
                        _buildSimpleStat(
                          "Fund Requests",
                          fundRequestCount.toString().padLeft(2, '0'),
                          Icons.receipt_long_rounded,
                          const Color(0xFF7C3AED),
                          onTap: () {
                            Navigator.push(
                              context,
                              _createRoute(
                                const FundRequestApprovalPage(
                                  role: FundApprovalRole.manager,
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "Team Overview",
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: primaryColor,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              _createRoute(const ManagerTeamPage()),
                            );
                          },
                          child: const Text(
                            "View All",
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: accentColor,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 8),

                    // Clean Tabbed View
                    DefaultTabController(
                      length: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TabBar(
                            isScrollable: true,
                            tabAlignment: TabAlignment.start,
                            labelColor: accentColor,
                            unselectedLabelColor: subtitleColor,
                            indicatorColor: accentColor,
                            indicatorSize: TabBarIndicatorSize.label,
                            indicatorWeight: 3,
                            labelPadding: const EdgeInsets.only(right: 24),
                            labelStyle: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5,
                              letterSpacing: 0.3,
                            ),
                            unselectedLabelStyle: const TextStyle(
                              fontWeight: FontWeight.w500,
                              fontSize: 13.5,
                            ),
                            dividerColor: Colors.transparent,
                            tabs: const [
                              Tab(text: "LIVE STATUS"),
                              Tab(text: "ATTENDANCE"),
                              Tab(text: "LEAVES"),
                            ],
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            height: 320,
                            child: TabBarView(
                              physics: const BouncingScrollPhysics(),
                              children: [
                                _buildSimpleMembersList(),
                                _buildSimpleAttendanceSummary(),
                                _buildSimpleLeaveList(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSimpleStat(
    String title,
    String value,
    IconData icon,
    Color iconColor, {
    VoidCallback? onTap,
  }) {
    return Expanded(
      child: _ScaleCard(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor.withOpacity(0.8)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.07),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 1,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.07),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: primaryColor,
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 10,
                        color: subtitleColor,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSimpleMembersList() {
    if (_teamRecords.isEmpty) {
      return const Center(
        child: Text(
          "No member records available.",
          style: TextStyle(color: subtitleColor),
        ),
      );
    }

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      itemCount: _teamRecords.length > 5 ? 5 : _teamRecords.length,
      itemBuilder: (context, index) {
        final member = _teamRecords[index];
        String status = "Absent";
        if (member['punchIn'] != null) {
          status = "Present";
          try {
            final dt = DateTime.parse(member['punchIn']).toLocal();
            if (dt.hour > 9 || (dt.hour == 9 && dt.minute > 30)) {
              status = "Late";
            }
          } catch (e) {}
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor.withOpacity(0.8)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    member["name"]![0],
                    style: const TextStyle(
                      color: accentColor,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      member["name"]!,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontSize: 14.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      member["type"] ?? "Team Member",
                      style: const TextStyle(
                        color: subtitleColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              _buildSimpleBadge(status),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSimpleBadge(String status) {
    Color color;
    Color bg;
    if (status == "Active" || status == "Online" || status == "Approved") {
      color = const Color(0xFF16A34A);
      bg = successLight;
    } else if (status == "Pending") {
      color = const Color(0xFFD97706);
      bg = warningLight;
    } else if (status == "Finished" || status == "Completed") {
      color = accentColor;
      bg = infoLight;
    } else {
      color = subtitleColor;
      bg = neutralLight;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildSimpleAttendanceSummary() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor.withOpacity(0.8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.07),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 1,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          const Row(
            children: [
              Icon(
                Icons.calendar_today_rounded,
                size: 16,
                color: subtitleColor,
              ),
              SizedBox(width: 8),
              Text(
                "Today's Overview",
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildAttendanceCircle(
                presentToday.toString().padLeft(2, '0'),
                "Present",
                const Color(0xFF10B981),
              ),
              _buildAttendanceCircle(
                lateToday.toString().padLeft(2, '0'),
                "Late",
                const Color(0xFFF59E0B),
              ),
              _buildAttendanceCircle(
                absentToday.toString().padLeft(2, '0'),
                "Absent",
                const Color(0xFFEF4444),
              ),
            ],
          ),
          const Spacer(),
          Text(
            "Data updated at ${DateTime.now().hour}:${DateTime.now().minute}",
            style: const TextStyle(color: Colors.grey, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceCircle(String value, String label, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: primaryColor,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w600,
            fontSize: 11.5,
          ),
        ),
      ],
    );
  }

  Widget _buildSimpleLeaveList() {
    if (_leaveRecords.isEmpty) {
      return const Center(
        child: Text(
          "No pending leave requests.",
          style: TextStyle(color: subtitleColor),
        ),
      );
    }

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      itemCount: _leaveRecords.length > 5 ? 5 : _leaveRecords.length,
      itemBuilder: (context, index) {
        final leave = _leaveRecords[index];
        final String name = leave["employeeName"] ?? "Unknown";
        final String type = leave["leaveType"] ?? "General Leave";
        final String status = leave["managerStatus"] ?? "Pending";

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor.withOpacity(0.8)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    name.isNotEmpty ? name[0] : "?",
                    style: const TextStyle(
                      color: primaryColor,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14.5,
                        color: primaryColor,
                      ),
                    ),
                    Text(
                      type,
                      style: const TextStyle(
                        color: subtitleColor,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              _buildSimpleBadge(status),
            ],
          ),
        );
      },
    );
  }

  Widget _buildShimmerStats() {
    return Column(
      children: List.generate(
        4,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Expanded(child: _ShimmerBox(height: 70, radius: 16)),
              const SizedBox(width: 12),
              Expanded(child: _ShimmerBox(height: 70, radius: 16)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShimmerOverview() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ShimmerBox(height: 20, width: 120, radius: 4),
        const SizedBox(height: 20),
        _ShimmerBox(height: 300, radius: 16),
      ],
    );
  }

  Route _createRoute(Widget page) {
    return PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        const begin = Offset(1.0, 0.0);
        const end = Offset.zero;
        const curve = Curves.easeOutQuart;

        var slideTween = Tween(
          begin: begin,
          end: end,
        ).chain(CurveTween(curve: curve));
        var fadeTween = Tween<double>(begin: 0.0, end: 1.0);

        return FadeTransition(
          opacity: animation.drive(fadeTween),
          child: SlideTransition(
            position: animation.drive(slideTween),
            child: child,
          ),
        );
      },
      transitionDuration: const Duration(milliseconds: 500),
    );
  }
}

class _ScaleCard extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;

  const _ScaleCard({required this.child, this.onTap});

  @override
  State<_ScaleCard> createState() => _ScaleCardState();
}

class _ScaleCardState extends State<_ScaleCard> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _isPressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

class _ShimmerBox extends StatefulWidget {
  final double height;
  final double? width;
  final double radius;

  const _ShimmerBox({required this.height, this.width, this.radius = 8});

  @override
  State<_ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<_ShimmerBox>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          height: widget.height,
          width: widget.width,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Colors.grey[300]!, Colors.grey[100]!, Colors.grey[300]!],
              stops: [0.0, _controller.value, 1.0],
            ),
          ),
        );
      },
    );
  }
}
