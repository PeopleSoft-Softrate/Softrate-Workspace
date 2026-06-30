import 'package:hrmappfrontend/utils/device_info_helper.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hrmappfrontend/hr_pages/OrganizationalHierarchy.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/EmployeeLeaveApproval.dart';
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/employee_management.dart';
import 'package:hrmappfrontend/hr_pages/hr_holiday_screen.dart';
import 'package:hrmappfrontend/hr_pages/support/TodayAttendancePage.dart';
import 'package:hrmappfrontend/hr_pages/support/TodayEmployeeAttendancePage.dart';
import 'package:hrmappfrontend/hr_pages/support/TodayEmployeeAttendanceService.dart';
import 'package:hrmappfrontend/hr_pages/support/today_attendance_service.dart';
import 'package:hrmappfrontend/intern/userdashboard.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/utils/location_redirect_dialog.dart';
import 'package:intl/intl.dart';
import 'package:media_store_plus/media_store_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/Employee/EmployeeAttendanceDetails.dart';
import 'package:hrmappfrontend/Employee/Employee_progress.dart';
import 'package:hrmappfrontend/Employee/Employee_policy.dart';
import 'package:hrmappfrontend/Employee/employee_leave_request.dart';
import 'package:hrmappfrontend/Employee/employeepayroll.dart';
import 'package:hrmappfrontend/Employee/EmployeeDashboard.dart';
import 'package:hrmappfrontend/fund_requests/fund_request_approval_page.dart';

import 'package:hrmappfrontend/hr_pages/intern_leave_approval.dart';
import 'package:hrmappfrontend/hr_pages/intern_management.dart';
import 'package:hrmappfrontend/hr_pages/hr_payroll_management.dart';
import 'package:hrmappfrontend/network_aware_mixin.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';

class HrdashBoard extends StatefulWidget {
  const HrdashBoard({super.key});

  @override
  State<HrdashBoard> createState() => _HrdashBoardState();
}

