import 'package:hrmappfrontend/utils/device_info_helper.dart';
import 'dart:async' as java_timer;
import 'dart:convert';
import 'dart:io';
import 'dart:ui';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:hrmappfrontend/intern/InternAttendanceDetails.dart';
import 'package:hrmappfrontend/intern/Intern_policy.dart';
import 'package:hrmappfrontend/intern/LeaveApplyScreen.dart';
import 'package:hrmappfrontend/intern/form_two.dart';
import 'package:hrmappfrontend/intern/intern_Organizational_Hierarchy.dart';
import 'package:hrmappfrontend/intern/intern_process.dart';
import 'package:hrmappfrontend/intern/intern_profilepage.dart';
import 'package:hrmappfrontend/intern/HolidayCalendar.dart';
import 'package:hrmappfrontend/intern/payroll_page.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/network_aware_mixin.dart';
import 'package:hrmappfrontend/hr_pages/hrdash_board.dart';
import 'package:hrmappfrontend/Employee/EmployeeDashboard.dart';
import 'package:hrmappfrontend/fund_requests/fund_request_page.dart';

class AttendancePage extends StatefulWidget {
  const AttendancePage({super.key});

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage>
    with NetworkAwareMixin<AttendancePage> {
  String? punchInTime;
  String? punchOutTime;
  String? punchInLocation;
  String? punchOutLocation;
  String? internStatus;
  String? _profileImagePath;
  bool isTodayHoliday = false;
  String? holidayReason;

  bool loading = false;
  bool punchLoading = false;
  bool _showOverlay = true;
  double _overlayOpacity = 1.0;

  Map<String, dynamic>? internData;
  Map<String, dynamic>? myResignation;
  bool resignationLoading = false;
  String? internId;
  bool _isStipendIntern = false; // true when internshipType == "Stipend"
  DateTime _currentTime = DateTime.now();
  java_timer.Timer? _timer;
  bool _showHolidayBadge = false;
  String? _latestHolidayState;

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
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HrdashBoard()),
      );
    } else if (prefs.getBool('employeeLoggedIn') == true) {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => Employeedashboard(
            employeeId: prefs.getString('employeeId') ?? '',
          ),
        ),
      );
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
      await _loadInternId();
      await _loadProfileImage();

      if (internId != null) {
        await fetchInternData(internId!);
        if (internId != 'test_intern_id') {
          await handleDropStatus(internData?['status'] ?? '');
          await checkDropAndLogout();
          await resetAttendanceIfNewDay();

          // Run independent network requests concurrently to reduce load time
          await Future.wait([
            loadTodayAttendance(),
            fetchOfficeLocations(),
            checkTodayHoliday(),
            fetchMyResignation(),
            _checkHolidayBadge(),
          ]);
        }
      }
    } catch (e) {
      debugPrint("Error in _initializeAppData: $e");
    } finally {
      if (mounted) {
        setState(() {
          loading = false;
          _overlayOpacity = 0.0;
        });
        Future.delayed(const Duration(milliseconds: 800), () {
          if (mounted) {
            setState(() {
              _showOverlay = false;
            });
          }
        });
      }
    }
  }

  Future<void> handleDropStatus(String status) async {
    if (status.toLowerCase() != 'drop') return;

    final prefs = await SharedPreferences.getInstance();
    // Save dropDate only if it hasn't been saved yet
    if (!prefs.containsKey("dropDate")) {
      await prefs.setString("dropDate", DateTime.now().toIso8601String());
    }
  }

  Future<void> fetchMyResignation() async {
    if (internId == null) return;

    if (mounted) setState(() => resignationLoading = true);

    try {
      final url = Uri.parse("${getBaseUrl()}/api/resignation/$internId");
      final res = await http.get(
        url,
        headers: {"Content-Type": "application/json"},
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data["success"] == true) {
          if (mounted) {
            setState(() {
              myResignation = data["data"];
            });
          }
        }
      }
    } catch (e) {
      debugPrint("Resignation fetch error: $e");
    } finally {
      if (mounted) {
        setState(() => resignationLoading = false);
      }
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
          if (mounted) {
            setState(() => _showHolidayBadge = true);
          }
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

  Future<void> _loadInternId() async {
    final prefs = await SharedPreferences.getInstance();
    internId = prefs.getString('internId');

    if (internId == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => homescreen()),
        );
      });
    }
  }

  Future<void> _handleHrPromotion() async {
    final prefs = await SharedPreferences.getInstance();

    // 1. Set HR permissions
    await prefs.setBool('hr_logged_in', true);
    await prefs.setString('hr_id', internId ?? 'hr_default');
    await prefs.setString('hr_name', internData?['fullName'] ?? 'HR Manager');

    // 2. Clear old permissions to prevent conflicts
    await prefs.setBool('internLoggedIn', false);
    await prefs.setBool('employeeLoggedIn', false);

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HrdashBoard()),
      );
    }
  }

  Future<void> _handleEmployeePromotion() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('internLoggedIn', false);
    await prefs.setBool('hr_logged_in', false); // Ensure HR flag is false
    await prefs.setBool('employeeLoggedIn', true);
    await prefs.setString('employeeId', internId ?? '');

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => Employeedashboard(employeeId: internId ?? ''),
        ),
      );
    }
  }

  Future<void> _loadProfileImage() async {
    if (internId == null) return;
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _profileImagePath = prefs.getString('profile_pic_$internId');
      });
    }
  }

  String formatTime(String? isoString) {
    if (isoString == null) return "--";

    try {
      DateTime time = DateTime.parse(isoString).toLocal();
      return DateFormat("h:mm a").format(time);
    } catch (e) {
      return "--";
    }
  }

  Future<void> loadTodayAttendance() async {
    if (internId == null) return;

    try {
      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/attendance/today/$internId"),
        headers: {"Content-Type": "application/json"},
      );

      if (response.statusCode != 200) return;

      final data = jsonDecode(response.body);
      final record = data['record'];

      if (record == null) {
        // No punch today → clear UI
        if (mounted) {
          setState(() {
            punchInTime = null;
            punchOutTime = null;
            punchInLocation = null;
            punchOutLocation = null;
          });
        }
        return;
      }

      // ✅ Backend is authoritative
      if (mounted) {
        setState(() {
          punchInTime = record['punchInTime'];
          punchOutTime = record['punchOutTime'];
          punchInLocation = record['punchInLocation'] != null
              ? jsonEncode(record['punchInLocation'])
              : null;
          punchOutLocation = record['punchOutLocation'] != null
              ? jsonEncode(record['punchOutLocation'])
              : null;
        });
      }

      // ✅ Cache only after backend success
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString("punchInTime", punchInTime ?? '');
      await prefs.setString("punchOutTime", punchOutTime ?? '');
      await prefs.setString("punchInLocation", punchInLocation ?? '');
      await prefs.setString("punchOutLocation", punchOutLocation ?? '');
    } catch (e) {
      debugPrint("Attendance load error: $e");
    }
  }

  Future<List<LeaveRecord>> fetchLeavesForIntern() async {
    if (internId == null) return [];

    final url = Uri.parse("${getBaseUrl()}/api/leave/$internId");
    final response = await http.get(url);

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((e) => LeaveRecord.fromJson(e)).toList();
    } else {
      throw Exception('Failed to fetch leaves');
    }
  }

  Future<void> loadSavedPunchData() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        punchInTime = prefs.getString("punchInTime");
        punchOutTime = prefs.getString("punchOutTime");
        punchInLocation = prefs.getString("punchInLocation");
        punchOutLocation = prefs.getString("punchOutLocation");
      });
    }
  }

  Future<void> fetchInternData(String id) async {
    if (id == 'test_intern_id') {
      internData = {
        "fullName": "Alex Rivera",
        "email": "testintern@softrate.com",
        "role": "intern",
        "status": "ongoing",
        "internid": "test_intern_id",
        "companyCode": "SOFTRATE",
        "college": "Softrate Tech University",
        "qualification": "B.Tech Computer Science",
        "branch": "Main Office",
        "phone": "9876543210",
      };
      internStatus = "ongoing";
      if (mounted) {
        setState(() {});
      }
      return;
    }

    final baseUrl = getBaseUrl();

    try {
      final response = await http.get(
        Uri.parse("$baseUrl/api/intern/get/$id"),
        headers: {"Content-Type": "application/json"},
      );

      if (response.statusCode == 200) {
        final fullData = jsonDecode(response.body);
        internData =
            fullData['intern'] ??
            fullData['employee'] ??
            fullData['user'] ??
            fullData;

        internStatus = internData?['status']?.toString().toLowerCase();

        // Track internship type for Stipend button visibility
        final internshipType = internData?['internshipType']?.toString() ?? '';
        if (mounted)
          setState(
            () => _isStipendIntern = internshipType.toLowerCase() == 'stipend',
          );

        // 🔥 DEVICE BINDING AUTO LOGOUT CHECK
        final dbDeviceId = internData?['deviceId'];
        if (dbDeviceId != null) {
          final currentDeviceId = await DeviceInfoHelper.getDeviceId();
          if (dbDeviceId != currentDeviceId) {
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove('internLoggedIn');
            await prefs.remove('auth_token');
            await prefs.remove('internId');

            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Session expired: Account bound to another device.',
                  ),
                  backgroundColor: Colors.red,
                ),
              );
              WidgetsBinding.instance.addPostFrameCallback((_) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => homescreen()),
                  (route) => false,
                );
              });
            }
            throw Exception('DEVICE_MISMATCH');
          }
        }

        // 🔥 HR ROLE CHECK (PROMOTION)
        final role = internData?['role']?.toString().toLowerCase();
        final isHr =
            internData?['isHr'] == true ||
            internData?['isHr']?.toString() == 'true';

        if (role == 'hr' || role == 'hr_admin' || isHr) {
          _handleHrPromotion();
          return;
        }

        // 🔥 EMPLOYEE/MANAGER PROMOTION CHECK
        if (role == 'employee' || role == 'manager') {
          _handleEmployeePromotion();
          return;
        }

        if (internData != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString("internData", jsonEncode(internData));
        }

        if (mounted) {
          setState(() {});
        }
      } else {
        _loadCachedInternData();
      }
    } catch (e) {
      _loadCachedInternData();
    }
  }

  Future<void> _loadCachedInternData() async {
    final prefs = await SharedPreferences.getInstance();
    String? cachedData = prefs.getString("internData");

    if (cachedData != null) {
      if (mounted) {
        setState(() {
          internData = jsonDecode(cachedData);
        });
      }
    }
  }

  Future<bool> handleLocationPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }
    if (permission == LocationPermission.deniedForever) return false;

    return true;
  }

  Future<String> getLocation() async {
    Position pos = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    return "${pos.latitude}, ${pos.longitude}";
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

  Future<void> punchIn() async {
    // ✅ Holiday check - Backend handles it, but UI prevents unnecessary calls
    if (isTodayHoliday) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Cannot punch in - Today is holiday: $holidayReason"),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (punchInTime != null) return; // Already punched in
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
          content: Text("You must be within the authorized office area."),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      final location = await getLocation();

      final response = await http.post(
        Uri.parse("${getBaseUrl()}/api/attendance/punch-in"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"internId": internId, "location": location}),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final record = data['record'];
        final prefs = await SharedPreferences.getInstance();
        final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

        // ✅ Cache updated data
        await prefs.setString("punchInTime", record['punchInTime']);
        await prefs.setString(
          "punchInLocation",
          record['punchInLocation'] != null
              ? jsonEncode(record['punchInLocation'])
              : '',
        );
        await prefs.setBool("isPunchedIn", true);
        await prefs.setString("attendanceDate", today);

        if (mounted) {
          setState(() {
            punchInTime = record['punchInTime'];
            punchInLocation = record['punchInLocation'] != null
                ? jsonEncode(record['punchInLocation'])
                : null;
          });
        }
      } else {
        final msg = data['message']?.toString().toLowerCase() ?? '';
        if (msg.contains('location') ||
            msg.contains('distance') ||
            msg.contains('office zone')) {
          _showLocationWarning();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['message'] ?? 'Punch in failed'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("No network connection"),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => punchLoading = false);
      }
    }
  }

  Future<void> punchOut() async {
    if (isTodayHoliday) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Cannot punch out - Today is holiday: $holidayReason"),
        ),
      );
      return;
    }

    if (punchInTime == null || punchOutTime != null) return;

    try {
      final punchInDateTime = DateTime.parse(punchInTime!);
      final difference = DateTime.now().difference(punchInDateTime);
      if (difference.inMinutes < 5) {
        final remainingMinutes = 5 - difference.inMinutes;
        final remainingSeconds = 60 - (difference.inSeconds % 60);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Too early!"),
            backgroundColor: const Color.fromARGB(255, 239, 0, 0),
          ),
        );
        return;
      }
    } catch (e) {
      debugPrint("Error parsing punchInTime: $e");
    }

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
          content: Text("You must be within the authorized office area."),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      final location = await getLocation();

      final response = await http.post(
        Uri.parse("${getBaseUrl()}/api/attendance/punch-out"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"internId": internId, "location": location}),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final record = data['record'];
        final prefs = await SharedPreferences.getInstance();
        final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

        prefs.setString("punchOutTime", record['punchOutTime']);
        await prefs.setString(
          "punchOutLocation",
          record['punchOutLocation'] != null
              ? jsonEncode(record['punchOutLocation'])
              : '',
        );
        prefs.setBool("isPunchedIn", false);
        prefs.setString("attendanceDate", today);

        if (mounted) {
          setState(() {
            punchOutTime = record['punchOutTime'];
            punchOutLocation = record['punchOutLocation'] != null
                ? jsonEncode(record['punchOutLocation'])
                : null;
          });
        }
      } else {
        final msg = data['message']?.toString().toLowerCase() ?? '';
        if (msg.contains('location') ||
            msg.contains('distance') ||
            msg.contains('office zone')) {
          _showLocationWarning();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(data['message'] ?? 'Punch out failed')),
          );
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Punch out error")));
    } finally {
      if (mounted) setState(() => punchLoading = false);
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

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => homescreen()),
    );
  }

  String _getGreetingName(String? rawName, String fallback) {
    if (rawName == null || rawName.trim().isEmpty) return fallback;
    final words = rawName.split(' ').where((w) => w.trim().isNotEmpty).toList();
    if (words.isEmpty) return fallback;

    String selectedName = words[0];
    for (final word in words) {
      final cleanWord = word.replaceAll(RegExp(r'[^\w]'), '');
      if (cleanWord.length > 2) {
        selectedName = word;
        break;
      }
    }
    final cleanSelected = selectedName.replaceAll(RegExp(r'[^\w]'), '');
    if (cleanSelected.length <= 2) {
      selectedName = words[0];
    }

    final cleanWord = selectedName.replaceAll(RegExp(r'[^\w]'), '');
    if (cleanWord.isEmpty) return selectedName;
    return '${selectedName[0].toUpperCase()}${selectedName.substring(1).toLowerCase()}';
  }

  Widget _buildHeader(ThemeData theme) {
    final rawName = internData?['fullName']?.toString() ?? 'Intern';
    final name = _getGreetingName(rawName, 'Intern');

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
                  "Intern Dashboard",
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
            onTap: internData == null
                ? null
                : () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            InternProfilepage(internData: internData!),
                      ),
                    ).then((_) => _loadProfileImage());
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
                  gradient: (_profileImagePath == null)
                      ? const LinearGradient(
                          colors: [Color(0xFF0EA5E9), Color(0xFF0284C7)],
                        )
                      : null,
                  image: (_profileImagePath != null)
                      ? DecorationImage(
                          image: FileImage(File(_profileImagePath!)),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: (_profileImagePath == null)
                    ? const Icon(
                        Icons.person_rounded,
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

  @override
  Widget build(BuildContext context) {
    final rawName = internData?['fullName']?.toString() ?? 'Intern';
    final name = rawName
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
    final now = _currentTime;
    final theme = Theme.of(context);
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0).day;
    final isLast5Days = now.day >= lastDayOfMonth - 40;

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
          body: Stack(
            children: [
              SizedBox.expand(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        const Color(0xFF00657F),
                        const Color(0xFFF1F5F9),
                      ],
                      stops: const [0.0, 0.75],
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
                              child: _buildMainUI(name, now, isLast5Days),
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

              if (_showOverlay)
                IgnorePointer(
                  ignoring: _overlayOpacity == 0.0,
                  child: AnimatedOpacity(
                    opacity: _overlayOpacity,
                    duration: const Duration(milliseconds: 800),
                    curve: Curves.easeInOut,
                    child: Scaffold(
                      backgroundColor: Colors.white,
                      body: Stack(
                        children: [
                          SizedBox.expand(
                            child: Image.asset(
                              'assets/images/app_launch.png',
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                return const Center(child: Icon(Icons.error));
                              },
                            ),
                          ),
                          Positioned(
                            bottom: 250,
                            left: 40,
                            right: 40,
                            child: const DotLoadingIndicator(
                              color: Color(0xFF00657F),
                              size: 10.0,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _refreshAllData() async {
    // Re-run full initialization which includes role/promotion checks
    await _initializeAppData();
  }

  Future<void> checkDropAndLogout() async {
    final prefs = await SharedPreferences.getInstance();
    if (!prefs.containsKey("dropDate")) return;

    final dropDateStr = prefs.getString("dropDate")!;
    final dropDate = DateTime.parse(dropDateStr);
    final now = DateTime.now();

    // If 1 day passed since drop
    if (now.difference(dropDate).inDays >= 1) {
      await prefs.clear(); // clear all data
      if (!mounted) return;

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => homescreen()),
        (route) => false,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Your internship has been terminated. You cannot login anymore.",
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
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
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => InternAttendanceDetails(
                              internId: internId ?? '',
                              internName: name,
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
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => LeaveApplyScreen(
                              internId: internId ?? '',
                              internName: name,
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
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => InternProcess(
                              internId: internId ?? '',
                              internName: name,
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
                            builder: (_) => const HolidayCalendarScreen(),
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
                            builder: (_) => const InternPolicyPage(),
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
                            builder: (_) =>
                                const intern_Organizational_Hierarchy(),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                if (_isStipendIntern) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _buildManagerStyleBox(
                        "Stipend",
                        "Self Service",
                        Icons.account_balance_wallet_rounded,
                        const Color(0xFF0D9488),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const PayrollPage(),
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: 12),
                      const Expanded(child: SizedBox()),
                    ],
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),
            if (internData?["status"] == "approved") ...[
              const SizedBox(height: 12),
              _buildProfileCompletionCard(name),
            ],
            const SizedBox(height: 16),
            if (resignationLoading)
              const Center(child: CircularProgressIndicator())
            else if (myResignation != null)
              _buildResignationBanner(),
          ],
        ),
      ),
    );
  }

  Widget _buildResignationBanner() {
    final status = (myResignation?['status'] as String?) ?? 'Pending';
    late final Color statusColor;
    late final String statusLabel;

    switch (status.toLowerCase()) {
      case 'accepted':
        statusColor = Color(0xFF2E7D32);
        statusLabel = 'Accepted';
        break;
      case 'rejected':
        statusColor = Color(0xFFB00020);
        {}
        statusLabel = 'Rejected';
        break;
      default:
        statusColor = Color(0xFFFFA726);
        statusLabel = 'Pending';
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
                        color: Colors.grey.shade800, // Softer text color
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(
                          0.15,
                        ), // Slightly subtle background
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
                          letterSpacing: 0.3, // small spacing for readability
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
      case 'Accepted':
        return "Your Offboarding has been accepted. Please follow the exit process shared by HR.";
      case 'Rejected':
        return "Your Offboarding request was rejected. Contact HR for more information.";
      default:
        return "Your Offboarding request is under review. You will be notified once it is processed.";
    }
  }

  Widget _buildProfileCompletionCard(String name) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color(0xFFFFF3E0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Color(0xFFF57C00),
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "$name, please complete your profile by submitting the required form.",
                  style: const TextStyle(fontSize: 15, color: Colors.black87),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton(
                    onPressed: () async {
                      final refreshed = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => FormTwo(internName: name),
                        ),
                      );
                      if (refreshed == true) {
                        _refreshAllData();
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Color(0xFFF57C00),
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 18,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      "Fill Form",
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
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

        // ✅ HOLIDAY BANNER - Only shows when isTodayHoliday = true
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
          // Banner card (16:9 aspect ratio) with bottom padding
          Padding(
            padding: const EdgeInsets.only(bottom: 28),
            child: AspectRatio(
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
          ),

          // Button at bottom of stack
          Center(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: punchLoading
                  ? null
                  : () async {
                      if (hasPunchedIn && hasPunchedOut) {
                        showDialog(
                          context: context,
                          builder: (_) => AlertDialog(
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

                      if (mounted) setState(() => punchLoading = true);

                      // Note: checkDistanceFromOffice is not present in intern dashboard,
                      // but it seems the punchIn/punchOut methods might handle location.
                      // I will stick to the existing logic but update the UI.

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
                Icons.login_rounded,
                "Punch In",
                formatTimeDisplay(punchInTime),
                iconColor: const Color(0xFF10B981),
              ),
              const SizedBox(height: 12),
              _buildSummaryRow(
                Icons.logout_rounded,
                "Punch Out",
                formatTimeDisplay(punchOutTime),
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
    IconData icon,
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
              child: Icon(icon, size: 16, color: finalColor),
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
    final durationText = _calculateDuration(punchInTime, punchOutTime);
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

  List<dynamic> _officeLocations = [];

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
          "Intern Dashboard: Fetched ${_officeLocations.length} locations",
        );
      } else {
        debugPrint(
          "Intern Dashboard: Failed to fetch locations: ${res.statusCode}",
        );
      }
    } catch (e) {
      debugPrint("Fetch locations error: $e");
    }
  }

  Future<bool> checkDistanceFromOffice() async {
    if (internStatus == 'remote' || internData?['isRemote'] == true || internData?['isRemote']?.toString() == 'true') return true;

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
      final double radius = double.parse((loc['radius'] ?? 50).toString());

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

  double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371000; // meters
    final dLat = _degToRad(lat2 - lat1);
    final dLon = _degToRad(lon2 - lon1);

    final a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(_degToRad(lat1)) *
            cos(_degToRad(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }

  double _degToRad(double deg) => deg * (pi / 180);

  String _calculateDuration(String? inTime, String? outTime) {
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

  String formatTimeDisplay(String? isoString) {
    if (isoString == null) return "--";

    try {
      final time = DateTime.parse(isoString).toLocal();
      return DateFormat("h:mm a").format(time);
    } catch (e) {
      return "--";
    }
  }

  String formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw);
      return DateFormat("d MMM").format(dt);
    } catch (_) {
      return raw;
    }
  }

  void _showLocationWarning() {
    ScaffoldMessenger.of(context).clearSnackBars();
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
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.location_off_rounded,
                  color: Colors.red.shade700,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Location Error",
                      style: TextStyle(
                        color: Colors.grey.shade900,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Please turn on your location and ensure you are within the office Permited zone.",
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        height: 1.3,
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
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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

class LeaveRecord {
  final String id;
  final String leaveType;
  final String fromDate;
  final String toDate;
  final String status;
  final String rejectionReason;
  final Map<String, String> perDayDurations;

  LeaveRecord({
    required this.id,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.status,
    this.rejectionReason = "",
    this.perDayDurations = const {},
  });

  factory LeaveRecord.fromJson(Map<String, dynamic> json) {
    Map<String, String> perDay = {};
    if (json['perDayDurations'] != null) {
      perDay = Map<String, String>.from(json['perDayDurations']);
    }

    final from = json['fromDate'] is Map
        ? json['fromDate']['\$date']
        : json['fromDate'];
    final to = json['toDate'] is Map
        ? json['toDate']['\$date']
        : json['toDate'];

    return LeaveRecord(
      id: json['_id'] ?? '',
      leaveType: json['leaveType'] ?? '',
      fromDate: from,
      toDate: to,
      status: json['status'] ?? 'pending',
      rejectionReason: json['rejectionReason'] ?? '',
      perDayDurations: perDay,
    );
  }
}

class _ActionButton extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return Expanded(
      child: SizedBox(
        height: 52,
        child: ElevatedButton.icon(
          onPressed: onTap,
          icon: Icon(icon, color: Colors.white, size: 20),
          label: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: color,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            elevation: 0,
          ),
        ),
      ),
    );
  }
}

class DotLoadingIndicator extends StatefulWidget {
  final Color color;
  final double size;

  const DotLoadingIndicator({
    super.key,
    this.color = const Color(0xFF00657F),
    this.size = 10.0,
  });

  @override
  State<DotLoadingIndicator> createState() => _DotLoadingIndicatorState();
}

class _DotLoadingIndicatorState extends State<DotLoadingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final double delay = index * 0.2;
            final double progress = (_controller.value - delay) % 1.0;
            final double scale =
                0.6 +
                0.4 *
                    (progress < 0.5
                        ? (progress * 2)
                        : (1.0 - (progress - 0.5) * 2));
            final double opacity =
                0.3 +
                0.7 *
                    (progress < 0.5
                        ? (progress * 2)
                        : (1.0 - (progress - 0.5) * 2));

            return Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: Transform.scale(
                scale: scale,
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 5.0),
                  width: widget.size,
                  height: widget.size,
                  decoration: BoxDecoration(
                    color: widget.color,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            );
          },
        );
      }),
    );
  }
}
