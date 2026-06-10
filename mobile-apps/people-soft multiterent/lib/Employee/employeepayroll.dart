import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';

class EmployeePayrollPage extends StatefulWidget {
  const EmployeePayrollPage({super.key});

  @override
  State<EmployeePayrollPage> createState() => _EmployeePayrollPageState();
}

class _EmployeePayrollPageState extends State<EmployeePayrollPage>
    with SingleTickerProviderStateMixin {
  // ─── Colors ──────────────────────────────────────────────────────────────────
  static const Color primaryColor   = Color(0xFF00657F);
  static const Color accentColor    = Color(0xFF0284C7);
  static const Color backgroundColor = Color(0xFFF8FAFC);
  static const Color surfaceColor   = Colors.white;
  static const Color borderColor    = Color(0xFFE2E8F0);
  static const Color successColor   = Color(0xFF10B981);
  static const Color warningColor   = Color(0xFFF59E0B);
  static const Color errorColor     = Color(0xFFEF4444);
  static const Color subtitleColor  = Color(0xFF64748B);

  // ─── State ────────────────────────────────────────────────────────────────────
  bool   _isLoading = true;
  String? _error;

  // Profile
  DateTime? _onboardingDate;
  String _employeeName = '';
  String _designation  = '';

  // Salary components
  double _basic       = 0;
  double _hra         = 0;
  double _allowances  = 0;
  double _deductions  = 0;

  // LOP settings (from company settings)
  bool   _enableLop      = false;
  String _lopType        = 'percentage'; // 'percentage' | 'amount'
  double _lopPercentage  = 100;
  double _lopAmountPerDay = 0;
  int    _workingDays    = 26;

  // Calculated
  int    _lopDays      = 0;
  double _lopDeduction = 0;

  late AnimationController _animController;
  late Animation<double>   _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 700));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _loadPayrollData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────────
  Future<void> _loadPayrollData() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final prefs = await SharedPreferences.getInstance();
      final employeeId = prefs.getString('employeeId') ?? prefs.getString('hr_id') ?? prefs.getString('managerId') ?? '';
      if (employeeId.isEmpty) {
        throw Exception('Employee ID not found. Please log in again.');
      }

      final base = getBaseUrl();

      // Fetch all data in parallel
      final results = await Future.wait([
        http.get(Uri.parse('$base/api/employee/get/$employeeId')),
        http.get(Uri.parse('$base/api/settings/company')),
        http.get(Uri.parse('$base/api/holidays')),
        http.get(Uri.parse('$base/api/employee-leave/employee/$employeeId')),
        http.get(Uri.parse('$base/api/employeeAttanance/employee/$employeeId')),
      ]);

      // ── 1. Parse employee profile ─────────────────────────────────────────────
      final profileBody = jsonDecode(results[0].body);
      final profile = profileBody['employee'] ?? profileBody['data'] ?? profileBody;
      _employeeName = ('${profile['firstName'] ?? ''} ${profile['lastName'] ?? ''}').trim();
      if (_employeeName.isEmpty) _employeeName = (profile['fullName'] ?? '').toString().trim();
      _designation  = profile['designation'] ?? profile['jobTitle'] ?? '';

      final payrollField = profile['payroll'] ?? profile['salary'] ?? {};
      double b = _toDouble(payrollField['basicSalary'] ?? payrollField['basic']);
      _basic       = b > 0 ? b : 35000;
      double h = _toDouble(payrollField['hra']);
      _hra         = h > 0 ? h : 12000;
      double a = _toDouble(payrollField['allowances']);
      _allowances  = a > 0 ? a : 6000;
      double d = _toDouble(payrollField['deductions']);
      _deductions  = d > 0 ? d : 3000;

      // ── 2. Parse company settings ─────────────────────────────────────────────
      final settingsBody   = jsonDecode(results[1].body);
      final settings       = settingsBody['settings'] ?? settingsBody['data'] ?? settingsBody;
      final payrollSettings = settings['payrollSettings'] ?? {};
      final lopSettings    = payrollSettings['lopSettings'] ?? {};

      final lopEnabled = lopSettings['enableLopEmployee'];
      _enableLop       = lopEnabled == true || lopEnabled?.toString() == 'true';
      _lopType         = (lopSettings['lopTypeEmployee'] ?? 'percentage').toString();
      _lopPercentage   = _toDouble(lopSettings['lopPercentageEmployee'] ?? 100);
      _lopAmountPerDay = _toDouble(lopSettings['lopAmountEmployee'] ?? 0);
      _workingDays     = _toInt(lopSettings['workingDaysEmployee'] ?? 26);

      // Weekly holiday day-names (e.g., ["Sat","Sun"])
      final calendarSection = payrollSettings['holidayCalendar']
                           ?? settings['holidayCalendar']
                           ?? {};
      final rawWeekly = calendarSection['weeklyHolidays']
                     ?? payrollSettings['weeklyHolidays']
                     ?? settings['weeklyHolidays']
                     ?? [];
      final Set<String> weeklyHolidays =
          (rawWeekly is List ? rawWeekly : []).map((e) => e.toString()).toSet();

      // ── 3. Parse public / special holidays ───────────────────────────────────
      final holidaysBody = jsonDecode(results[2].body);
      final List rawHolidays = _asList(holidaysBody, ['holidays', 'data']);
      final Set<String> specialHolidayDates = {};
      for (final h in rawHolidays) {
        final ds = h['date']?.toString() ?? '';
        if (ds.isNotEmpty) {
          try {
            final d = DateTime.parse(ds);
            specialHolidayDates.add(_fmtDate(d));
          } catch (_) {}
        }
      }

      // ── 4. Parse approved leaves ──────────────────────────────────────────────
      final leavesBody = jsonDecode(results[3].body);
      final List rawLeaves = _asList(leavesBody, ['leaves', 'data']);
      final Set<String> approvedLeaveDates = {};
      for (final leave in rawLeaves) {
        final status = (leave['status'] ?? '').toString().toLowerCase();
        if (status == 'approved' || status == 'accepted') {
          final fromStr = (leave['fromDate'] ?? leave['startDate'] ?? '').toString();
          final toStr   = (leave['toDate']   ?? leave['endDate']   ?? '').toString();
          if (fromStr.isNotEmpty) {
            try {
              final start = DateTime.parse(fromStr);
              final end   = toStr.isNotEmpty ? DateTime.parse(toStr) : start;
              for (var d = start; !d.isAfter(end); d = d.add(const Duration(days: 1))) {
                approvedLeaveDates.add(_fmtDate(d));
              }
            } catch (_) {}
          }
        }
      }

      // ── 5. Parse attendance ───────────────────────────────────────────────────
      final attBody = jsonDecode(results[4].body);
      final List rawAtt = _asList(attBody, ['attendance', 'data']);
      final Set<String> punchedDays = {};
      for (final att in rawAtt) {
        // Try top-level date field
        final ds = (att['date'] ?? att['attendanceDate'] ?? '').toString();
        if (ds.isNotEmpty) {
          try { punchedDays.add(_fmtDate(DateTime.parse(ds))); } catch (_) {}
        }
        // Try punches / logs sub-array
        final punches = att['punches'] ?? att['logs'] ?? [];
        if (punches is List && punches.isNotEmpty) {
          for (final punch in punches) {
            final ps = (punch['punchIn'] ?? punch['time'] ?? punch['timestamp'] ?? '').toString();
            if (ps.isNotEmpty) {
              try { punchedDays.add(_fmtDate(DateTime.parse(ps))); } catch (_) {}
            }
          }
        }
      }

      // ── 6. Calculate LOP ──────────────────────────────────────────────────────
      DateTime? onboardingDate;
      final obDateStr = profile['onboardingDate']?.toString() ?? '';
      if (obDateStr.isNotEmpty) {
        try { onboardingDate = DateTime.parse(obDateStr); } catch (_) {}
      }
      _onboardingDate = onboardingDate;

      _lopDays      = _calculateLopDays(weeklyHolidays, specialHolidayDates, approvedLeaveDates, punchedDays, onboardingDate);
      _lopDeduction = _calculateLopDeduction();

      _animController.forward(from: 0);
      setState(() { _isLoading = false; });
    } catch (e) {
      setState(() { _isLoading = false; _error = e.toString().replaceAll('Exception: ', ''); });
    }
  }

  // ─── LOP Logic ────────────────────────────────────────────────────────────────
  int _calculateLopDays(
    Set<String> weeklyHolidays,
    Set<String> specialHolidays,
    Set<String> approvedLeaves,
    Set<String> punchedDays,
    DateTime? onboardingDate,
  ) {
    final now      = DateTime.now();
    DateTime firstDay = DateTime(now.year, now.month, 1);

    if (onboardingDate != null && 
        onboardingDate.year == now.year && 
        onboardingDate.month == now.month) {
      final obDay = DateTime(onboardingDate.year, onboardingDate.month, onboardingDate.day);
      if (obDay.isAfter(firstDay)) {
        firstDay = obDay;
      }
    }

    final today    = DateTime(now.year, now.month, now.day);
    int count = 0;

    for (var d = firstDay; !d.isAfter(today); d = d.add(const Duration(days: 1))) {
      final key = _fmtDate(d);
      if (_isWeeklyHoliday(d, weeklyHolidays)) continue;
      if (specialHolidays.contains(key)) continue;
      if (approvedLeaves.contains(key)) continue;
      if (!punchedDays.contains(key)) count++;
    }
    return count;
  }

  bool _isWeeklyHoliday(DateTime date, Set<String> weeklyHolidays) {
    // Dart weekday: Mon=1 … Sat=6 Sun=7
    const map = {1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat',7:'Sun'};
    return weeklyHolidays.contains(map[date.weekday] ?? '');
  }

  double _calculateLopDeduction() {
    if (!_enableLop || _lopDays == 0) return 0;
    if (_lopType == 'amount') return _lopDays * _lopAmountPerDay;
    // percentage of daily salary
    return (_basic / _workingDays) * _lopDays * (_lopPercentage / 100);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  // Safe list extractor — handles both bare JSON arrays and wrapped objects
  List _asList(dynamic body, List<String> keys) {
    if (body is List) return body;
    if (body is Map) {
      for (final k in keys) {
        final v = body[k];
        if (v is List) return v;
      }
    }
    return [];
  }

  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2,'0')}-${d.day.toString().padLeft(2,'0')}';

  double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is double) return v;
    if (v is int)    return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int)    return v;
    if (v is double) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  double get _gross  => _basic + _hra + _allowances;
  double get _netPay => _gross - _deductions - _lopDeduction;

  // ─── Build ────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: surfaceColor,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: primaryColor, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Payroll & Benefits',
            style: TextStyle(fontWeight: FontWeight.w700, color: primaryColor, fontSize: 18)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: primaryColor, size: 22),
            onPressed: _loadPayrollData,
          ),
        ],
      ),
      body: _isLoading
          ? _buildLoader()
          : _error != null
              ? _buildError()
              : FadeTransition(
                  opacity: _fadeAnim,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildNetPayCard(),
                        const SizedBox(height: 16),
                        _buildBreakdownCard(),
                        const SizedBox(height: 32),
                        const Text('Pay Slips',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: primaryColor)),
                        const SizedBox(height: 12),
                        ..._buildDynamicPaySlips(),
                      ],
                    ),
                  ),
                ),
    );
  }

  // ── Loader ────────────────────────────────────────────────────────────────────
  Widget _buildLoader() => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color: primaryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Center(child: CircularProgressIndicator(color: primaryColor, strokeWidth: 3)),
        ),
        const SizedBox(height: 16),
        const Text('Loading payroll data…',
            style: TextStyle(color: subtitleColor, fontSize: 14, fontWeight: FontWeight.w500)),
      ],
    ),
  );

  // ── Error ─────────────────────────────────────────────────────────────────────
  Widget _buildError() => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(color: errorColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
            child: const Icon(Icons.error_outline_rounded, color: errorColor, size: 36),
          ),
          const SizedBox(height: 16),
          const Text('Failed to Load Payroll',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: primaryColor)),
          const SizedBox(height: 8),
          Text(_error!, textAlign: TextAlign.center,
              style: const TextStyle(color: subtitleColor, fontSize: 13)),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _loadPayrollData,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try Again'),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
            ),
          ),
        ],
      ),
    ),
  );

  // ── Net Pay Hero Card ─────────────────────────────────────────────────────────
  Widget _buildNetPayCard() {
    final fmt = NumberFormat('#,##,###');
    final month = DateFormat('MMMM yyyy').format(DateTime.now());
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF00657F), Color(0xFF004D61)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: primaryColor.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 12))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('NET TAKE-HOME • $month',
                        style: const TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.0)),
                    const SizedBox(height: 6),
                    Text('₹${fmt.format(_netPay.round())}',
                        style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14)),
                child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 28),
              ),
            ],
          ),
          if (_employeeName.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(_employeeName,
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
            if (_designation.isNotEmpty)
              Text(_designation,
                  style: const TextStyle(color: Colors.white60, fontSize: 12)),
          ],
          const SizedBox(height: 24),
          const Divider(color: Colors.white24, height: 1),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildHeroDetail('Basic',      '₹${fmt.format(_basic.round())}'),
              _buildHeroDetail('HRA',        '₹${fmt.format(_hra.round())}'),
              _buildHeroDetail('Allowances', '₹${fmt.format(_allowances.round())}'),
              _buildHeroDetail('Deductions', '-₹${fmt.format(_deductions.round())}', red: true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeroDetail(String label, String value, {bool red = false}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9, fontWeight: FontWeight.w500)),
      const SizedBox(height: 4),
      Text(value,
          style: TextStyle(
              color: red ? const Color(0xFFFF8A8A) : Colors.white,
              fontSize: 13, fontWeight: FontWeight.w700)),
    ],
  );

  // ── Breakdown Card ────────────────────────────────────────────────────────────
  Widget _buildBreakdownCard() {
    final fmt   = NumberFormat('#,##,###');
    final month = DateFormat('MMM yyyy').format(DateTime.now());
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 16, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.calculate_rounded, color: primaryColor, size: 18),
              ),
              const SizedBox(width: 10),
              const Text('Salary Breakdown',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: primaryColor)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: successColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8)),
                child: Text(month,
                    style: const TextStyle(color: successColor, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Gross Payout
          _bRow('Gross Payout',
              '₹${fmt.format(_gross.round())}',
              icon: Icons.arrow_circle_up_rounded,
              iconColor: successColor,
              valueColor: primaryColor),

          _divLine(),

          // PF / Tax Deductions
          _bRow('PF / Tax Deductions',
              '-₹${fmt.format(_deductions.round())}',
              icon: Icons.remove_circle_outline_rounded,
              iconColor: warningColor,
              valueColor: warningColor),

          // LOP Deduction (if enabled and > 0)
          if (_enableLop && _lopDays > 0) ...[
            _divLine(),
            _bRow(
              'LOP – $_lopDays ${_lopDays == 1 ? 'day' : 'days'} absent',
              '-₹${fmt.format(_lopDeduction.round())}',
              icon: Icons.event_busy_rounded,
              iconColor: errorColor,
              valueColor: errorColor,
              subtitle: _lopType == 'percentage'
                  ? '${_lopPercentage.toInt()}% of daily basic × $_lopDays'
                  : '₹${fmt.format(_lopAmountPerDay.round())} × $_lopDays days',
            ),
          ],

          const SizedBox(height: 16),

          // Net Take-Home banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [
                primaryColor.withValues(alpha: 0.08),
                primaryColor.withValues(alpha: 0.03)
              ]),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: primaryColor.withValues(alpha: 0.18)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('NET TAKE-HOME',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primaryColor, letterSpacing: 0.6)),
                Text('₹${fmt.format(_netPay.round())}',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: primaryColor)),
              ],
            ),
          ),

          // "Full attendance" badge
          if (_enableLop && _lopDays == 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: successColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.check_circle_outline_rounded, color: successColor, size: 14),
                  SizedBox(width: 6),
                  Text('No LOP this month — perfect attendance!',
                      style: TextStyle(color: successColor, fontSize: 11, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _bRow(String label, String value, {
    required IconData icon,
    required Color iconColor,
    required Color valueColor,
    String? subtitle,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(color: subtitleColor, fontSize: 13, fontWeight: FontWeight.w500)),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                ],
              ],
            ),
          ),
          Text(value,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: valueColor)),
        ],
      ),
    );
  }

  Widget _divLine() => const Divider(color: borderColor, height: 1);

  // ── Pay Slip Item ─────────────────────────────────────────────────────────────
  List<Widget> _buildDynamicPaySlips() {
    final List<Widget> slips = [];
    final now = DateTime.now();
    DateTime currentCheck = DateTime(now.year, now.month - 1, 1);
    
    int maxSlips = _onboardingDate == null ? 3 : 12;

    for (int i = 0; i < maxSlips; i++) {
      if (_onboardingDate != null) {
        if (currentCheck.year < _onboardingDate!.year || 
            (currentCheck.year == _onboardingDate!.year && currentCheck.month < _onboardingDate!.month)) {
          break;
        }
      }
      
      final monthStr = DateFormat('MMMM yyyy').format(currentCheck);
      final issueDate = DateTime(currentCheck.year, currentCheck.month + 1, 1);
      final issueDateStr = DateFormat('MMM dd, yyyy').format(issueDate);
      
      slips.add(_buildPaySlipItem(monthStr, issueDateStr));
      currentCheck = DateTime(currentCheck.year, currentCheck.month - 1, 1);
    }
    
    if (slips.isEmpty) {
      return [const Text('No pay slips available yet.', style: TextStyle(color: subtitleColor, fontSize: 13))];
    }
    return slips;
  }

  Widget _buildPaySlipItem(String month, String date) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.description_outlined, color: primaryColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(month,
                    style: const TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 14)),
                Text('Issued on $date',
                    style: const TextStyle(color: subtitleColor, fontSize: 11)),
              ],
            ),
          ),
          IconButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Downloading pay slip…')),
              );
            },
            icon: const Icon(Icons.file_download_outlined, color: accentColor),
          ),
        ],
      ),
    );
  }
}
