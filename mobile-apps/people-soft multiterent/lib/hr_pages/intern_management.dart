import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/hr_pages/InternFullDetails.dart';
import 'package:hrmappfrontend/hr_pages/intern_leave_overview.dart';
import 'package:hrmappfrontend/hr_pages/intern_review.dart';
import 'package:hrmappfrontend/hr_pages/hrInternAttendanceDetails.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import 'package:media_store_plus/media_store_plus.dart';
import 'package:path_provider/path_provider.dart';

class InternManagement extends StatefulWidget {
  const InternManagement({super.key});

  @override
  State<InternManagement> createState() => _InternManagementState();
}

class _InternManagementState extends State<InternManagement> {
  // Active interns
  late Future<List<Intern>> _interns;
  String _range = 'thisMonth'; // thisMonth, sixMonths, all
  String _status = 'all'; // all, approved, ongoing
  int? _expandedIndex;

  // Past-out interns
  late Future<List<PastOutIntern>> _pastOut;
  int _selectedYear = DateTime.now().year;
  int _selectedMonth = 0; // ✅ ALL MONTHS// 1–12, 0 = all months

  @override
    void initState() {
      super.initState();
      _interns = fetchActiveInterns(range: _range, status: _status);
      _pastOut = fetchPastOutInterns(
        year: _selectedYear,
        month: _selectedMonth, // now 0
      );
      debugPrint(
      'PASTOUT REQUEST -> year=$_selectedYear month=$_selectedMonth'
    );

  }


  // ========= API CALLS =========

  Future<List<Intern>> fetchActiveInterns({
    required String range,
    required String status,
  }) async {
    final uri = Uri.parse('${getBaseUrl()}/api/intern/all/active').replace(
      queryParameters: {
        'range': range,
        'status': status,
      },
    );
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as List;
      return data.map((json) => Intern.fromJson(json)).toList();
    }
    throw Exception('Failed to fetch active interns');
  }
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

  await _exportAllInternsAttendanceExcel(
    fromDate: picked.start,
    toDate: picked.end,
  );
}

Future<void> _exportAllInternsAttendanceExcel({
  required DateTime fromDate,
  required DateTime toDate,
}) async {
  try {
    await MediaStore.ensureInitialized();
    MediaStore.appFolder = "SoftPeople";

    final dio = Dio();
    final response = await dio.get(
      "${getBaseUrl()}/api/attendance/export/excel/all-interns",
      queryParameters: {
        "from": fromDate.toIso8601String(),
        "to": toDate.toIso8601String(),
      },
      options: Options(responseType: ResponseType.bytes),
    );

    final fileName =
        "All_Interns_Attendance_${DateFormat('ddMMMyy').format(fromDate)}_${DateFormat('ddMMMyy').format(toDate)}.xlsx";

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
      SnackBar(content: Text("Excel file saved to Downloads/SoftPeople/$fileName")),
    );
  } catch (e) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("Excel export failed"), backgroundColor: Colors.red),
    );
  }
}

