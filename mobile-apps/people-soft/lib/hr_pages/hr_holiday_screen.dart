import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import '../port.dart';
import '../holiday_pdf_viewer.dart';


class HrHolidayScreen extends StatefulWidget {
  const HrHolidayScreen({super.key});

  @override
  State<HrHolidayScreen> createState() => _HrHolidayScreenState();
}

class _HrHolidayScreenState extends State<HrHolidayScreen> {
  bool loading = true;

  // ================= REGULAR HOLIDAY =================
  int selectedDayIndex = -1;
  Set<int> selectedWeeks = {};
  Map<String, Set<int>> existingWeeklyHolidays = {};

  final days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  final weeks = ["1st Week", "2nd Week", "3rd Week", "4th Week", "5th Week"];

  // ================= SPECIAL HOLIDAY =================
  List<Map<String, dynamic>> specialHolidays = [];
  DateTime? fromDate;
  DateTime? toDate;
  final TextEditingController reasonCtrl = TextEditingController();
  String? editingSpecialId;

  // ================= SPECIAL HOLIDAY FILTER =================
  String filterMode = 'upcoming';
  int selectedYear = DateTime.now().year;
  int selectedMonth = DateTime.now().month;

  // Colors
  static const Color primaryColor = Color(0xFF00657F);
  static const Color primaryLight = Color(0xFF4A8A9A);
  static const Color accentColor = Color(0xFFFF6B6B);
  static const Color surfaceColor = Color(0xFFF8FAFC);

