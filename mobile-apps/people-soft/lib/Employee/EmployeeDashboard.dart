import 'dart:async' as java_timer;
import 'dart:convert';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/services.dart';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hrmappfrontend/Employee/EmployeeAttendanceDetails.dart';
import 'package:hrmappfrontend/Employee/Employee_policy.dart';
import 'package:hrmappfrontend/Employee/Employee_profile_page.dart';
import 'package:hrmappfrontend/Employee/Employee_progress.dart';
import 'package:hrmappfrontend/Employee/employee_leave_request.dart';
import 'package:hrmappfrontend/Employee/employeepayroll.dart';
import 'package:hrmappfrontend/fund_requests/fund_request_page.dart';
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:hrmappfrontend/hr_pages/hrdash_board.dart';
import 'package:hrmappfrontend/intern/intern_Organizational_Hierarchy.dart';
import 'package:hrmappfrontend/intern/HolidayCalendar.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/network_aware_mixin.dart';
import 'package:hrmappfrontend/intern/ProjectViewPage.dart';
import 'package:hrmappfrontend/employee_to_manager/manager_access_section.dart';
import 'package:hrmappfrontend/intern/userdashboard.dart';

class Employeedashboard extends StatefulWidget {
  final String employeeId;

  const Employeedashboard({super.key, required this.employeeId});

  @override
  State<Employeedashboard> createState() => _EmployeedashboardState();
}

