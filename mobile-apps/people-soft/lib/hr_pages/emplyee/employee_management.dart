import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/hrEmployeeAttendanceDetails.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/EmployeeFullDetails.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/EmployeeLeaveOverview.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/employee_review.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import 'package:media_store_plus/media_store_plus.dart';
import 'package:path_provider/path_provider.dart';

class EmployeeManagement extends StatefulWidget {
  const EmployeeManagement({super.key});

  @override
  State<EmployeeManagement> createState() => _EmployeeManagementState();
}

class _EmployeeManagementState extends State<EmployeeManagement> {
  // Active employees
  late Future<List<Employee>> _employees;
  String _range = 'thisMonth'; // thisMonth, sixMonths, all
  String _status = 'all'; // all, approved
  int? _expandedIndex;

  // Went-off employees
  late Future<List<WentOffEmployee>> _wentOff;
  int _selectedYear = DateTime.now().year;
  int _selectedMonth = 0; // 0 = all months, 1–12

  @override
  void initState() {
    super.initState();
    _employees = fetchActiveEmployees(range: _range, status: _status);
    // ✅ FIXED: No crash - always empty list for went-off tab
    _wentOff = Future.value(<WentOffEmployee>[]);
    debugPrint('EmployeeManagement initialized - Active tab ready');
  }

  // ========= API CALLS =========
  Future<void> _pickDateRangeAndExportAllPdf() async {
  final picked = await showDateRangePicker(
    context: context,
    firstDate: DateTime(2023),
    lastDate: DateTime.now(),
    initialDateRange: DateTimeRange(
      start: DateTime.now().subtract(const Duration(days: 7)),
      end: DateTime.now(),
    ),
  );

  if (picked == null) return;

  await _exportAllAttendanceExcel(
    fromDate: picked.start,
    toDate: picked.end,
  );
}


