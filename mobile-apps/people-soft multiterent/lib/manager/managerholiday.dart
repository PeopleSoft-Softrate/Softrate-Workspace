import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import '../port.dart';

class ManagerHolidayCalendarPage extends StatefulWidget {
  const ManagerHolidayCalendarPage({super.key});

  @override
  State<ManagerHolidayCalendarPage> createState() =>
      _ManagerHolidayCalendarPageState();
}

class _ManagerHolidayCalendarPageState
    extends State<ManagerHolidayCalendarPage> {
  bool _isLoading = true;
  List<dynamic> _allRawHolidays = [];
  List<Map<String, String>> _filteredHolidays = [];

  // Filter State
  String _filterMode = 'upcoming'; // 'all', 'today', 'upcoming', 'past'
  int _selectedMonth = 0; // 0 for All
  int _selectedYear = DateTime.now().year;

  final List<String> _months = [
    'All Months',
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

  final List<int> _years = [
    DateTime.now().year - 1,
    DateTime.now().year,
    DateTime.now().year + 1,
  ];

  // Sophisticated Management Palette
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  @override
  void initState() {
    super.initState();
    _fetchHolidays();
  }

  Future<void> _fetchHolidays() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final response = await http.get(
        Uri.parse('${getBaseUrl()}/api/holidays'),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        _allRawHolidays = data.where((h) => h['type'] == 'special').toList();
        _applyFilters();
      } else {
        throw Exception('Failed to load holidays');
      }
    } catch (e) {
      debugPrint("Error fetching holidays: $e");
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Could not sync holidays. Please try again."),
          ),
        );
      }
    }
  }

  void _applyFilters() {
    final today = DateTime.now();
    final todayClean = DateTime(today.year, today.month, today.day);

    List<dynamic> results = _allRawHolidays.where((h) {
      final from = DateTime.parse(h['fromDate']);
      final to = DateTime.parse(h['toDate']);
      final fromClean = DateTime(from.year, from.month, from.day);
      final toClean = DateTime(to.year, to.month, to.day);

      // Match Year
      if (_selectedYear != 0 && from.year != _selectedYear) return false;

      // Match Month
      if (_selectedMonth != 0 && from.month != _selectedMonth) return false;

      // Match Mode
      switch (_filterMode) {
        case 'today':
          return (fromClean.isAtSameMomentAs(todayClean) ||
              toClean.isAtSameMomentAs(todayClean) ||
              (fromClean.isBefore(todayClean) && toClean.isAfter(todayClean)));
        case 'upcoming':
          return fromClean.isAfter(todayClean);
        case 'past':
          return toClean.isBefore(todayClean);
        default:
          return true;
      }
    }).toList();

    // Sort by date
    results.sort((a, b) => a['fromDate'].compareTo(b['fromDate']));

    setState(() {
      _filteredHolidays = results.map((h) {
        final DateTime date = DateTime.parse(h['fromDate']);
        return {
          "name": h['reason'].toString(),
          "date": DateFormat('MMM dd, yyyy').format(date),
          "day": DateFormat('EEEE').format(date),
        };
      }).toList();
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(context),
              SizedBox(height: 10),
              _buildFilterRow(),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                child: Row(
                  children: [
                    Text(
                      "${_filterMode.toUpperCase()} HOLIDAYS $_selectedYear",
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: subtitleColor,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        "${_filteredHolidays.length}",
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: primaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: primaryColor),
                      )
                    : _filteredHolidays.isEmpty
                    ? _buildEmptyState()
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        itemCount: _filteredHolidays.length,
                        itemBuilder: (context, index) {
                          final holiday = _filteredHolidays[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: surfaceColor,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: borderColor),
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
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(
                                    color: primaryColor.withOpacity(0.05),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: const Center(
                                    child: Icon(
                                      Icons.calendar_today_rounded,
                                      color: primaryColor,
                                      size: 20,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        holiday["name"]!,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: primaryColor,
                                          fontSize: 15,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        "${holiday["date"]} • ${holiday["day"]}",
                                        style: const TextStyle(
                                          color: subtitleColor,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.04),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                _buildModeTab('all', 'All'),
                _buildModeTab('today', 'Today'),
                _buildModeTab('upcoming', 'Upcoming'),
                _buildModeTab('past', 'Past'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: _buildSelector(
                  icon: Icons.calendar_month_outlined,
                  value: _months[_selectedMonth],
                  onTap: () => _showMonthPicker(),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 1,
                child: _buildSelector(
                  icon: null,
                  value: _selectedYear.toString(),
                  onTap: () => _showYearPicker(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildModeTab(String mode, String label) {
    bool isActive = _filterMode == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _filterMode = mode);
          _applyFilters();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isActive ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              color: isActive ? primaryColor : subtitleColor,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSelector({
    required IconData? icon,
    required String value,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.03),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor.withOpacity(0.5)),
        ),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: subtitleColor),
              const SizedBox(width: 8),
            ],
            Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: primaryColor,
              ),
            ),
            const Spacer(),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 18,
              color: subtitleColor,
            ),
          ],
        ),
      ),
    );
  }

  void _showMonthPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildPickerSheet(
        title: "Select Month",
        items: _months,
        currentIndex: _selectedMonth,
        onSelected: (index) {
          setState(() => _selectedMonth = index);
          _applyFilters();
          Navigator.pop(context);
        },
      ),
    );
  }

  void _showYearPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildPickerSheet(
        title: "Select Year",
        items: _years.map((y) => y.toString()).toList(),
        currentIndex: _years.indexOf(_selectedYear),
        onSelected: (index) {
          setState(() => _selectedYear = _years[index]);
          _applyFilters();
          Navigator.pop(context);
        },
      ),
    );
  }

  Widget _buildPickerSheet({
    required String title,
    required List<String> items,
    required int currentIndex,
    required Function(int) onSelected,
  }) {
    return Container(
      decoration: const BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: borderColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: primaryColor,
              ),
            ),
          ),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.4,
            ),
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.only(bottom: 32),
              itemCount: items.length,
              separatorBuilder: (_, __) =>
                  Divider(height: 1, color: borderColor.withOpacity(0.5)),
              itemBuilder: (context, index) {
                bool isSelected = index == currentIndex;
                return ListTile(
                  onTap: () => onSelected(index),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 4,
                  ),
                  title: Text(
                    items[index],
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: isSelected
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: isSelected ? primaryColor : subtitleColor,
                    ),
                  ),
                  trailing: isSelected
                      ? const Icon(
                          Icons.check_circle_rounded,
                          color: primaryColor,
                        )
                      : null,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.03),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.event_note_outlined,
              size: 48,
              color: subtitleColor.withOpacity(0.5),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            "No holidays found",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: primaryColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "Try changing your filter settings",
            style: TextStyle(
              fontSize: 13,
              color: subtitleColor.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.pop(context),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: backgroundColor,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: borderColor),
              ),
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: primaryColor,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 16),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Holidays",
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: primaryColor,
                  fontSize: 24,
                  letterSpacing: -1.0,
                ),
              ),
              Text(
                "ANNUAL CALENDAR",
                style: TextStyle(
                  color: subtitleColor,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 1.4,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