class _EmployeedashboardState extends State<Employeedashboard>
    with NetworkAwareMixin<Employeedashboard> {
  String? punchInTime;
  String? punchOutTime;
  String? punchInLocation;
  String? punchOutLocation;
  String? _profileImagePath;
  bool isTodayHoliday = false;
  String? holidayReason;

  bool loading = false;
  bool punchLoading = false;

  Map<String, dynamic>? employeeData;
  Map<String, dynamic>? myResignation;
  bool resignationLoading = false;
  String? employeeId;
  DateTime _currentTime = DateTime.now();
  java_timer.Timer? _timer;
  bool _showHolidayBadge = false;
  String? _latestHolidayState;

  List<dynamic> _officeLocations = [];

  @override
  void initState() {
    super.initState();
    _checkInitialRole();
    _currentTime = DateTime.now();
    _timer = java_timer.Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _currentTime = DateTime.now();
        });
      }
    });
    _initializeAppData();
  }

  Future<void> _checkInitialRole() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool('hr_logged_in') == true) {
      debugPrint(
        "EmployeeDashboard: HR role detected in prefs, redirecting...",
      );
      _handleHrPromotion();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _initializeAppData() async {
    if (mounted) setState(() => loading = true);

    try {
      await _loadEmployeeId();
      await _loadProfileImage();

      if (employeeId != null) {
        await fetchEmployeeData(employeeId!);
        if (employeeId != 'test_employee_id') {
          await fetchOfficeLocations(); // 🔥 Fetch Dynamic Locations
          await checkTodayHoliday();

          // 🔥 Only continue if NOT terminated
          if (employeeData?['status'] != 'terminated') {
            await resetAttendanceIfNewDay();
            await loadTodayAttendance();
            await fetchMyResignation();
            await _checkHolidayBadge();
          }
        }
      }
    } catch (e) {
      debugPrint("Error in _initializeAppData: $e");
    } finally {
      // Only hide loading if NOT terminated
      if (mounted && employeeData?['status'] != 'terminated') {
        setState(() => loading = false);
      }
    }
  }

  Future<void> fetchOfficeLocations() async {
    try {
      final res = await http.get(
        Uri.parse("${getBaseUrl()}/api/settings/public"),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            _officeLocations = data['locations'] ?? [];
          });
        }
        debugPrint(
          "Successfully fetched ${_officeLocations.length} office locations",
        );
      } else {
        debugPrint("Failed to fetch locations: ${res.statusCode}");
      }
    } catch (e) {
      debugPrint("Fetch locations error: $e");
    }
  }

  Future<void> checkTodayHoliday() async {
    try {
      final res = await http.get(
        Uri.parse("${getBaseUrl()}/api/holidays/is-today-holiday"),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            isTodayHoliday = data['isHoliday'] ?? false;
            holidayReason = data['reason'];
          });
        }
      }
    } catch (e) {
      debugPrint("Holiday check error: $e");
    }
  }

  Future<void> _loadProfileImage() async {
    if (employeeId == null) return;
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _profileImagePath = prefs.getString('profile_pic_$employeeId');
      });
    }
  }

  Future<void> _loadEmployeeId() async {
    final prefs = await SharedPreferences.getInstance();
    employeeId = prefs.getString('employeeId');

    if (employeeId == null && mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => homescreen()),
      );
    }
  }

  Future<void> _handleHrPromotion() async {
    final prefs = await SharedPreferences.getInstance();

    // 1. Set new permissions
    await prefs.setBool('hr_logged_in', true);
    await prefs.setString('hr_id', employeeId ?? 'hr_default');
    await prefs.setString('hr_name', employeeData?['fullName'] ?? 'HR Manager');

    // 2. Clear old permissions to prevent conflicts
    await prefs.setBool('employeeLoggedIn', false);
    await prefs.setBool('manager_logged_in', false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Congratulations! You have been promoted to HR."),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 3),
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HrdashBoard()),
      );
    }
  }

  Future<void> _handleInternDemotion() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('employeeLoggedIn', false);
    await prefs.setBool('internLoggedIn', true);
    await prefs.setString('internId', employeeId ?? '');

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AttendancePage()),
      );
    }
  }

  Future<void> fetchEmployeeData(String id) async {
    if (id == 'test_employee_id') {
      employeeData = {
        "fullName": "Jane Doe",
        "email": "testemployee@softrate.com",
        "role": "employee",
        "status": "active",
        "employeeId": "test_employee_id",
        "companyCode": "SOFTRATE",
        "department": "Engineering",
        "phone": "9876543211",
        "isManager": false,
      };
      if (mounted) {
        setState(() {});
      }
      return;
    }

    try {
      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/employee/get/$id"),
      );

      if (response.statusCode == 200) {
        final fullData = jsonDecode(response.body);
        final data = fullData['employee'] ?? fullData['user'] ?? fullData;

        if (mounted) {
          setState(() {
            employeeData = data; // ✅ Single setState
          });
        }

        // 🔥 HR ROLE CHECK (PROMOTION)
        final role = data['role']?.toString().toLowerCase();
        final isHr = data['isHr'] == true || data['isHr']?.toString() == 'true';

        if (role == 'hr' || role == 'hr_admin' || isHr) {
          await _handleHrPromotion();
          return;
        }

        // 🔥 INTERN DEMOTION CHECK
        if (role == 'intern') {
          _handleInternDemotion();
          return;
        }

        // 🔥 Save manager info if they are a manager
        final isManager =
            (data['isManager'] == true ||
                data['isManager']?.toString() == 'true' ||
                data['role']?.toString().toLowerCase() == 'manager');
        if (isManager) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString("manager_email", data['email'] ?? '');
          await prefs.setString("manager_name", data['fullName'] ?? '');
          await prefs.setString("manager_id", data['employeeId'] ?? '');
          await prefs.setString("manager_dept", data['department'] ?? '');
          await prefs.setString("manager_mongo_id", data['_id'] ?? '');
        }

        // 🔥 TERMINATED CHECK
        if (data['status'] == 'terminated') {
          _handleTerminationAutoLogout();
        }
      }
    } catch (e) {
      debugPrint("Fetch employee data error: $e");
    }
  }

  Future<void> _handleTerminationAutoLogout() async {
    // Show termination notice
    if (mounted) {
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder:
            (context) => AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              title: Row(
                children: [
                  Icon(
                    Icons.work_off_rounded,
                    color: Colors.red.shade500,
                    size: 28,
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Account Terminated',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Colors.red,
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Your employment has been terminated.',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade800),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Your account access has been revoked.',
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                  ),
                ],
              ),
              actions: [
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    logout();
                  },
                  icon: const HugeIcon(
                    icon: HugeIcons.strokeRoundedLogout03,
                    color: Colors.white,
                    size: 20,
                  ),
                  label: const Text(
                    'Logout',
                    style: TextStyle(color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade500,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
      );
    }
  }

  Future<void> fetchMyResignation() async {
    if (employeeId == null) return;
    if (mounted) setState(() => resignationLoading = true);
    try {
      final url = Uri.parse("${getBaseUrl()}/api/resignation/$employeeId");
      final res = await http.get(
        url,
        headers: {"Content-Type": "application/json"},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          if (mounted) {
            setState(() => myResignation = data['data']);
          }
        }
      }
    } catch (e) {
      debugPrint("Resignation fetch error: $e");
    } finally {
      if (mounted) setState(() => resignationLoading = false);
    }
  }

  Future<void> _checkHolidayBadge() async {
    try {
      final res = await http.get(Uri.parse("${getBaseUrl()}/api/holidays"));
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        data.sort(
          (a, b) => (a['_id'] ?? '').toString().compareTo(
            (b['_id'] ?? '').toString(),
          ),
        );

        final stateString = data
            .map((e) => "${e['_id']}_${e['reason']}_${e['fromDate']}")
            .join(',');
        _latestHolidayState = stateString;

        final prefs = await SharedPreferences.getInstance();
        final savedState = prefs.getString('last_holiday_state');

        if (savedState == null) {
          // First time or after logout: initialize state without showing red dot
          await prefs.setString('last_holiday_state', stateString);
        } else if (savedState != stateString) {
          // Only show if the holidays have actually changed from what we last saw
          if (mounted) setState(() => _showHolidayBadge = true);
        }
      }
    } catch (e) {
      debugPrint("Badge check error: $e");
    }
  }

  Future<void> _markHolidaysAsSeen() async {
    if (mounted) setState(() => _showHolidayBadge = false);
    if (_latestHolidayState != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('last_holiday_state', _latestHolidayState!);
    }
  }

  Future<void> loadTodayAttendance() async {
    final response = await http.get(
      Uri.parse("${getBaseUrl()}/api/employeeAttanance/today/$employeeId"),
    );

    if (response.statusCode == 200) {
      final record = jsonDecode(response.body)['record'];
      if (record != null) {
        if (mounted) {
          setState(() {
            punchInTime = record['punchInTime'];
            punchOutTime = record['punchOutTime'];
            punchInLocation = record['punchInLocation'];
            punchOutLocation = record['punchOutLocation'];
          });
        }
      }
    }
  }

  Future<bool> handleLocationPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<String> getLocation() async {
    final pos = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    return "${pos.latitude}, ${pos.longitude}";
  }

  Future<bool> checkDistanceFromOffice() async {
    bool hasPermission = await handleLocationPermission();
    if (!hasPermission) return false;

    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );

    // 🔥 If no locations defined, block punch in
    if (_officeLocations.isEmpty) {
      return false;
    }

    // 🔥 Check against all authorized locations
    for (var loc in _officeLocations) {
      final double officeLat = double.parse(loc['latitude'].toString());
      final double officeLng = double.parse(loc['longitude'].toString());
      final double radius = double.parse((loc['radius'] ?? 200).toString());

      final distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        officeLat,
        officeLng,
      );

      debugPrint("Distance from ${loc['name']}: $distance meters");

      if (distance <= radius) {
        return true; // Match found!
      }
    }

    return false;
  }

  double _calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const R = 6371000; // meters
    final dLat = degToRad(lat2 - lat1);
    final dLon = degToRad(lon2 - lon1);
    final a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(degToRad(lat1)) *
            cos(degToRad(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }

  double degToRad(double deg) => deg * pi / 180;

  Future<void> punchIn() async {
    if (isTodayHoliday) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Cannot punch in - Today is holiday: $holidayReason"),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (employeeData?['status'] == 'terminated') {
      _handleTerminationAutoLogout();
      return;
    }

    if (employeeData?['status'] == 'terminated') {
      _handleTerminationAutoLogout();
      return;
    }

    if (punchInTime != null) return;
    if (!await handleLocationPermission()) {
      _showLocationWarning();
      return;
    }

    if (mounted) setState(() => punchLoading = true);

    final inside = await checkDistanceFromOffice();
    if (!inside) {
      if (mounted) setState(() => punchLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("You must be within 200 meters of the office."),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      final location = await getLocation();
      final response = await http.post(
        Uri.parse("${getBaseUrl()}/api/employeeAttanance/punch-in"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"employeeId": employeeId, "location": location}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        final record = data['record'];
        final prefs = await SharedPreferences.getInstance();
        final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
        prefs.setString("attendanceDate", today);
        await prefs.setString('punchInTime', record['punchInTime']);
        await prefs.setString('punchInLocation', record['punchInLocation']);
        await prefs.setBool('isPunchedIn', true);
        if (mounted) {
          setState(() {
            punchInTime = record['punchInTime'];
            punchInLocation = record['punchInLocation'];
          });
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Punch In successful"),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? data['msg'] ?? "Punch in failed"),
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("No network connection"),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => punchLoading = false);
    }
  }

  Future<void> punchOut() async {
    if (isTodayHoliday) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Cannot punch out - Today is holiday: $holidayReason"),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (punchInTime == null || punchOutTime != null) return;
    if (!await handleLocationPermission()) {
      _showLocationWarning();
      return;
    }

    if (mounted) setState(() => punchLoading = true);

    final inside = await checkDistanceFromOffice();
    if (!inside) {
      if (mounted) setState(() => punchLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("You must be within 200 meters of the office."),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      final location = await getLocation();
      final response = await http.post(
        Uri.parse("${getBaseUrl()}/api/employeeAttanance/punch-out"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"employeeId": employeeId, "location": location}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        final record = data['record'];
        final prefs = await SharedPreferences.getInstance();
        final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
        prefs.setString("attendanceDate", today);

        await prefs.setString('punchOutTime', record['punchOutTime']);
        await prefs.setString('punchOutLocation', record['punchOutLocation']);
        await prefs.setBool('isPunchedIn', false);
        if (mounted) {
          setState(() {
            punchOutTime = record['punchOutTime'];
            punchOutLocation = record['punchOutLocation'];
          });
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Punch Out successful"),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? data['msg'] ?? "Punch out failed"),
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Punch out error")));
    } finally {
      if (mounted) setState(() => punchLoading = false);
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => homescreen()),
    );
  }

  String _formatTime(String? iso) {
    if (iso == null) return "--";
    try {
      final time = DateTime.parse(iso).toLocal();
      return DateFormat("h:mm a").format(time);
    } catch (e) {
      return "--";
    }
  }

  Future<void> resetAttendanceIfNewDay() async {
    final prefs = await SharedPreferences.getInstance();

    final savedDate = prefs.getString("attendanceDate");
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

    if (savedDate != today) {
      // New day → clear old attendance
      await prefs.remove("punchInTime");
      await prefs.remove("punchOutTime");
      await prefs.remove("punchInLocation");
      await prefs.remove("punchOutLocation");
      await prefs.setString("attendanceDate", today);

      if (mounted) {
        setState(() {
          punchInTime = null;
          punchOutTime = null;
          punchInLocation = null;
          punchOutLocation = null;
        });
      }
    }
  }

  String calculateDuration(String? inTime, String? outTime) {
    if (inTime == null || outTime == null) return "--";
    try {
      final start = DateTime.parse(inTime);
      final end = DateTime.parse(outTime);
      final diff = end.difference(start);
      final hours = diff.inHours.toString().padLeft(2, '0');
      final minutes = (diff.inMinutes % 60).toString().padLeft(2, '0');
      final seconds = (diff.inSeconds % 60).toString().padLeft(2, '0');
      return "$hours h $minutes m $seconds s";
    } catch (e) {
      return "--";
    }
  }

  bool isShortTime(String? inTime, String? outTime) {
    if (inTime == null || outTime == null) return false;
    try {
      final start = DateTime.parse(inTime);
      final end = DateTime.parse(outTime);
      final diff = end.difference(start);
      return diff.inMinutes < 360; // 6 hours
    } catch (e) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final rawName = employeeData?['fullName']?.toString() ?? 'Employee';
    final name = rawName
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
    final now = _currentTime;
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0).day;
    final isLast5Days = now.day >= lastDayOfMonth - 40;
    final theme = Theme.of(context);

    return PopScope(
      canPop: false,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Color.fromARGB(0, 240, 241, 241),
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        child: Scaffold(
          backgroundColor: const Color(0xFFF1F5F9),
          body: SizedBox.expand(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFF00657F), // Consistent brand color
                    const Color(0xFFF1F5F9), // Smooth transition
                  ],
                  stops: const [0.0, 0.75], // Extended depth for immersive feel
                ),
              ),
              child: SafeArea(
                child: Stack(
                  children: [
                    Column(
                      children: [
                        buildNetworkStatusBanner(),
                        _buildHeader(theme),
                        Expanded(
                          child:
                              loading
                                  ? const Center(
                                    child: CircularProgressIndicator(),
                                  )
                                  : _buildMainUI(name, now, isLast5Days),
                        ),
                      ],
                    ),

                    /// FULL-SCREEN OVERLAY LOADER (Punch action)
                    if (punchLoading)
                      Positioned.fill(
                        child: Container(
                          color: Colors.black.withOpacity(0.5),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 3,
                              ),
                              SizedBox(height: 20),
                              Text(
                                "Processing...",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.0,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    final rawName = employeeData?['fullName']?.toString() ?? 'Employee';
    final name = rawName
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
    final isTestAccount = widget.employeeId == "test@peopleSoft";

    final isManager =
        (employeeData?['isManager'] == true ||
            employeeData?['isManager']?.toString() == 'true' ||
            employeeData?['role']?.toString().toLowerCase() == 'manager');

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Hi, $name",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 30,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isManager ? "Manager Dashboard" : "Employee Dashboard",
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withOpacity(0.85),
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
          InkWell(
            onTap:
                (employeeData == null && !isTestAccount)
                    ? null
                    : () {
                      if (isTestAccount) {
                        logout();
                      } else {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder:
                                (_) => EmployeeProfilePage(
                                  employeeData: employeeData,
                                ),
                          ),
                        ).then((_) => _loadProfileImage());
                      }
                    },
            borderRadius: BorderRadius.circular(30),
            child: Container(
              width: 52,
              height: 52,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withOpacity(0.4),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF0EA5E9),
                  gradient:
                      (isTestAccount || _profileImagePath == null)
                          ? const LinearGradient(
                            colors: [Color(0xFF0EA5E9), Color(0xFF0284C7)],
                          )
                          : null,
                  image:
                      (!isTestAccount && _profileImagePath != null)
                          ? DecorationImage(
                            image: FileImage(File(_profileImagePath!)),
                            fit: BoxFit.cover,
                          )
                          : null,
                ),
                child:
                    (isTestAccount || _profileImagePath == null)
                        ? Icon(
                          isTestAccount
                              ? Icons.logout_rounded
                              : Icons.person_rounded,
                          size: 28,
                          color: Colors.white,
                        )
                        : null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainUI(String name, DateTime now, bool isLast5Days) {
    return RefreshIndicator(
      onRefresh: _refreshAllData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildDateRow(now),
            const SizedBox(height: 24),
            _buildPunchCard(),
            const SizedBox(height: 60),
            _buildAttendanceSummaryCard(),
            const SizedBox(height: 32),
            // Optimized 2-Column Action Grid
            Column(
              children: [
                Row(
                  children: [
                    _buildManagerStyleBox(
                      "Attendance",
                      "Analytics",
                      Icons.analytics_rounded,
                      const Color(0xFF00B4D8),
                      onTap:
                          employeeId == null
                              ? null
                              : () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder:
                                        (context) => Employeeattendancedetails(
                                          employeeId: employeeId!,
                                          employeeName: name,
                                        ),
                                  ),
                                );
                              },
                    ),
                    const SizedBox(width: 12),
                    _buildManagerStyleBox(
                      "Leave",
                      "Management",
                      Icons.event_note_rounded,
                      const Color(0xFF00657F),
                      onTap:
                          employeeId == null
                              ? null
                              : () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder:
                                        (context) => EmployeeLeaveRequest(
                                          employeeId: employeeId!,
                                          employeeName: name,
                                        ),
                                  ),
                                );
                              },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildManagerStyleBox(
                      "Review",
                      "Appraisal",
                      Icons.rate_review_rounded,
                      const Color(0xFFF59E0B),
                      onTap:
                          employeeId == null
                              ? null
                              : () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder:
                                        (context) => EmployeeProgress(
                                          employeeId: employeeId!,
                                          employeeName: name,
                                        ),
                                  ),
                                );
                              },
                    ),
                    const SizedBox(width: 12),
                    _buildManagerStyleBox(
                      "Holiday",
                      "Calendar",
                      Icons.event_note_rounded,
                      const Color(0xFF0EA5E9),
                      showBadge: _showHolidayBadge,
                      onTap: () {
                        _markHolidaysAsSeen();
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const HolidayCalendarScreen(),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildManagerStyleBox(
                      "HR Policies",
                      "Guidelines",
                      Icons.policy_rounded,
                      const Color(0xFF0284C7),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => EmployeePolicyPage(),
                          ),
                        );
                      },
                    ),
                    const SizedBox(width: 12),
                    _buildManagerStyleBox(
                      "Hierarchy",
                      "Organization",
                      Icons.business_rounded,
                      const Color(0xFF004E61),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder:
                                (context) => intern_Organizational_Hierarchy(),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildManagerStyleBox(
                      "Payroll",
                      "Self Service",
                      Icons.account_balance_wallet_rounded,
                      const Color(0xFF0D9488),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const EmployeePayrollPage(),
                          ),
                        );
                      },
                    ),
                    const SizedBox(width: 12),
                    _buildManagerStyleBox(
                      "Projects",
                      "Assignments",
                      Icons.assignment_rounded,
                      const Color(0xFF00657F),
                      onTap: () {
                        final isManager =
                            (employeeData?['isManager'] == true ||
                                employeeData?['isManager']?.toString() ==
                                    'true' ||
                                employeeData?['role']
                                        ?.toString()
                                        .toLowerCase() ==
                                    'manager');
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder:
                                (_) => UserProjectPage(
                                  userId: employeeData?['_id'] ?? '',
                                  userName: name,
                                  isManager: isManager,
                                ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildManagerStyleBox(
                      "Fund Request",
                      "Company Claims",
                      Icons.receipt_long_rounded,
                      const Color(0xFF7C3AED),
                      onTap:
                          employeeId == null
                              ? null
                              : () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder:
                                        (_) => FundRequestPage(
                                          requesterId: employeeId!,
                                          requesterName: name,
                                          requesterType: 'employee',
                                        ),
                                  ),
                                );
                              },
                    ),
                    const SizedBox(width: 12),
                    const Expanded(child: SizedBox()),
                  ],
                ),
              ],
            ),

            // 🔥 Manager Access Section
            if (employeeData?['isManager'] == true ||
                employeeData?['isManager']?.toString() == 'true' ||
                employeeData?['role']?.toString().toLowerCase() == 'manager')
              ManagerAccessSection(employeeData: employeeData!),
            if (resignationLoading)
              const Center(child: CircularProgressIndicator())
            else if (myResignation != null)
              _buildResignationBanner(),
          ],
        ),
      ),
    );
  }

  Widget _buildDateRow(DateTime now) {
    final dateText = DateFormat("E, d MMM yyyy").format(now);
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dateText,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color.fromARGB(255, 250, 252, 255),
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 4),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: Colors.white.withOpacity(0.2),
                  width: 1,
                ),
              ),
              child: Text(
                DateFormat("h:mm a").format(now),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ],
        ),
        if (isTodayHoliday) ...[
          const SizedBox(height: 27),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.withOpacity(0.95),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.orange.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                const Icon(Icons.event_busy, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "Today is Holiday",
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    holidayReason ?? "Holiday",
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPunchCard() {
    final bool hasPunchedIn = punchInTime != null;
    final bool hasPunchedOut = punchOutTime != null;

    final String label;
    if (!hasPunchedIn) {
      label = "Punch In";
    } else if (!hasPunchedOut) {
      label = "Punch Out";
    } else {
      label = "Completed";
    }

    Color startColor;
    Color endColor;

    if (!hasPunchedIn) {
      startColor = const Color(0xFFFFB703);
      endColor = const Color(0xFFFB8500);
    } else if (!hasPunchedOut) {
      startColor = const Color(0xFF00B4D8);
      endColor = const Color(0xFF0077B6);
    } else {
      startColor = const Color(0xFFBDBDBD);
      endColor = const Color(0xFF9E9E9E);
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Stack(
        alignment: Alignment.bottomCenter,
        clipBehavior: Clip.none,
        children: [
          // Banner card (16:9 aspect ratio)
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                /// ---------------- BANNER ----------------
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(28),
                    image: const DecorationImage(
                      image: AssetImage("assets/images/banner.webp"),
                      fit: BoxFit.cover,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.15),
                        blurRadius: 25,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                ),

                /// ---------------- OVERLAY ----------------
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      color: Colors.black.withOpacity(0.25),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Button with Positioned for overlap (Full size)
          Positioned(
            bottom: -28, // Overlap effect
            child: Center(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap:
                    punchLoading
                        ? null
                        : () async {
                          if (hasPunchedIn && hasPunchedOut) {
                            showDialog(
                              context: context,
                              builder:
                                  (_) => AlertDialog(
                                    content: const Text(
                                      "Attendance locked - you are good 😄",
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(context),
                                        child: const Text("OK"),
                                      ),
                                    ],
                                  ),
                            );
                            return;
                          }

                          setState(() => punchLoading = true);

                          final inside = await checkDistanceFromOffice();
                          if (!inside) {
                            setState(() => punchLoading = false);
                            if (!mounted) return;
                            _showLocationWarning();
                            return;
                          }

                          if (!hasPunchedIn) {
                            await punchIn();
                          } else if (!hasPunchedOut) {
                            await punchOut();
                          }

                          if (mounted) setState(() => punchLoading = false);
                        },
                child: Material(
                  elevation: 8,
                  borderRadius: BorderRadius.circular(32),
                  color: Colors.transparent,
                  child: Container(
                    width: 220,
                    height: 56,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(32),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [startColor, endColor],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: startColor.withOpacity(0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      label,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceSummaryCard() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 22),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.7),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
            border: Border.all(
              color: Colors.white.withOpacity(0.4),
              width: 1.5,
            ),
          ),
          child: Column(
            children: [
              _buildSummaryRow(
                HugeIcons.strokeRoundedLogin03,
                "Punch In",
                _formatTime(punchInTime),
                iconColor: const Color(0xFF10B981),
              ),
              const SizedBox(height: 12),
              _buildSummaryRow(
                HugeIcons.strokeRoundedLogout03,
                "Punch Out",
                _formatTime(punchOutTime),
                iconColor: const Color(0xFFEF4444),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Divider(
                  height: 1,
                  thickness: 1,
                  color: Color(0xFF94A3B8),
                ),
              ),
              _buildDurationRow(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryRow(
    dynamic icon,
    String title,
    String value, {
    Color? iconColor,
  }) {
    final finalColor = iconColor ?? const Color(0xFF00657F);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: finalColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child:
                  icon is IconData
                      ? Icon(icon, size: 16, color: finalColor)
                      : HugeIcon(icon: icon, color: finalColor, size: 16),
            ),
            const SizedBox(width: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
          ),
        ),
      ],
    );
  }

  Widget _buildDurationRow() {
    final durationText = calculateDuration(punchInTime, punchOutTime);
    final shortTime = isShortTime(punchInTime, punchOutTime);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          "Duration",
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        Row(
          children: [
            Text(durationText, style: const TextStyle(fontSize: 15)),
            if (shortTime) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 8),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "Short Time",
                  style: TextStyle(
                    color: Colors.red.shade700,
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }

  void _showLocationWarning() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        elevation: 0,
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.transparent,
        duration: const Duration(seconds: 5),
        content: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.red, width: 2.0),
            boxShadow: [
              BoxShadow(
                color: Colors.red.withOpacity(0.2),
                blurRadius: 25,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.location_off_rounded,
                  color: Colors.red.shade700,
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Location Required",
                      style: TextStyle(
                        color: Colors.grey.shade900,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Please turn on your GPS And enter the permitted zone.",
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
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

  Widget _buildManagerStyleBox(
    String title,
    String subtitle,
    IconData icon,
    Color iconColor, {
    VoidCallback? onTap,
    bool showBadge = false,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Stack(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: iconColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: iconColor, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        Text(
                          subtitle,
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (showBadge)
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: Colors.red,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.red.withOpacity(0.4),
                        blurRadius: 4,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildResignationBanner() {
    final status = myResignation?['status'] as String? ?? "Pending";
    late Color statusColor;
    late String statusLabel;

    switch (status.toLowerCase()) {
      case 'accepted':
        statusColor = const Color(0xFF2E7D32);
        statusLabel = "Accepted";
        break;
      case 'rejected':
        statusColor = const Color(0xFFB00020);
        statusLabel = "Rejected";
        break;
      default:
        statusColor = const Color(0xFFFFA726);
        statusLabel = "Pending";
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: statusColor.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withOpacity(0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: statusColor.withOpacity(0.12),
            ),
            child: Icon(
              Icons.assignment_turned_in_rounded,
              size: 20,
              color: statusColor,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      "Offboarding",
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade800,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  _buildResignationMessage(statusLabel),
                  style: const TextStyle(fontSize: 13, color: Colors.black87),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _buildResignationMessage(String statusLabel) {
    switch (statusLabel) {
      case "Accepted":
        return "Your Offboarding has been accepted. Please follow the exit process shared by HR.";
      case "Rejected":
        return "Your Offboarding request was rejected. Contact HR for more information.";
      default:
        return "Your Offboarding request is under review. You will be notified once it is processed.";
    }
  }

  Future<void> _refreshAllData() async {
    // Re-run full initialization which includes role/promotion checks
    await _initializeAppData();
  }
}

class _ActionButton extends StatefulWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  State<_ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<_ActionButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) => setState(() => _isPressed = false),
        onTapCancel: () => setState(() => _isPressed = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _isPressed ? 0.96 : 1.0,
          duration: const Duration(milliseconds: 100),
          child: Container(
            height: 100,
            decoration: ShapeDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [widget.color, widget.color.withOpacity(0.85)],
              ),
              shape: ContinuousRectangleBorder(
                borderRadius: BorderRadius.circular(48),
              ),
              shadows: [
                BoxShadow(
                  color: widget.color.withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(widget.icon, color: Colors.white, size: 28),
                const SizedBox(height: 10),
                Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