class _HrdashBoardState extends State<HrdashBoard>
    with NetworkAwareMixin<HrdashBoard> {
  int _selectedModel = 0;
  String? _punchInTime;
  String? _punchOutTime;
  bool _isPunchLoading = false;

  String? hrId;
  String? hrName;
  String? _profileImagePath;
  Map<String, dynamic>? hrData;
  DateTime _currentTime = DateTime.now();
  Timer? _clockTimer;
  int _requiredHrMinutes = 480; // default 8 hours

  bool isTodayHoliday = false;
  String? holidayReason;
  List<dynamic> _officeLocations = [];

  Future<void> fetchOfficeLocations() async {
    try {
      final res = await http.get(
        Uri.parse("${getBaseUrl()}/api/settings/public"),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) setState(() => _officeLocations = data['locations'] ?? []);
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
    if (_officeLocations.isEmpty) return false;
    for (var loc in _officeLocations) {
      try {
        final double officeLat = double.parse(loc['latitude'].toString());
        final double officeLng = double.parse(loc['longitude'].toString());
        final double radius = double.parse((loc['radius'] ?? 200).toString());
        final distance = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          officeLat,
          officeLng,
        );
        if (distance <= radius) return true;
      } catch (e) {
        debugPrint("Distance calculation error for ${loc['name']}: $e");
        continue;
      }
    }
    return false;
  }

  Future<void> punchIn() async {
    if (isTodayHoliday) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Holiday: $holidayReason"),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    if (_punchInTime != null) return;
    if (!await handleLocationPermission()) {
      showLocationRedirectDialog(context);
      return;
    }
    if (mounted) setState(() => _isPunchLoading = true);
    final inside = await checkDistanceFromOffice();
    if (!inside) {
      if (mounted) setState(() => _isPunchLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Must be within 200m of office"),
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
        body: jsonEncode({"employeeId": hrId, "location": location}),
      );
      if (response.statusCode == 200) {
        final record = jsonDecode(response.body)['record'];
        if (mounted) setState(() => _punchInTime = record['punchInTime']);
        await _savePunchData();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Punch In successful"),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      debugPrint("Punch in error: $e");
    } finally {
      if (mounted) setState(() => _isPunchLoading = false);
    }
  }

  Future<void> punchOut() async {
    if (isTodayHoliday) return;
    if (_punchInTime == null || _punchOutTime != null) return;
    if (!await handleLocationPermission()) {
      showLocationRedirectDialog(context);
      return;
    }
    if (mounted) setState(() => _isPunchLoading = true);

    try {
      final punchInDateTime = DateTime.parse(_punchInTime!);
      final difference = DateTime.now().difference(punchInDateTime);
      if (difference.inMinutes < _requiredHrMinutes) {
        if (mounted) setState(() => _isPunchLoading = false);
        final remaining = _requiredHrMinutes - difference.inMinutes;
        final h = remaining ~/ 60;
        final m = remaining % 60;
        final timeStr = h > 0 ? "${h}h ${m}m" : "${m}m";
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Cannot punch out yet. Required time remaining: $timeStr"),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
    } catch (e) {
      debugPrint("Error parsing punchInTime: $e");
    }

    final inside = await checkDistanceFromOffice();
    if (!inside) {
      if (mounted) setState(() => _isPunchLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Must be within 200m of office"),
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
        body: jsonEncode({"employeeId": hrId, "location": location}),
      );
      if (response.statusCode == 200) {
        final record = jsonDecode(response.body)['record'];
        if (mounted) setState(() => _punchOutTime = record['punchOutTime']);
        await _savePunchData();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Punch Out successful"),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      debugPrint("Punch out error: $e");
    } finally {
      if (mounted) setState(() => _isPunchLoading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _checkInitialRole();
    _currentTime = DateTime.now();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _currentTime = DateTime.now();
        });
      }
    });
    _initializeData();
  }

  Future<void> _checkInitialRole() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool('hr_logged_in') != true) {
      if (prefs.getBool('employeeLoggedIn') == true) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder:
                (_) => Employeedashboard(
                  employeeId: prefs.getString('employeeId') ?? '',
                ),
          ),
        );
      } else if (prefs.getBool('internLoggedIn') == true) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const AttendancePage()),
        );
      }
    }
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }

  Future<void> _initializeData() async {
    await _loadHrId();
    await fetchHrProfile();
    await _loadPunchData();
    await _loadProfileImage();
    await checkTodayHoliday();
    await fetchOfficeLocations();

    if (hrId != null && hrId != 'hr_default') {
      await fetchHrData(hrId!);
    }
  }

  Future<void> fetchHrProfile() async {
    try {
      final response = await http.get(Uri.parse("${getBaseUrl()}/api/auth/me"));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final user = data['user'];
        if (user == null) return;

        // Role check for demotion
        final roleObj = user['roleId'];
        String role = '';
        if (roleObj is Map) {
          role = (roleObj['name'] ?? '').toString().toLowerCase();
        } else {
          role = (user['role'] ?? '').toString().toLowerCase();
        }
        final isHr = user['isHr'] == true || user['isHr']?.toString() == 'true';

        if (role != 'hr' && role != 'hr_admin' && !isHr) {
          debugPrint("fetchHrProfile: User is no longer HR. Demoting...");
          _handleHrDemotion();
          return;
        }

        // 🔥 DEVICE BINDING AUTO LOGOUT CHECK
        final dbDeviceId = user['deviceId'];
        if (dbDeviceId != null) {
          final currentDeviceId = await DeviceInfoHelper.getDeviceId();
          if (dbDeviceId != currentDeviceId) {
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove('hr_logged_in');
            await prefs.remove('auth_token');
            await prefs.remove('hr_id');
            
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Session expired: Account bound to another device.'),
                  backgroundColor: Colors.red,
                ),
              );
              WidgetsBinding.instance.addPostFrameCallback((_) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const homescreen()),
                  (route) => false,
                );
              });
            }
            throw Exception('DEVICE_MISMATCH');
          }
        }

        if (mounted) {
          setState(() {
            hrData = user;
            final profile = user['profile'] ?? {};
            hrName = profile['firstName'] ?? "HR Manager";
          });
        }

        try {
          final res = await http.get(
            Uri.parse("${getBaseUrl()}/api/settings/company"),
            headers: {"Content-Type": "application/json"},
          );
          if (res.statusCode == 200) {
            final b = jsonDecode(res.body);
            final wd = b['workDurationSettings'] ?? {};
            _requiredHrMinutes = (((wd['hr'] as num?)?.toDouble() ?? 8.0) * 60).toInt();
          }
        } catch (_) {}
      }
    } catch (e) {
      debugPrint("Fetch HR profile error: $e");
    }
  }

  Future<void> fetchHrData(String id) async {
    try {
      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/employee/get/$id"),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['employee'];
        if (data == null) return;

        final role = data['role']?.toString().toLowerCase();
        final isHr = data['isHr'] == true || data['isHr']?.toString() == 'true';

        if (role != 'hr' && role != 'hr_admin' && !isHr) {
          _handleHrDemotion();
          return;
        }

        if (mounted) {
          setState(() {
            hrData = data;
            hrName = data['fullName'] ?? hrName;
          });
        }

        // Update cached name
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('hr_name', data['fullName'] ?? 'HR Manager');
      }
    } catch (e) {
      debugPrint("Fetch HR data error: $e");
    }
  }

  Future<void> _loadHrId() async {
    final prefs = await SharedPreferences.getInstance();
    hrId = prefs.getString('hr_id') ?? 'hr_default';
    hrName = prefs.getString('hr_name') ?? 'HR Manager';
  }

  Future<void> _handleHrDemotion() async {
    final prefs = await SharedPreferences.getInstance();

    // Get the actual role from the latest data if available
    final roleObj = hrData?['roleId'];
    String role = '';
    if (roleObj is Map) {
      role = (roleObj['name'] ?? '').toString().toLowerCase();
    } else {
      role = (hrData?['role'] ?? '').toString().toLowerCase();
    }

    await prefs.setBool('hr_logged_in', false);

    if (role == 'intern') {
      await prefs.setBool('internLoggedIn', true);
      await prefs.setBool('employeeLoggedIn', false);
      await prefs.setString('internId', hrId ?? '');

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const AttendancePage()),
        );
      }
    } else {
      await prefs.setBool('employeeLoggedIn', true);
      await prefs.setBool('internLoggedIn', false);
      await prefs.setString('employeeId', hrId ?? '');

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => Employeedashboard(employeeId: hrId ?? ''),
          ),
        );
      }
    }
  }

  Future<void> _loadProfileImage() async {
    if (hrId == null) return;
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _profileImagePath = prefs.getString('profile_pic_$hrId');
      });
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: source);

    if (pickedFile != null) {
      final croppedFile = await ImageCropper().cropImage(
        sourcePath: pickedFile.path,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop Profile',
            toolbarColor: const Color(0xFF00657F),
            toolbarWidgetColor: Colors.white,
            initAspectRatio: CropAspectRatioPreset.square,
            lockAspectRatio: true,
            cropStyle: CropStyle.circle,
          ),
          IOSUiSettings(
            title: 'Crop Profile',
            aspectRatioLockEnabled: true,
            cropStyle: CropStyle.circle,
          ),
        ],
      );

      if (croppedFile != null && hrId != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('profile_pic_$hrId', croppedFile.path);
        if (mounted) {
          setState(() {
            _profileImagePath = croppedFile.path;
          });
        }
      }
    }
  }

  void _showProfileOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder:
          (context) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(
                    Icons.camera_alt_rounded,
                    color: Color(0xFF00657F),
                  ),
                  title: const Text(
                    "Take Photo",
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.camera);
                  },
                ),
                ListTile(
                  leading: const Icon(
                    Icons.photo_library_rounded,
                    color: Color(0xFF00657F),
                  ),
                  title: const Text(
                    "Choose from Gallery",
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.gallery);
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(
                    Icons.logout_rounded,
                    color: Colors.redAccent,
                  ),
                  title: const Text(
                    "Logout",
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Colors.redAccent,
                    ),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    _showLogoutDialog();
                  },
                ),
              ],
            ),
          ),
    );
  }

  Future<void> _loadPunchData() async {
    if (hrId == null || hrId == 'hr_default') return;

    try {
      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/employeeAttanance/today/$hrId"),
      );

      if (response.statusCode == 200) {
        final record = jsonDecode(response.body)['record'];
        if (record != null && mounted) {
          setState(() {
            _punchInTime = record['punchInTime'];
            _punchOutTime = record['punchOutTime'];
          });
          // Also sync to local storage for persistence
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('hr_punch_in', _punchInTime ?? '');
          await prefs.setString('hr_punch_out', _punchOutTime ?? '');
        }
      }
    } catch (e) {
      debugPrint("Load punch data error: $e");
      // Fallback to local storage if API fails
      final prefs = await SharedPreferences.getInstance();
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      if (prefs.getString('hr_punch_date') == today) {
        if (mounted) {
          setState(() {
            _punchInTime = prefs.getString('hr_punch_in');
            _punchOutTime = prefs.getString('hr_punch_out');
          });
        }
      }
    }
  }

  Future<void> _savePunchData() async {
    final prefs = await SharedPreferences.getInstance();
    if (_punchInTime != null) {
      await prefs.setString('hr_punch_in', _punchInTime!);
    }
    if (_punchOutTime != null) {
      await prefs.setString('hr_punch_out', _punchOutTime!);
    }
  }

  Future<void> _resetAttendance() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('hr_punch_in');
    await prefs.remove('hr_punch_out');
    setState(() {
      _punchInTime = null;
      _punchOutTime = null;
    });
  }

  /// LOGOUT FUNCTION
  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("hr_logged_in");

    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const homescreen()),
      (route) => false,
    );
  }

  /// LOGOUT CONFIRMATION
  void _showLogoutDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder:
          (_) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            titlePadding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
            contentPadding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
            actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            title: Row(
              children: [
                const Icon(
                  Icons.logout_outlined,
                  color: Color(0xFF00657F),
                  size: 26,
                ),
                const SizedBox(width: 10),
                const Text(
                  "Confirm Logout",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            content: const Text(
              "Are you sure you want to log out of your account?",
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
                height: 1.4,
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(
                  "Cancel",
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF00657F),
                  ),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  _logout();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00657F),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: const Text(
                  "Logout",
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
    );
  }

  /// Segmented control at top: Interns / Employees
  Widget _tabItem({required String title, required int index}) {
    final bool isSelected = _selectedModel == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedModel = index),
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              color:
                  isSelected
                      ? Colors.white
                      : const Color(
                        0xFF00657F,
                      ).withOpacity(0.8), // Improved contrast
              letterSpacing: 0.1,
            ),
          ),
        ),
      ),
    );
  }

  Widget _modelTabs() {
    return Container(
      width: 280, // Fixed width for better control
      height: 48,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFF00657F).withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Stack(
        children: [
          // Sliding Background Pill
          AnimatedPositioned(
            duration: const Duration(milliseconds: 300),
            curve: Curves.elasticOut,
            left: _selectedModel == 0 ? 0 : 136, // Adjust based on width
            right: _selectedModel == 0 ? 136 : 0,
            top: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF00657F),
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00657F).withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(
                      0,
                      4,
                    ), // Slight elevation for active tab
                  ),
                ],
              ),
            ),
          ),
          Row(
            children: [
              _tabItem(title: "Interns", index: 0),
              _tabItem(title: "Employees", index: 1),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final now = _currentTime;

    return PopScope(
      canPop: false,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        child: Scaffold(
          backgroundColor: const Color(0xFFF1F5F9),
          body: SizedBox.expand(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFF00657F), Color(0xFFF1F5F9)],
                  stops: [0.0, 0.75],
                ),
              ),
              child: SafeArea(
                child: Column(
                  children: [
                    buildNetworkStatusBanner(),
                    _buildHeader(theme),
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _handleRefresh,
                        color: const Color(0xFF00657F),
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(
                            parent: ClampingScrollPhysics(),
                          ),
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildDateRow(now),
                              const SizedBox(height: 24),
                              _buildHrPunchCard(),
                              const SizedBox(height: 60),
                              _buildAttendanceSummaryCard(),
                              const SizedBox(height: 32),

                              _buildSectionHeader(
                                "Self Service",
                                Icons.person_outline_rounded,
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  _buildManagerStyleBox(
                                    "Attendance",
                                    "Analytics",
                                    Icons.analytics_rounded,
                                    const Color(0xFF00B4D8),
                                    onTap:
                                        hrId == null
                                            ? null
                                            : () => Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder:
                                                    (_) =>
                                                        Employeeattendancedetails(
                                                          employeeId: hrId!,
                                                          employeeName:
                                                              hrName ?? 'HR',
                                                        ),
                                              ),
                                            ),
                                  ),
                                  const SizedBox(width: 12),
                                  _buildManagerStyleBox(
                                    "Leave",
                                    "Management",
                                    Icons.event_note_rounded,
                                    const Color(0xFF00657F),
                                    onTap:
                                        hrId == null
                                            ? null
                                            : () => Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder:
                                                    (_) => EmployeeLeaveRequest(
                                                      employeeId: hrId!,
                                                      employeeName:
                                                          hrName ?? 'HR',
                                                    ),
                                              ),
                                            ),
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
                                        hrId == null
                                            ? null
                                            : () => Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder:
                                                    (_) => EmployeeProgress(
                                                      employeeId: hrId!,
                                                      employeeName:
                                                          hrName ?? 'HR',
                                                    ),
                                              ),
                                            ),
                                  ),
                                  const SizedBox(width: 12),
                                  _buildManagerStyleBox(
                                    "Holiday",
                                    "Calendar",
                                    Icons.calendar_today_rounded,
                                    const Color(0xFF0EA5E9),
                                    onTap:
                                        () => Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder:
                                                (_) => const HrHolidayScreen(),
                                          ),
                                        ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  _buildManagerStyleBox(
                                    "Hierarchy",
                                    "Organization",
                                    Icons.business_rounded,
                                    const Color(0xFF004E61),
                                    onTap:
                                        () => Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder:
                                                (_) =>
                                                    const OrganizationalHierarchy(),
                                          ),
                                        ),
                                  ),
                                  const SizedBox(width: 12),
                                  _buildManagerStyleBox(
                                    "Payroll",
                                    "Self Service",
                                    Icons.account_balance_wallet_rounded,
                                    const Color(0xFF0D9488),
                                    onTap:
                                        () => Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder:
                                                (_) =>
                                                    const EmployeePayrollPage(),
                                          ),
                                        ),
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
                                    onTap:
                                        () => Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder:
                                                (_) =>
                                                    const EmployeePolicyPage(),
                                          ),
                                        ),
                                  ),
                                  const SizedBox(width: 12),
                                  const Spacer(),
                                ],
                              ),

                              const SizedBox(height: 32),
                              Center(child: _modelTabs()),
                              const SizedBox(height: 32),

                              _selectedModel == 0
                                  ? _internCards()
                                  : _employeeCards(),

                              const SizedBox(height: 40),

                              const SizedBox(height: 40),
                            ],
                          ),
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
                  "Hi, ${hrName ?? 'Manager'}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 30,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  "HR Dashboard",
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.85),
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: _showProfileOptions,
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
                      (_profileImagePath == null)
                          ? const LinearGradient(
                            colors: [Color(0xFF0EA5E9), Color(0xFF0284C7)],
                          )
                          : null,
                  image:
                      (_profileImagePath != null)
                          ? DecorationImage(
                            image: FileImage(File(_profileImagePath!)),
                            fit: BoxFit.cover,
                          )
                          : null,
                ),
                child:
                    (_profileImagePath == null)
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

  Widget _buildDateRow(DateTime now) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          DateFormat('EEEE, d MMMM').format(now),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            letterSpacing: 0.3,
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withOpacity(0.2), width: 1),
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
    );
  }

  Widget _buildManagerStyleBox(
    String title,
    String subtitle,
    IconData icon,
    Color iconColor, {
    VoidCallback? onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
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
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 18,
          decoration: BoxDecoration(
            color: const Color(0xFF00657F).withOpacity(0.3),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: Color(0xFF1E293B),
            letterSpacing: -0.4,
          ),
        ),
        const Spacer(),
        Icon(icon, size: 16, color: const Color(0xFF94A3B8)),
      ],
    );
  }

  Widget _buildHolidayCalendarButton() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 1,
            offset: const Offset(0, 1),
          ),
        ],
        border: Border.all(color: Colors.white.withOpacity(0.2)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            Positioned(
              right: -5,
              top: -5,
              child: Icon(
                Icons.event_note_outlined,
                size: 80,
                color: const Color(0xFF475569).withOpacity(0.05),
              ),
            ),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap:
                    () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const HrHolidayScreen(),
                      ),
                    ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF475569).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.event_note_outlined,
                          color: const Color(0xFF475569).withOpacity(0.8),
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              "Holiday Calendar",
                              style: TextStyle(
                                color: Color(0xFF1E293B),
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.3,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              "Configure company holidays",
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: Color(0xFF94A3B8),
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _exportAttendanceButton() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF00657F), Color(0xFF004E61)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00657F).withOpacity(0.2),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: _openDateRangePicker,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.file_download_outlined,
                  color: Colors.white,
                  size: 22,
                ),
                const SizedBox(width: 12),
                Text(
                  _selectedModel == 0
                      ? "Export Intern Report"
                      : "Export Employee Report",
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
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

  Future<void> _openDateRangePicker() async {
    final DateTime now = DateTime.now();

    final DateTimeRange? range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
      helpText: "Select Period",
      confirmText: "EXPORT",
    );

    if (range == null) return;

    if (_selectedModel == 0) {
      await _exportAllInternsExcel(fromDate: range.start, toDate: range.end);
    } else {
      await _exportAllEmployeesExcel(fromDate: range.start, toDate: range.end);
    }
  }

  Future<void> _exportAllInternsExcel({
    required DateTime fromDate,
    required DateTime toDate,
  }) async {
    try {
      await MediaStore.ensureInitialized();
      MediaStore.appFolder = "SoftPeople";

      final dio = Dio();
      final response = await dio.get(
        "${getBaseUrl()}/api/intern/export/excel",
        queryParameters: {
          "from": fromDate.toIso8601String(),
          "to": toDate.toIso8601String(),
        },
        options: Options(responseType: ResponseType.bytes),
      );

      final fileName =
          "All_Interns_data_${DateFormat('ddMMMyy').format(fromDate)}_${DateFormat('ddMMMyy').format(toDate)}.xlsx";

      final tempPath = await _createTempFile(response.data, fileName);

      final mediaStore = MediaStore();
      await mediaStore.saveFile(
        tempFilePath: tempPath,
        dirType: DirType.download,
        dirName: DirName.download,
        relativePath: "SoftPeople",
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Excel saved to Downloads/SoftPeople/$fileName"),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Intern data export failed"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _exportAllEmployeesExcel({
    required DateTime fromDate,
    required DateTime toDate,
  }) async {
    try {
      await MediaStore.ensureInitialized();
      MediaStore.appFolder = "SoftPeople";

      final dio = Dio();
      final response = await dio.get(
        "${getBaseUrl()}/api/employee/export/excel/all-employees",
        queryParameters: {
          "from": fromDate.toIso8601String(),
          "to": toDate.toIso8601String(),
        },
        options: Options(responseType: ResponseType.bytes),
      );

      final fileName =
          "All_Employees_Data_${DateFormat('ddMMMyy').format(fromDate)}_${DateFormat('ddMMMyy').format(toDate)}.xlsx";

      final tempPath = await _createTempFile(response.data, fileName);

      final mediaStore = MediaStore();
      await mediaStore.saveFile(
        tempFilePath: tempPath,
        dirType: DirType.download,
        dirName: DirName.download,
        relativePath: "SoftPeople",
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Excel saved to Downloads/SoftPeople/$fileName"),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Employee data export failed"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<String> _createTempFile(List<int> bytes, String fileName) async {
    final dir = await getTemporaryDirectory();
    final file = File("${dir.path}/$fileName");
    await file.writeAsBytes(bytes);
    return file.path;
  }

  final GlobalKey<_TodayAttendanceCardState> _internCardKey = GlobalKey();
  final GlobalKey<_EmployeeTodayAttendanceCardState> _employeeCardKey =
      GlobalKey();

  Future<void> _handleRefresh() async {
    // 1. Refresh core data (includes role/demotion check)
    await _initializeData();

    // 2. Refresh both cards
    final internRefresh = _internCardKey.currentState?.refresh();
    final employeeRefresh = _employeeCardKey.currentState?.refresh();

    // Wait for both to complete
    await Future.wait([
      internRefresh ?? Future.value(),
      employeeRefresh ?? Future.value(),
      Future.delayed(const Duration(milliseconds: 800)), // Minimum spin time
    ]);
  }

  Widget _internCards() {
    return Column(
      children: [
        _buildSectionHeader("Intern Management", Icons.people_outline),
        const SizedBox(height: 16),
        TodayAttendanceCard(
          key: _internCardKey,
          onTap:
              () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const TodayAttendancePage()),
              ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _buildManagerStyleBox(
              "Manage Intern",
              "Directory",
              Icons.groups_outlined,
              const Color(0xFF0D9488),
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const InternManagement()),
                  ),
            ),
            const SizedBox(width: 12),
            _buildManagerStyleBox(
              "Leave Requests",
              "Approvals",
              Icons.event_note_outlined,
              const Color(0xFFF59E0B),
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const InternLeaveApproval(),
                    ),
                  ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildManagerStyleBox(
              "Fund Approval",
              "HR Review",
              Icons.receipt_long_outlined,
              const Color(0xFF7C3AED),
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder:
                          (_) => const FundRequestApprovalPage(
                            role: FundApprovalRole.hr,
                          ),
                    ),
                  ),
            ),
            const SizedBox(width: 12),
            const Expanded(child: SizedBox()),
          ],
        ),
        const SizedBox(height: 24),
        _exportAttendanceButton(),
      ],
    );
  }

  /// Employee model quick cards (mirror of intern, use employee pages)
  Widget _employeeCards() {
    return Column(
      children: [
        _buildSectionHeader("Employee Management", Icons.badge_outlined),
        const SizedBox(height: 16),
        EmployeeTodayAttendanceCard(
          key: _employeeCardKey,
          onTap:
              () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const TodayEmployeeAttendancePage(),
                ),
              ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _buildManagerStyleBox(
              "Manage Staff",
              "Team Info",
              Icons.groups_outlined,
              const Color(0xFF0D9488),
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const EmployeeManagement(),
                    ),
                  ),
            ),
            const SizedBox(width: 12),
            _buildManagerStyleBox(
              "Leave Approval",
              "Requests",
              Icons.event_note_outlined,
              const Color(0xFFF59E0B),
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const EmployeeLeaveApproval(),
                    ),
                  ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildManagerStyleBox(
              "Fund Approval",
              "HR Review",
              Icons.receipt_long_outlined,
              const Color(0xFF7C3AED),
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder:
                          (_) => const FundRequestApprovalPage(
                            role: FundApprovalRole.hr,
                          ),
                    ),
                  ),
            ),
            const SizedBox(width: 12),
            const Expanded(child: SizedBox()),
          ],
        ),
        const SizedBox(height: 24),
        _exportAttendanceButton(),
      ],
    );
  }

  Widget _buildHrPunchCard() {
    final bool hasPunchedIn = _punchInTime != null;
    final bool hasPunchedOut = _punchOutTime != null;

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

    return SizedBox(
      width: double.infinity,
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

                ],
              ),
            ),
          ),

          // Button at the bottom of the stack (overlapping the padding)
          Center(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap:
                  _isPunchLoading
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

                          if (!hasPunchedIn) {
                            await punchIn();
                          } else if (!hasPunchedOut) {
                            await punchOut();
                          }
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
                  ), // Container
                ), // Material
              ), // GestureDetector
            ), // Center
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
                formatTimeDisplay(_punchInTime),
                iconColor: const Color(0xFF10B981),
              ),
              const SizedBox(height: 12),
              _buildSummaryRow(
                Icons.logout_rounded,
                "Punch Out",
                formatTimeDisplay(_punchOutTime),
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
    final durationText = _calculateDuration(_punchInTime, _punchOutTime);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          "Duration",
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1E293B),
          ),
        ),
        Text(
          durationText,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: Color(0xFF00657F),
          ),
        ),
      ],
    );
  }

  String _calculateDuration(String? inTime, String? outTime) {
    if (inTime == null || outTime == null) return "--:--";

    try {
      final start = DateTime.parse(inTime);
      final end = DateTime.parse(outTime);
      final diff = end.difference(start);

      final hours = diff.inHours.toString().padLeft(2, '0');
      final minutes = (diff.inMinutes % 60).toString().padLeft(2, '0');

      return "$hours h $minutes m";
    } catch (e) {
      return "--:--";
    }
  }

  String formatTimeDisplay(String? isoString) {
    if (isoString == null) return "--:--";

    try {
      final time = DateTime.parse(isoString).toLocal();
      return DateFormat("h:mm a").format(time);
    } catch (e) {
      return "--:--";
    }
  }
}