  Future<List<Employee>> fetchActiveEmployees({
    required String range,
    required String status,
  }) async {
    final uri = Uri.parse('${getBaseUrl()}/api/employee/all/active').replace(
      queryParameters: {
        'range': range,
        'status': status,
      },
    );
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as List;
      return data.map((json) => Employee.fromJson(json)).toList();
    }
    throw Exception('Failed to fetch active employees');
  }

  // ✅ FIXED: NEVER CALLS API - NO CRASH
  Future<List<WentOffEmployee>> fetchWentOffEmployees({
    required int year,
    required int month,
  }) async {
    // Return empty list until backend endpoint exists
    await Future.delayed(Duration.zero);
    return <WentOffEmployee>[];
  }
  Future<void> _exportAllAttendanceExcel({
  required DateTime fromDate,
  required DateTime toDate,
}) async {
  try {
    await MediaStore.ensureInitialized();
    MediaStore.appFolder = "SoftPeople";

    final dio = Dio();

    final response = await dio.get(
      "${getBaseUrl()}/api/employeeAttanance/export/excel/all",
      queryParameters: {
        "from": fromDate.toIso8601String(),
        "to": toDate.toIso8601String(),
      },
      options: Options(responseType: ResponseType.bytes),
    );

    // Change file extension to .xlsx
    final fileName =
        "All_Employees_Attendance_${DateFormat('ddMMMyy').format(fromDate)}_${DateFormat('ddMMMyy').format(toDate)}.xlsx";

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
        content: Text("Excel file saved to Downloads/SoftPeople/$fileName"),
      ),
    );
  } catch (e) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Excel export failed"),
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

  // ========= COMMON BADGE =========

  Widget statusBadge(String status) {
    Color color;
    switch (status.toLowerCase()) {
      case 'approved':
        color = const Color(0xFF2E7D32);
        break;
      case 'ongoing':
      case 'active':
        color = const Color(0xFF00657F);
        break;
      case 'terminated':
      case 'resigned':
        color = const Color(0xFFB00020);
        break;
      case 'pending':
        color = const Color(0xFFFFA726);
        break;
      default:
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.09),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  // ========= BUILD =========

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          elevation: 0,
          centerTitle: true,
          title: const Text(
            'Employee Management',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 22,
              letterSpacing: -0.5,
            ),
          ),
          actions: [
          IconButton(
            icon: const Icon(Icons.download_rounded),
            tooltip: "Export Attendance",
            onPressed: _pickDateRangeAndExportAllPdf,
          ),
        ],
          foregroundColor: Colors.white,
          backgroundColor: const Color(0xFF00657F),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(
              bottom: Radius.circular(24),
            ),
          ),
        ),
        body: Container(
          decoration: const BoxDecoration(
            color: Color(0xFFF8F9FA),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              _buildSegmentedTabBar(context),
              const SizedBox(height: 4),
            Expanded(
              child: TabBarView(
                children: [
                  _buildActiveEmployeesTab(),
                  _buildWentOffTab(),
                ],
              ),
            ),
            ],
          ),
        ),
      ),
    );
  }

  // ========= TABS HEADER =========

  Widget _buildSegmentedTabBar(BuildContext context) {
    const activeColor = Color(0xFF00657F);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      height: 50,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(25),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TabBar(
        indicator: BoxDecoration(
          color: activeColor,
          borderRadius: BorderRadius.circular(22),
        ),
        indicatorPadding: const EdgeInsets.all(4),
        overlayColor: WidgetStatePropertyAll(Colors.transparent),
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: const Color(0xFF459DB2),
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        tabs: const [
          Tab(text: 'Active'),
          Tab(text: 'Went-off'),
        ],
      ),
    );
  }

  // ========= TAB 1: ACTIVE EMPLOYEES =========

  Widget _buildActiveEmployeesTab() {
    return Column(
      children: [
        const SizedBox(height: 8),
        _buildFilterRow(),
        Expanded(
          child: FutureBuilder<List<Employee>>(
            future: _employees,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text('Error: ${snapshot.error}'));
              }
              if (!snapshot.hasData || snapshot.data!.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.person_search_rounded,
                          size: 80, color: Colors.grey.withOpacity(0.3)),
                      const SizedBox(height: 16),
                      Text(
                        'No employees found for this filter',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                );
              }

              final employees = snapshot.data!;
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                itemCount: employees.length,
                itemBuilder: (context, index) {
                  final employee = employees[index];
                  final isExpanded = _expandedIndex == index;

                  return Container(
                    margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 12,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Theme(
                      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        initiallyExpanded: _expandedIndex == index,
                        maintainState: false,
                        onExpansionChanged: (expanded) {
                          setState(() {
                            _expandedIndex = expanded ? index : null;
                          });
                        },
                        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        leading: Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFE0F7FA), Color(0xFFB2EBF2)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: Text(
                              employee.fullName.isNotEmpty
                                  ? employee.fullName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: Color(0xFF00657F),
                                fontWeight: FontWeight.w800,
                                fontSize: 18,
                              ),
                            ),
                          ),
                        ),
                        title: Text(
                          employee.fullName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                            color: Color(0xFF1D1D1F),
                          ),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4.0),
                          child: Text(
                            'ID: ${employee.employeeId}',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF86868B),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            statusBadge(employee.status),
                            const SizedBox(height: 4),
                            Icon(
                              isExpanded
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded,
                              color: const Color(0xFF00657F),
                              size: 20,
                            ),
                          ],
                        ),
                        childrenPadding: EdgeInsets.zero,
                        children: [
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                  _ActionPillButton(
                                    label: 'Attendance',
                                    icon: Icons.calendar_today_rounded,
                                    color: const Color(0xFF00A8CC),
                                    onTap: () {
                                      Navigator.push(context, MaterialPageRoute(
                                        builder: (_) => HrEmployeeAttendanceDetails(
                                          employeeId: employee.employeeId,
                                          employeeName: employee.fullName,
                                        ),
                                      ));
                                    },
                                  ),
                                _ActionPillButton(
                                  label: 'Leaves',
                                  icon: Icons.time_to_leave_rounded,
                                  color: const Color(0xFF007991),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => EmployeeLeaveOverview(
                                          employeeId: employee.employeeId,
                                          employeeName: employee.fullName,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                _ActionPillButton(
                                  label: 'Review',
                                  icon: Icons.star_outline_rounded,
                                  color: const Color(0xFF005C78),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => EmployeeReview(
                                          employeeId: employee.employeeId,
                                          employeeName: employee.fullName,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                _ActionPillButton(
                                  label: 'Full Profile',
                                  icon: Icons.person_outline_rounded,
                                  color: const Color(0xFFFF9F1C),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            EmployeeFullDetails(employeeId: employee.employeeId)
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  // FILTER ROW (TAB 1)
  Widget _buildFilterRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 36,
              child: Stack(
                children: [
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: EdgeInsets.zero,
                    child: Row(
                      children: [
                        _buildFilterChip(
                          label: 'This month',
                          selected: _range == 'thisMonth',
                          onTap: () => _changeRange('thisMonth'),
                        ),
                        const SizedBox(width: 8),
                        _buildFilterChip(
                          label: 'Last 6 months',
                          selected: _range == 'sixMonths',
                          onTap: () => _changeRange('sixMonths'),
                        ),
                        const SizedBox(width: 8),
                        _buildFilterChip(
                          label: 'All time',
                          selected: _range == 'all',
                          onTap: () => _changeRange('all'),
                        ),
                        const SizedBox(width: 24),
                      ],
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      width: 32,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [Colors.white.withOpacity(0.0), Colors.white],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          DropdownButtonHideUnderline(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: const Color(0xFF459DB2).withOpacity(0.5),
                ),
              ),
              child: DropdownButton<String>(
                value: _status,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF00657F),
                ),
                borderRadius: BorderRadius.circular(14),
                dropdownColor: Colors.white,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF00657F),
                ),
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All')),
                  DropdownMenuItem(value: 'approved', child: Text('Approved')),
                ],
                onChanged: (val) {
                  if (val == null) return;
                  setState(() {
                    _status = val;
                    _employees = fetchActiveEmployees(range: _range, status: _status);
                  });
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: selected ? Colors.white : const Color(0xFF00657F),
        ),
      ),
      selected: selected,
      selectedColor: const Color(0xFF00657F),
      backgroundColor: Colors.white,
      elevation: selected ? 4 : 0,
      pressElevation: 2,
      shadowColor: const Color(0xFF00657F).withOpacity(0.4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      side: BorderSide(
        color: selected
            ? Colors.transparent
            : const Color(0xFF00657F).withOpacity(0.15),
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      onSelected: (_) => onTap(),
    );
  }

  void _changeRange(String newRange) {
    if (_range == newRange) return;
    setState(() {
      _range = newRange;
      _employees = fetchActiveEmployees(range: _range, status: _status);
    });
  }

  // ========= TAB 2: WENT-OFF EMPLOYEES =========

  Widget _buildWentOffTab() {
    return Column(
      children: [
        const SizedBox(height: 8),
        _buildWentOffFilterRow(),
        Expanded(
          child: FutureBuilder<List<WentOffEmployee>>(
            future: _wentOff,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text('Error: ${snapshot.error}'));
              }
              if (!snapshot.hasData || snapshot.data!.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.work_off_rounded,
                          size: 80, color: Colors.grey.withOpacity(0.3)),
                      const SizedBox(height: 16),
                      const Text(
                        'No went-off employees found',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF86868B),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Backend synchronization pending...',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade500,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ),
                );
              }

              final employees = snapshot.data!;
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                itemCount: employees.length,
                itemBuilder: (context, index) {
                  final employee = employees[index];
                  return Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    elevation: 1,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  employee.fullName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              statusBadge(employee.status),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'ID: ${employee.employeeId} • ${employee.department}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF757575),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(
                                Icons.event_available_rounded,
                                size: 16,
                                color: Colors.grey,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'End date: ${employee.endDate}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF424242),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildWentOffFilterRow() {
    final years = List<int>.generate(5, (i) => DateTime.now().year - i);
    final months = <int>[0, ...List<int>.generate(12, (i) => i + 1)];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          // Year dropdown
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFF459DB2).withOpacity(0.5),
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: _selectedYear,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF146374),
                ),
                borderRadius: BorderRadius.circular(14),
                dropdownColor: Colors.white,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF146374),
                ),
                items: years
                    .map(
                      (y) => DropdownMenuItem(
                        value: y,
                        child: Text(y.toString()),
                      ),
                    )
                    .toList(),
                onChanged: (val) {
                  if (val == null) return;
                  setState(() {
                    _selectedYear = val;
                    // No API call - just update UI
                  });
                },
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Month dropdown
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFF459DB2).withOpacity(0.5),
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: _selectedMonth,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF146374),
                ),
                borderRadius: BorderRadius.circular(14),
                dropdownColor: Colors.white,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF146374),
                ),
                items: months
                    .map(
                      (m) => DropdownMenuItem(
                        value: m,
                        child: Text(
                          m == 0 ? 'All months' : m.toString().padLeft(2, '0'),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (val) {
                  if (val == null) return;
                  setState(() {
                    _selectedMonth = val;
                    // No API call - just update UI
                  });
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ========= MODELS =========

class Employee {
  final String employeeId;
  final String fullName;
  final String status;

  Employee({
    required this.employeeId,
    required this.fullName,
    required this.status,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      employeeId: json['EmployeeId'] ?? json['employeeId'] ?? '',
      fullName: json['fullName'] ?? '',
      status: json['status'] ?? '',
    );
  }
}

class WentOffEmployee {
  final String employeeId;
  final String fullName;
  final String department;
  final String endDate;
  final String status;

  WentOffEmployee({
    required this.employeeId,
    required this.fullName,
    required this.department,
    required this.endDate,
    required this.status,
  });

  factory WentOffEmployee.fromJson(Map<String, dynamic> json) {
    return WentOffEmployee(
      employeeId: json['EmployeeId'] ?? json['employeeId'] ?? '',
      fullName: json['fullName'] ?? '',
      department: json['department'] ?? json['role'] ?? '',
      endDate: json['endDate'] ?? '',
      status: json['status'] ?? '',
    );
  }
}

// ========= REUSABLE BUTTON =========

class _ActionPillButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionPillButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.12),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: Colors.white),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