  // ================= API =================
  Future<void> fetchHolidays() async {
    if (mounted) setState(() => loading = true);
    try {
      final res = await http.get(Uri.parse("${getBaseUrl()}/api/holidays"));
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);

        existingWeeklyHolidays.clear();
        specialHolidays.clear();

        for (var item in data) {
          if (item['type'] == 'weekly') {
            final day = item['day'];
            final weeksSet = (item['weeks'] as List)
                .map((e) => e as int)
                .toSet();
            existingWeeklyHolidays[day] = weeksSet;
          } else if (item['type'] == 'special') {
            specialHolidays.add(item);
          }
        }
      }
    } catch (e) {}
    if (mounted) setState(() => loading = false);
  }

  List<Map<String, dynamic>> get _filteredSpecialHolidays {
    return specialHolidays.where((holiday) {
      final from = DateTime.parse(holiday['fromDate']);
      final to = DateTime.parse(holiday['toDate']);
      final today = DateTime.now();

      // Month/Year filter
      final matchesMonth =
          selectedMonth == 0 ||
          from.month == selectedMonth ||
          to.month == selectedMonth;

      final matchesYear =
          selectedYear == 0 ||
          from.year == selectedYear ||
          to.year == selectedYear;

      if (!matchesMonth || !matchesYear) return false;

      // Filter mode logic
      switch (filterMode) {
        case 'today':
          return from.year == today.year &&
              from.month == today.month &&
              from.day == today.day;
        case 'upcoming':
          return from.isAfter(today.subtract(const Duration(days: 1)));
        case 'past':
          return to.isBefore(today);
        default:
          return true;
      }
    }).toList();
  }

  bool get _isFormValid {
    if (fromDate == null || toDate == null || reasonCtrl.text.trim().isEmpty) {
      return false;
    }
    if (fromDate!.isAfter(toDate!)) return false;
    return true;
  }

  Future<void> saveWeeklyHoliday() async {
    if (selectedDayIndex == -1) {
      _showSnackBar("Please select a day first", Colors.orange);
      return;
    }

    final day = days[selectedDayIndex];
    final weeksList = selectedWeeks.isEmpty ? [] : selectedWeeks.toList();

    try {
      final res = await http.post(
        Uri.parse("${getBaseUrl()}/api/holidays"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"type": "weekly", "day": day, "weeks": weeksList}),
      );

      if (res.statusCode == 201 || res.statusCode == 200) {
        _showSnackBar(
          weeksList.isEmpty
              ? "Weekly holiday completely deleted"
              : "Weekly holidays updated",
          primaryColor,
        );
        await fetchHolidays();
        if (mounted) {
          setState(() {
            selectedDayIndex = -1;
            selectedWeeks.clear();
          });
        }
      } else {
        final errorData = jsonDecode(res.body);
        final errorMsg = errorData['message'] ?? "Error saving holiday";
        _showSnackBar(errorMsg, Colors.red);
      }
    } catch (e) {
      _showSnackBar("Network error", Colors.red);
    }
  }

  Future<void> saveSpecialHoliday() async {
    if (!_isFormValid) return;

    try {
      if (editingSpecialId != null) {
        final res = await http.put(
          Uri.parse("${getBaseUrl()}/api/holidays/$editingSpecialId"),
          headers: {"Content-Type": "application/json"},
          body: jsonEncode({
            "type": "special",
            "fromDate": fromDate!.toIso8601String(),
            "toDate": toDate!.toIso8601String(),
            "reason": reasonCtrl.text.trim(),
          }),
        );
        if (res.statusCode != 200) {
          throw Exception(jsonDecode(res.body)['message']);
        }
      } else {
        final res = await http.post(
          Uri.parse("${getBaseUrl()}/api/holidays"),
          headers: {"Content-Type": "application/json"},
          body: jsonEncode({
            "type": "special",
            "fromDate": fromDate!.toIso8601String(),
            "toDate": toDate!.toIso8601String(),
            "reason": reasonCtrl.text.trim(),
          }),
        );
        if (res.statusCode != 201) {
          throw Exception(jsonDecode(res.body)['message']);
        }
      }

      _showSnackBar("Special holiday saved", primaryColor);
      reasonCtrl.clear();
      fromDate = null;
      toDate = null;
      editingSpecialId = null;
      await fetchHolidays();
    } catch (e) {
      _showSnackBar("Error: ${e.toString()}", Colors.red);
    }
  }

  Future<void> _deleteHoliday(String id) async {
    try {
      final res = await http.delete(
        Uri.parse("${getBaseUrl()}/api/holidays/$id"),
      );
      if (res.statusCode == 200) {
        _showSnackBar("Holiday deleted", primaryColor);
        await fetchHolidays();
      }
    } catch (e) {}
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    fetchHolidays();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(
        backgroundColor: surfaceColor,
        body: const Center(
          child: CircularProgressIndicator(color: primaryColor),
        ),
      );
    }

    return Scaffold(
      backgroundColor: surfaceColor,
      appBar: AppBar(
        title: const Text(
          "Holiday Configuration",
          style: TextStyle(color: Colors.white),
        ),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildPdfViewCard(context),
              const SizedBox(height: 24),
              // ================= REGULAR HOLIDAY =================
              _buildSectionHeader("Regular Weekly Holidays"),
              const SizedBox(height: 16),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle("Select Day"),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: List.generate(days.length, (i) {
                        final day = days[i];
                        final hasHoliday =
                            existingWeeklyHolidays[day]?.isNotEmpty ?? false;
                        return ChoiceChip(
                          label: Text(day),
                          selected: selectedDayIndex == i || hasHoliday,
                          selectedColor: primaryColor.withOpacity(0.1),
                          backgroundColor: Colors.grey[100],
                          onSelected: (_) {
                            if (mounted) {
                              setState(() {
                                selectedDayIndex = i;
                                selectedWeeks =
                                    existingWeeklyHolidays[day]?.toSet() ?? {};
                              });
                            }
                          },
                        );
                      }),
                    ),
                  ],
                ),
              ),

              if (selectedDayIndex != -1) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionTitle("Select Weeks"),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: List.generate(weeks.length, (i) {
                          final weekNum = i + 1;
                          final selected = selectedWeeks.contains(weekNum);
                          return FilterChip(
                            label: Text(
                              weeks[i],
                              style: TextStyle(
                                color: selected
                                    ? Colors.white
                                    : Colors.grey[800],
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            selected: selected,
                            selectedColor: primaryColor,
                            checkmarkColor: Colors.white,
                            backgroundColor: Colors.grey[100],
                            onSelected: (v) {
                              if (mounted) {
                                setState(() {
                                  v
                                      ? selectedWeeks.add(weekNum)
                                      : selectedWeeks.remove(weekNum);
                                });
                              }
                            },
                          );
                        }),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryColor,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 2,
                          ),
                          onPressed: selectedDayIndex != -1
                              ? saveWeeklyHoliday
                              : null,
                          child: Text(
                            selectedDayIndex != -1 &&
                                    existingWeeklyHolidays[days[selectedDayIndex]]
                                            ?.isNotEmpty ==
                                        true
                                ? selectedWeeks.isEmpty
                                      ? "Delete Weekly Holiday"
                                      : "Update Weekly Holiday"
                                : "Save Weekly Holiday",
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 32),
              Divider(color: Colors.grey[300], thickness: 1.5),
              const SizedBox(height: 24),

              // ================= SPECIAL HOLIDAY WITH FILTER =================
              _buildSectionHeader("Special Holidays"),
              const SizedBox(height: 16),

              // Filter Controls
              // Filter Controls
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle("Filter"),
                    const SizedBox(height: 12),

                    // Filter Mode Toggle
                    _buildFilterToggle(),

                    const SizedBox(height: 16),

                    // Month/Year Picker Row
                    Row(
                      children: [
                        Expanded(child: _buildMonthDropdown()),
                        const SizedBox(width: 4),
                        Expanded(child: _buildYearDropdown()),
                      ],
                    ),

                    const SizedBox(height: 8),
                    Text(
                      "${_filteredSpecialHolidays.length} holidays found",
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),

              // Filtered List
              if (_filteredSpecialHolidays.isNotEmpty) ...[
                const SizedBox(height: 16),
                ..._filteredSpecialHolidays.map((h) => _buildHolidayCard(h)),
                const SizedBox(height: 20),
              ] else ...[
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      // ← Already centered inside
                      mainAxisSize: MainAxisSize.min, // ← SHRINK TO FIT CONTENT
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.event_busy,
                          size: 32,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 12),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                          ), // ← TEXT LIMIT WIDTH
                          child: Text(
                            "No ${_filterModeLabel()} holidays found",
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[700],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],

              // Add/Edit form
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle("Add Special Holiday"),
                    const SizedBox(height: 16),
                    TextField(
                      controller: reasonCtrl,
                      decoration: InputDecoration(
                        labelText: "Reason (Pongal, Christmas, etc.)",
                        prefixIcon: Icon(Icons.event_note, color: primaryColor),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: primaryColor, width: 2),
                        ),
                        filled: true,
                        fillColor: Colors.grey[50],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: _buildDateButton(
                            label: fromDate == null
                                ? "From Date"
                                : fromDate!.toLocal().toString().split(" ")[0],
                            icon: Icons.calendar_today,
                            onTap: () => _selectDate(true),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildDateButton(
                            label: toDate == null
                                ? "To Date"
                                : toDate!.toLocal().toString().split(" ")[0],
                            icon: Icons.calendar_today,
                            onTap: () => _selectDate(false),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isFormValid
                              ? primaryColor
                              : Colors.grey[400],
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: _isFormValid ? 2 : 0,
                        ),
                        onPressed: _isFormValid ? saveSpecialHoliday : null,
                        icon: Icon(
                          editingSpecialId != null ? Icons.save : Icons.add,
                        ),
                        label: Text(
                          editingSpecialId == null
                              ? "Add Special Holiday"
                              : "Update Special Holiday",
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    if (fromDate != null &&
                        toDate != null &&
                        fromDate!.isAfter(toDate!))
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          "❌ From date must be before To date",
                          style: TextStyle(color: Colors.red, fontSize: 12),
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

  // ================= FILTER WIDGETS =================
  String _filterModeLabel() {
    switch (filterMode) {
      case 'today':
        return 'today\'s';
      case 'upcoming':
        return 'upcoming';
      case 'past':
        return 'past';
      default:
        return 'matching';
    }
  }

  Widget _buildFilterToggle() {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => filterMode = 'today'),
              child: Container(
                decoration: BoxDecoration(
                  color: filterMode == 'today'
                      ? primaryColor
                      : Colors.transparent,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(22),
                    bottomLeft: Radius.circular(22),
                  ),
                ),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  "Today",
                  style: TextStyle(
                    color: filterMode == 'today'
                        ? Colors.white
                        : Colors.grey[700],
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => filterMode = 'upcoming'),
              child: Container(
                decoration: BoxDecoration(
                  color: filterMode == 'upcoming'
                      ? primaryColor
                      : Colors.transparent,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(22),
                    bottomLeft: Radius.circular(22),
                    topRight: Radius.circular(22),
                    bottomRight: Radius.circular(22),
                  ),
                ),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  "Upcoming",
                  style: TextStyle(
                    color: filterMode == 'upcoming'
                        ? Colors.white
                        : Colors.grey[700],
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => filterMode = 'past'),
              child: Container(
                decoration: BoxDecoration(
                  color: filterMode == 'past'
                      ? primaryColor
                      : Colors.transparent,
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(22),
                    bottomRight: Radius.circular(22),
                  ),
                ),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  "Past",
                  style: TextStyle(
                    color: filterMode == 'past'
                        ? Colors.white
                        : Colors.grey[700],
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthDropdown() {
    return DropdownButtonFormField<int>(
      initialValue: selectedMonth,
      decoration: InputDecoration(
        labelText: "Month",
        // prefixIcon removed to save space
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: primaryColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        filled: true,
        fillColor: Colors.grey[50],
      ),
      items: [
        const DropdownMenuItem<int>(value: 0, child: Text('All Months')),
        ...List.generate(
          12,
          (index) => DropdownMenuItem<int>(
            value: index + 1,
            child: Text(_getMonthName(index + 1)),
          ),
        ),
      ],
      onChanged: (value) {
        if (value != null) {
          setState(() {
            selectedMonth = value;
          });
        }
      },
    );
  }

  Widget _buildYearDropdown() {
    final currentYear = DateTime.now().year;
    final years = List.generate(6, (i) => currentYear - i);

    return DropdownButtonFormField<int>(
      initialValue: years.contains(selectedYear) ? selectedYear : currentYear,
      decoration: InputDecoration(
        labelText: "Year",
        // prefixIcon removed to save space
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: primaryColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        filled: true,
        fillColor: Colors.grey[50],
      ),
      items: years
          .map(
            (year) => DropdownMenuItem<int>(
              value: year,
              child: Text(year.toString()),
            ),
          )
          .toList(),
      onChanged: (value) {
        if (value != null) {
          setState(() {
            selectedYear = value;
          });
        }
      },
    );
  }

  String _getMonthName(int month) {
    const months = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[month];
  }

  Widget _buildHolidayCard(Map<String, dynamic> h) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        title: Text(
          h['reason'],
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          "${h['fromDate'].split("T")[0]} to ${h['toDate'].split("T")[0]}",
          style: TextStyle(
            color: Colors.grey[600],
            fontWeight: FontWeight.w500,
          ),
        ),
        trailing: PopupMenuButton<String>(
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          onSelected: (value) {
            if (value == 'edit') {
              if (mounted) {
                setState(() {
                  editingSpecialId = h['_id'];
                  reasonCtrl.text = h['reason'];
                  fromDate = DateTime.parse(h['fromDate']);
                  toDate = DateTime.parse(h['toDate']);
                });
              }
            } else if (value == 'delete') {
              _deleteHoliday(h['_id']);
            }
          },
          itemBuilder: (context) => [
            PopupMenuItem(
              value: 'edit',
              child: const Row(
                children: [
                  Icon(Icons.edit, size: 20),
                  SizedBox(width: 12),
                  Text('Edit'),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'delete',
              child: Row(
                children: [
                  Icon(Icons.delete, size: 20, color: Colors.red),
                  const SizedBox(width: 12),
                  Text('Delete', style: TextStyle(color: Colors.red)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDateButton({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(icon, color: primaryColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios,
                  size: 16,
                  color: Colors.grey[400],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _selectDate(bool isFromDate) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isFromDate ? fromDate : toDate) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      builder: (context, child) {
        return Theme(
          data: Theme.of(
            context,
          ).copyWith(colorScheme: ColorScheme.light(primary: primaryColor)),
          child: child!,
        );
      },
    );
    if (picked != null) {
      if (mounted) {
        setState(() {
          if (isFromDate) {
            fromDate = picked;
            if (toDate != null && fromDate!.isAfter(toDate!)) {
              toDate = fromDate;
            }
          } else {
            toDate = picked;
          }
        });
      }
    }
  }

  Widget _buildSectionHeader(String title) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 24,
          decoration: BoxDecoration(
            color: primaryColor,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: primaryColor,
          ),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: Colors.grey[800],
      ),
    );
  }

  Widget _buildPdfViewCard(BuildContext context) {
    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const HolidayPdfViewer(
              pdfPath: 'assets/pdf/Softrate_India_Holiday_List.pdf',
              title: "Official Holiday List",
            ),
          ),
        );
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [primaryColor, primaryLight],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: primaryColor.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.picture_as_pdf_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Official Holiday Reference",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    "View official PDF list",
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Colors.white,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