class TodayAttendanceCard extends StatefulWidget {
  final VoidCallback onTap;

  const TodayAttendanceCard({super.key, required this.onTap});

  @override
  State<TodayAttendanceCard> createState() => _TodayAttendanceCardState();
}

class _TodayAttendanceCardState extends State<TodayAttendanceCard> {
  late Future<List<dynamic>> _attendanceFuture;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  Future<void> refresh() async {
    _loadAttendance();
    await _attendanceFuture;
  }

  void _loadAttendance() {
    setState(() {
      _attendanceFuture = TodayAttendanceService.fetchTodayAttendance();
    });
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: _attendanceFuture,
      builder: (context, snapshot) {
        final attendance = snapshot.data ?? [];
        final punchedInCount =
            attendance.where((a) => a['punchInTime'] != null).length;

        return Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.9),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 1,
                offset: const Offset(0, 1),
              ),
            ],
            border: Border.all(color: Colors.white.withOpacity(0.2)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              children: [
                Positioned(
                  right: -5,
                  top: -5,
                  child: Icon(
                    Icons.how_to_reg_outlined,
                    size: 80,
                    color: const Color(0xFF3B82F6).withOpacity(0.06),
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: widget.onTap,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFF3B82F6).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.how_to_reg_outlined,
                              color: const Color(0xFF3B82F6).withOpacity(0.8),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  "Intern Attendance",
                                  style: TextStyle(
                                    color: Color(0xFF0F172A),
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.3,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  snapshot.connectionState ==
                                          ConnectionState.waiting
                                      ? "Loading stats..."
                                      : "$punchedInCount interns present today",
                                  style: const TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: Color(0xFF94A3B8),
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class EmployeeTodayAttendanceCard extends StatefulWidget {
  final VoidCallback onTap;

  const EmployeeTodayAttendanceCard({super.key, required this.onTap});

  @override
  State<EmployeeTodayAttendanceCard> createState() =>
      _EmployeeTodayAttendanceCardState();
}

class _EmployeeTodayAttendanceCardState
    extends State<EmployeeTodayAttendanceCard> {
  late Future<List<dynamic>> _attendanceFuture;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  Future<void> refresh() async {
    _loadAttendance();
    await _attendanceFuture;
  }

  void _loadAttendance() {
    setState(() {
      _attendanceFuture = TodayEmployeeAttendanceService.fetchTodayAttendance();
    });
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: _attendanceFuture,
      builder: (context, snapshot) {
        final attendance = snapshot.data ?? [];
        final punchedInCount =
            attendance.where((a) => a['punchInTime'] != null).length;

        return Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.9),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 1,
                offset: const Offset(0, 1),
              ),
            ],
            border: Border.all(color: Colors.white.withOpacity(0.2)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              children: [
                Positioned(
                  right: -5,
                  top: -5,
                  child: Icon(
                    Icons.badge_outlined,
                    size: 80,
                    color: const Color(0xFF3B82F6).withOpacity(0.06),
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: widget.onTap,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFF3B82F6).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.badge_outlined,
                              color: const Color(0xFF3B82F6).withOpacity(0.8),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  "Employee Attendance",
                                  style: TextStyle(
                                    color: Color(0xFF0F172A),
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.3,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  snapshot.connectionState ==
                                          ConnectionState.waiting
                                      ? "Loading stats..."
                                      : "$punchedInCount employees present today",
                                  style: const TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: Color(0xFF94A3B8),
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