Future<String> _createTempFile(List<int> bytes, String fileName) async {
    final dir = await getTemporaryDirectory();
    final file = File("${dir.path}/$fileName");
    await file.writeAsBytes(bytes);
    return file.path;
  }

  Future<List<PastOutIntern>> fetchPastOutInterns({
  required int year,
  required int month,
}) async {
  final uri = Uri.parse('${getBaseUrl()}/api/intern/pastout').replace(
    queryParameters: {
      'year': year.toString(),
      'month': month.toString(),
    },
  );

  final response = await http.get(uri);
  debugPrint('pastout GET -> ${response.statusCode} ${response.body}');

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body) as List;
    return data.map((e) => PastOutIntern.fromJson(e)).toList();
  }

  throw Exception(
      'Failed to fetch past-out interns: ${response.statusCode} ${response.body}');
}


  // ========= COMMON BADGE =========

  Widget statusBadge(String status) {
    Color color;
    switch (status.toLowerCase()) {
      case 'approved':
      case 'accepted':
        color = const Color(0xFF2E7D32);
        break;
      case 'ongoing':
        color = const Color(0xFF00657F);
        break;
      case 'drop':
      case 'rejected':
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
            'Manage Interns',
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
                  _buildActiveInternsTab(),
                  _buildPastOutTab(),
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
        unselectedLabelStyle:
            const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        tabs: const [
          Tab(text: 'Active'),
          Tab(text: 'Past-out'),
        ],
      ),
    );
  }

  // ========= TAB 1: ACTIVE INTERNS =========

  Widget _buildActiveInternsTab() {
    return Column(
      children: [
        const SizedBox(height: 8),
        _buildFilterRow(),
        Expanded(
          child: FutureBuilder<List<Intern>>(
            future: _interns,
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
                        'No interns found for this filter',
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

              final interns = snapshot.data!;
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                itemCount: interns.length,
                itemBuilder: (context, index) {
                  final intern = interns[index];
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
                      data: Theme.of(context)
                          .copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        initiallyExpanded: _expandedIndex == index,
                        maintainState: false,
                        onExpansionChanged: (expanded) {
                          setState(() {
                            _expandedIndex = expanded ? index : null;
                          });
                        },
                        tilePadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
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
                              intern.fullName.isNotEmpty
                                  ? intern.fullName[0].toUpperCase()
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
                          intern.fullName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                            color: Color(0xFF1D1D1F),
                          ),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4.0),
                          child: Text(
                            'ID: ${intern.internId}',
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
                            statusBadge(intern.status),
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
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            HrInternAttendanceDetails(
                                          internId: intern.internId,
                                          internName: intern.fullName,
                                        ),
                                      ),
                                    );
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
                                        builder: (_) => InternLeaveOverview(
                                          internId: intern.internId,
                                          internName: intern.fullName,
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
                                        builder: (_) => InternReview(
                                          internId: intern.internId,
                                          internName: intern.fullName,
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
                                        builder: (_) => InternFullDetails(
                                          internId: intern.internId,
                                        ),
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
                          colors: [
                            Colors.white.withOpacity(0.0),
                            Colors.white,
                          ],
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
                  DropdownMenuItem(value: 'ongoing', child: Text('Ongoing')),
                  DropdownMenuItem(value: 'remote', child: Text('Remote')),
                ],
                onChanged: (val) {
                  if (val == null) return;
                  setState(() {
                    _status = val;
                    _interns =
                        fetchActiveInterns(range: _range, status: _status);
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
      _interns = fetchActiveInterns(range: _range, status: _status);
    });
  }

  // ========= TAB 2: PAST-OUT INTERNS =========

  Widget _buildPastOutTab() {
    return Column(
      children: [
        const SizedBox(height: 8),
        _buildPastOutFilterRow(),
        Expanded(
          child: FutureBuilder<List<PastOutIntern>>(
            future: _pastOut,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text('Error: ${snapshot.error}'));
              }
              if (!snapshot.hasData || snapshot.data!.isEmpty) {
                return const Center(
                  child: Text(
                    'No past‑out interns for this filter',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF757575),
                    ),
                  ),
                );
              }

              final interns = snapshot.data!;
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                itemCount: interns.length,
                itemBuilder: (context, index) {
                  final intern = interns[index];
                  return Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    elevation: 1,
                    clipBehavior: Clip.antiAlias,
                    child: Theme(
                      data: Theme.of(context).copyWith(
                        dividerColor: Colors.transparent,
                      ),
                      child: ExpansionTile(
                        tilePadding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
                        title: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    intern.fullName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'ID: ${intern.internId} • ${intern.department}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF757575),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            statusBadge(intern.status),
                          ],
                        ),
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            color: const Color(0xFFF8FAFC),
                            child: Column(
                              children: [
                                _buildDetailRow(Icons.school_rounded, 'College', intern.college),
                                _buildDetailRow(Icons.calendar_today_rounded, 'Year', intern.year),
                                _buildDetailRow(Icons.work_rounded, 'Role', intern.role),
                                _buildDetailRow(Icons.email_rounded, 'Email', intern.email),
                                _buildDetailRow(Icons.phone_rounded, 'Contact', intern.contact),
                                _buildDetailRow(Icons.emergency_rounded, 'Emergency Contact', intern.emergencyContact),
                                _buildDetailRow(Icons.event_available_rounded, 'Onboarding Date', intern.onboardingDate.split('T').first),
                                _buildDetailRow(Icons.event_busy_rounded, 'End Date', intern.endDate.split('T').first),
                                _buildDetailRow(Icons.category_rounded, 'Type', '${intern.internshipType} • ${intern.applicationType}'),
                                _buildDetailRow(Icons.link_rounded, 'LinkedIn', intern.linkedin.isNotEmpty ? 'View Profile' : 'N/A'),
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

  Widget _buildPastOutFilterRow() {
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
                    _pastOut = fetchPastOutInterns(
                      year: _selectedYear,
                      month: _selectedMonth,
                    );
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
                    _pastOut = fetchPastOutInterns(
                      year: _selectedYear,
                      month: _selectedMonth,
                    );
                  });
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    if (value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: const Color(0xFF475569)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ========= MODELS =========

class Intern {
  final String internId;
  final String fullName;
  final String status;

  Intern({
    required this.internId,
    required this.fullName,
    required this.status,
  });

  factory Intern.fromJson(Map<String, dynamic> json) {
    return Intern(
      internId: json['internid'] ?? '',
      fullName: json['fullName'] ?? '',
      status: json['status'] ?? '',
    );
  }
}

class PastOutIntern {
  final String internId;
  final String fullName;
  final String department;
  final String endDate;
  final String status;
  final String college;
  final String year;
  final String role;
  final String email;
  final String contact;
  final String emergencyContact;
  final String onboardingDate;
  final String linkedin;
  final String internshipType;
  final String applicationType;
  final int leaveCount;

  PastOutIntern({
    required this.internId,
    required this.fullName,
    required this.department,
    required this.endDate,
    required this.status,
    this.college = '',
    this.year = '',
    this.role = '',
    this.email = '',
    this.contact = '',
    this.emergencyContact = '',
    this.onboardingDate = '',
    this.linkedin = '',
    this.internshipType = '',
    this.applicationType = '',
    this.leaveCount = 0,
  });

  factory PastOutIntern.fromJson(Map<String, dynamic> json) {
    return PastOutIntern(
      internId: json['internid'] ?? json['internId'] ?? '',
      fullName: json['fullName'] ?? '',
      department: json['department'] ?? '',
      endDate: json['endDate'] ?? '',
      status: json['status'] ?? '',
      college: json['college'] ?? '',
      year: json['year'] ?? '',
      role: json['role'] ?? '',
      email: json['email'] ?? '',
      contact: json['contact'] ?? '',
      emergencyContact: json['emergencyContact'] ?? '',
      onboardingDate: json['onboardingDate'] ?? '',
      linkedin: json['linkedin'] ?? '',
      internshipType: json['internshipType'] ?? '',
      applicationType: json['applicationType'] ?? '',
      leaveCount: json['leaveCount'] ?? 0,
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3), width: 1.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

}
