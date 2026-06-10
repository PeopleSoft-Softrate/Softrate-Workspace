import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import '../port.dart';


class HolidayCalendarScreen extends StatefulWidget {
  const HolidayCalendarScreen({super.key});

  @override
  State<HolidayCalendarScreen> createState() => _HolidayCalendarScreenState();
}

class _HolidayCalendarScreenState extends State<HolidayCalendarScreen> {
  bool loading = true;
  List<Map<String, dynamic>> specialHolidays = [];
  Map<String, Set<int>> weeklyHolidays = {};


  final days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  final weeks = ["1st Week", "2nd Week", "3rd Week", "4th Week", "5th Week"];

  static const Color primaryColor = Color(0xFF00657F);
  static const Color surfaceColor = Color(0xFFF8FAFC);

  @override
  void initState() {
    super.initState();
    fetchHolidays();
  }

  Future<void> fetchHolidays() async {
    setState(() => loading = true);
    try {
      final res = await http.get(Uri.parse("${getBaseUrl()}/api/holidays"));
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);

        weeklyHolidays.clear();
        specialHolidays.clear();

        for (var item in data) {
          if (item['type'] == 'weekly') {
            final day = item['day'];
            final weeksSet = (item['weeks'] as List)
                .map((e) => e as int)
                .toSet();
            weeklyHolidays[day] = weeksSet;
          } else if (item['type'] == 'special') {
            specialHolidays.add(item);
          }
        }

        // Sort special holidays by date
        specialHolidays.sort(
          (a, b) => DateTime.parse(
            a['fromDate'],
          ).compareTo(DateTime.parse(b['fromDate'])),
        );
      }
    } catch (e) {
      debugPrint("Error fetching holidays: $e");
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final upcomingHolidays = specialHolidays.where((h) {
      final to = DateTime.parse(h['toDate']);
      return !to.isBefore(today);
    }).toList();

    final pastHolidays = specialHolidays.where((h) {
      final to = DateTime.parse(h['toDate']);
      return to.isBefore(today);
    }).toList();

    // Sort upcoming ascending (nearest first)
    upcomingHolidays.sort(
      (a, b) => DateTime.parse(a['fromDate']).compareTo(DateTime.parse(b['fromDate'])),
    );

    // Sort past descending (most recent first)
    pastHolidays.sort(
      (a, b) => DateTime.parse(b['fromDate']).compareTo(DateTime.parse(a['fromDate'])),
    );

    return Scaffold(
      backgroundColor: surfaceColor,
      appBar: AppBar(
        title: const Text(
          "Holiday Calendar",
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: primaryColor))
          : RefreshIndicator(
              onRefresh: fetchHolidays,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionHeader("Weekly Holidays"),
                    const SizedBox(height: 12),
                    _buildWeeklyHolidaysCard(),
                    const SizedBox(height: 32),
                    _buildSectionHeader("Upcoming Holidays"),
                    const SizedBox(height: 12),
                    if (upcomingHolidays.isEmpty)
                      _buildEmptyState("No upcoming holidays scheduled.")
                    else
                      ..._buildGroupedHolidaysList(upcomingHolidays, isGovt: false),
                    const SizedBox(height: 32),
                    _buildSectionHeader("Past Holidays"),
                    const SizedBox(height: 12),
                    if (pastHolidays.isEmpty)
                      _buildEmptyState("No past holidays.")
                    else
                      ..._buildGroupedHolidaysList(pastHolidays, isGovt: false),
                  ],
                ),
              ),
            ),
    );
  }


  List<Widget> _buildGroupedHolidaysList(
    List<Map<String, dynamic>> holidayList, {
    required bool isGovt,
  }) {
    // Group holidays by month
    Map<String, List<Map<String, dynamic>>> grouped = {};
    for (var h in holidayList) {
      final date = DateTime.parse(h['fromDate']);
      final monthName = DateFormat('MMMM yyyy').format(date);
      grouped.putIfAbsent(monthName, () => []).add(h);
    }

    List<Widget> widgets = [];
    grouped.forEach((month, holidays) {
      widgets.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8.0),
          child: Text(
            month,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade700,
              letterSpacing: 1.0,
            ),
          ),
        ),
      );
      widgets.addAll(holidays.map((h) => _buildHolidayCard(h, isGovt: isGovt)));
      widgets.add(const SizedBox(height: 16));
    });

    return widgets;
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        color: primaryColor,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildWeeklyHolidaysCard() {
    final activeWeekly = weeklyHolidays.entries
        .where((e) => e.value.isNotEmpty)
        .toList();

    if (activeWeekly.isEmpty) {
      return _buildEmptyState("No weekly holidays configured.");
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: activeWeekly.map((entry) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    entry.key,
                    style: const TextStyle(
                      color: primaryColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    entry.value.length == 5
                        ? "All Weeks"
                        : "Weeks: ${entry.value.toList()..sort()}",
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildHolidayCard(Map<String, dynamic> h, {bool isGovt = false}) {
    final from = DateTime.parse(h['fromDate']);
    final to = DateTime.parse(h['toDate']);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    // A holiday is passed if its 'toDate' is before today
    final isPassed = to.isBefore(today);
    final isUpcoming = from.isAfter(now);

    final Color cardThemeColor = isGovt ? Colors.orange : primaryColor;
    final Color statusColor = isPassed ? Colors.grey : cardThemeColor;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isUpcoming
            ? Border.all(color: primaryColor.withOpacity(0.2), width: 1)
            : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: statusColor.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(
            isGovt
                ? Icons.account_balance_rounded
                : Icons.event_available_rounded,
            color: statusColor,
          ),
        ),
        title: Text(
          h['reason'],
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: isPassed
                ? Colors.grey
                : (isGovt ? Colors.orange.shade900 : null),
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            from == to
                ? DateFormat('E, MMM dd, yyyy').format(from)
                : "${DateFormat('E, MMM dd, yyyy').format(from)} - ${DateFormat('E, MMM dd, yyyy').format(to)}",
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
          ),
        ),
        trailing: isPassed
            ? Text(
                "Passed",
                style: TextStyle(
                  color: Colors.grey.shade400,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              )
            : (isUpcoming
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        "Upcoming",
                        style: TextStyle(
                          color: Colors.green.shade700,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    )
                  : null),
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.grey.shade500,
          fontStyle: FontStyle.italic,
        ),
      ),
    );
  }
}
