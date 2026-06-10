import 'dart:convert';
import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;

class InternProcess extends StatefulWidget {
  final String internId;
  final String internName;

  const InternProcess({
    required this.internId,
    required this.internName,
    super.key,
  });

  @override
  State<InternProcess> createState() => _InternProcessState();
}

// ---------- Models ----------
class GoalDefinition {
  final String perspective;
  final String kpiName;
  final String title;
  final String description;
  final int weight;

  GoalDefinition({
    required this.perspective,
    required this.kpiName,
    required this.title,
    required this.description,
    required this.weight,
  });

  factory GoalDefinition.fromJson(Map<String, dynamic> json) {
    return GoalDefinition(
      perspective: json['perspective'] ?? '',
      kpiName: json['kpiName'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      weight: (json['weight'] as num?)?.toInt() ?? 0,
    );
  }
}

class ReviewEntry {
  String? perspective;
  String? kpi;
  GoalDefinition? goal;
  final TextEditingController commentController = TextEditingController();
}

class GoalModel {
  final String title;
  final String description;
  final int weight;
  final String? grade;
  final String? comment;

  GoalModel({
    required this.title,
    required this.description,
    required this.weight,
    this.grade,
    this.comment,
  });

  factory GoalModel.fromJson(Map<String, dynamic> json) {
    return GoalModel(
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      weight: json['weight'] ?? 0,
      grade: json['grade'],
      comment: json['comment'],
    );
  }
}

class ReviewModel {
  final String internId;
  final String internName;
  final String team;
  final bool isGraded;
  final double overallPercentage;
  final List<GoalModel> goals;
  final String? date;

  ReviewModel({
    required this.internId,
    required this.internName,
    required this.team,
    required this.isGraded,
    required this.overallPercentage,
    required this.goals,
    this.date,
  });

  factory ReviewModel.fromJson(Map<String, dynamic> json) {
    return ReviewModel(
      internId: json['internId'],
      internName: json['internName'],
      team: json['team'],
      isGraded: json['isGraded'] ?? false,
      overallPercentage: json['summary'] != null
          ? (json['summary']['percentage']?.toDouble() ?? 0)
          : 0,
      date: json['date'],
      goals: (json['goals'] as List? ?? [])
          .map((g) => GoalModel.fromJson(g))
          .toList(),
    );
  }
}

// ---------- State -----------
class _InternProcessState extends State<InternProcess> {
  String? _selectedTeam;
  List<GoalDefinition> _teamGoals = [];
  List<ReviewEntry> _reviews = [];
  ReviewModel? _reviewForFilter;
  bool _noRecordForFilter = false;
  bool _isTemplatesLoading = false;
  List<Map<String, dynamic>> _dynamicTemplates = [];

  // Month/year filter
  String? _selectedMonth;
  String? _selectedYear;
  final List<String> _months = List.generate(
    12,
    (i) => (i + 1).toString().padLeft(2, '0'),
  );
  final List<String> _years = List.generate(
    5,
    (i) => (DateTime.now().year - 2 + i).toString(),
  );

  // ---------- Goals ----------
  @override
  void initState() {
    super.initState();
    _initCurrentMonthDefaults();
    _refreshAllData();
  }

  Future<void> _fetchPerformanceTemplates() async {
    setState(() => _isTemplatesLoading = true);
    try {
      // Fetch all templates since admin might have saved roleName as the department (e.g. "Software Development")
      final uri = Uri.parse('${getBaseUrl()}/api/performance-templates');
      final res = await http.get(uri);
      if (res.statusCode == 200) {
        final List data = jsonDecode(res.body);
        setState(() {
          _dynamicTemplates = List<Map<String, dynamic>>.from(data);
          // Safety: If current selection is not in new templates, reset it to avoid dropdown crash
          if (_selectedTeam != null &&
              !_dynamicTemplates.any((t) => t['category'] == _selectedTeam)) {
            _selectedTeam = null;
            _teamGoals = [];
            _reviews = [];
          }
        });
      }
    } catch (e) {
      debugPrint("Fetch templates error: $e");
    } finally {
      setState(() => _isTemplatesLoading = false);
    }
  }

  void _initCurrentMonthDefaults() {
    var now = DateTime.now();
    if (now.day <= 5) {
      now = DateTime(now.year, now.month - 1, now.day);
    }
    _selectedMonth = now.month.toString().padLeft(2, '0');
    _selectedYear = now.year.toString();
  }

  // ---------- Fetch current month review for self ----------
  Future<void> _fetchCurrentMonthReview() async {
    try {
      final uri = Uri.parse(
        '${getBaseUrl()}/api/reviews/self/${widget.internId}',
      );
      final res = await http.get(uri);

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body)['data'];
        if (data != null) {
          setState(() {
            _reviewForFilter = ReviewModel.fromJson(data);
            _noRecordForFilter = false;
            _selectedTeam = _reviewForFilter!.team;
          });
        } else {
          setState(() {
            _reviewForFilter = null;
            _noRecordForFilter = false; // current month, allow new review
          });
        }
      }
    } catch (e) {
      debugPrint("Failed to fetch current review: $e");
    }
  }

  // ---------- Fetch by selected month/year ----------
  Future<void> _fetchReviewByMonth() async {
    if (_selectedMonth == null || _selectedYear == null) return;

    final monthStr = "${_selectedYear!}-${_selectedMonth!}";
    final uri = Uri.parse(
      '${getBaseUrl()}/api/reviews/${widget.internId}?month=$monthStr',
    );

    try {
      final res = await http.get(uri);
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body)['data'];
        if (data != null) {
          setState(() {
            _reviewForFilter = ReviewModel.fromJson(data);
            _selectedTeam = _reviewForFilter!.team;
            _noRecordForFilter = false;
          });
        } else {
          setState(() {
            _reviewForFilter = null;
            _noRecordForFilter = true;
            _selectedTeam = null;
          });
        }
      }
    } catch (e) {
      debugPrint("Fetch review error: $e");
    }
  }

  Future<void> _refreshAllData() async {
    setState(() => _isTemplatesLoading = true);
    try {
      // First fetch templates, then intern details (which might select a team), then existing review
      await _fetchPerformanceTemplates();
      await _fetchInternDetails();
      await _fetchReviewByMonth();
    } catch (e) {
      debugPrint("Refresh error: $e");
    } finally {
      if (mounted) {
        setState(() => _isTemplatesLoading = false);
      }
    }
  }

  Future<void> _fetchInternDetails() async {
    try {
      final uri = Uri.parse(
        '${getBaseUrl()}/api/intern/get/${widget.internId}',
      );
      final res = await http.get(uri);
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final intern = data['intern'] ?? data;
        final dept = intern['department'] ?? intern['role'];
        if (dept != null && _selectedTeam == null) {
          // Only automatically select if a matching template exists for this department
          final bool hasMatchingTemplate = _dynamicTemplates.any(
            (t) => t['category'] == dept,
          );
          if (hasMatchingTemplate) {
            _onTeamSelected(dept);
          }
        }
      }
    } catch (e) {
      debugPrint("Fetch intern details error: $e");
    }
  }

  // ---------- Helper methods ----------
  Map<String, dynamic> _buildPayload() {
    return {
      "internId": widget.internId,
      "internName": widget.internName,
      "team": _selectedTeam,
      "date": DateTime.now().toIso8601String().split("T").first,
      "goals": _reviews.where((r) => r.goal != null).map((r) {
        return {
          "perspective": r.goal!.perspective,
          "kpi": r.goal!.kpiName,
          "title": r.goal!.title,
          "description": r.goal!.description,
          "weight": r.goal!.weight,
          "comment": r.commentController.text.trim(),
        };
      }).toList(),
    };
  }

  Future<void> _submitReview() async {
    if (_selectedTeam == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Please select a team first.")),
      );
      return;
    }

    const int minCommentLength = 80;
    final requiredCount = _teamGoals.length;

    // 1️⃣ Check if all goals are filled
    if (_reviews.length != requiredCount ||
        _reviews.any((r) => r.goal == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Please complete all $requiredCount goals before submitting the review.",
          ),
        ),
      );
      return;
    }

    // 2️⃣ Check comment length
    final invalidComment = _reviews.any(
      (r) => r.commentController.text.trim().length < minCommentLength,
    );

    if (invalidComment) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Each comment must contain at least 80 characters."),
        ),
      );
      return;
    }

    // 3️⃣ Check unique KPI per perspective
    final selectedKpis = _reviews.map((r) => r.kpi).toSet();
    if (selectedKpis.length != requiredCount) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Each goal must have a unique KPI within its perspective.",
          ),
        ),
      );
      return;
    }

    // ✅ Submit
    final payload = _buildPayload();
    final url = Uri.parse("${getBaseUrl()}/api/reviews/submit-review");

    final res = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(payload),
    );

    if (res.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Review submitted successfully.")),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Submission failed. Please try again.")),
      );
    }
  }

  List<String> _getAvailableKpisForEntry(
    ReviewEntry current,
    String? perspective,
  ) {
    if (perspective == null) return [];

    final allKpis = _teamGoals
        .where((g) => g.perspective == perspective)
        .map((g) => g.kpiName)
        .toSet()
        .toList();

    final usedKpis = _reviews
        .where(
          (r) => r != current && r.perspective == perspective && r.kpi != null,
        )
        .map((r) => r.kpi!)
        .toSet();

    if (current.kpi != null) {
      usedKpis.remove(current.kpi);
    }

    return allKpis.where((k) => !usedKpis.contains(k)).toList();
  }

  void _onTeamSelected(String? team) {
    if (team == null) return;

    // Find template for this category or roleName (case-insensitive)
    final template = _dynamicTemplates.firstWhere(
      (t) =>
          (t['category'] as String).toLowerCase() == team.toLowerCase() ||
          (t['roleName'] as String).toLowerCase() == team.toLowerCase(),
      orElse: () => {},
    );

    final List<dynamic> goalData = template['goals'] ?? [];

    setState(() {
      _selectedTeam =
          template['roleName'] ??
          template['category'] ??
          team; // Use the exact case from template if found
      _teamGoals = goalData.map((g) => GoalDefinition.fromJson(g)).toList();
      _reviews = [];
    });
  }

  void _addReview() {
    if (_teamGoals.isNotEmpty && _reviews.length >= _teamGoals.length) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("All ${_teamGoals.length} goals already added."),
        ),
      );
      return;
    }
    setState(() {
      _reviews.add(ReviewEntry());
    });
  }

  void _removeReview(int index) {
    setState(() {
      _reviews[index].commentController.dispose();
      _reviews.removeAt(index);
    });
  }

  List<String> _getAvailablePerspectivesForEntry(ReviewEntry current) {
    final perspectives = _teamGoals.map((g) => g.perspective).toSet();

    final List<String> available = [];

    for (final perspective in perspectives) {
      // total KPIs in this perspective
      final totalKpis = _teamGoals
          .where((g) => g.perspective == perspective)
          .map((g) => g.kpiName)
          .toSet();

      // used KPIs in this perspective (excluding current entry)
      final usedKpis = _reviews
          .where(
            (r) =>
                r != current && r.perspective == perspective && r.kpi != null,
          )
          .map((r) => r.kpi!)
          .toSet();

      // keep perspective if at least one KPI is free
      if (usedKpis.length < totalKpis.length ||
          current.perspective == perspective) {
        available.add(perspective);
      }
    }

    return available;
  }

  InputDecoration _dropdownDecoration({required String label, IconData? icon}) {
    const darkPeak = Color(0xFF003648);

    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(
        color: darkPeak,
        fontWeight: FontWeight.w600,
        fontSize: 13,
      ),
      floatingLabelStyle: const TextStyle(
        color: darkPeak,
        fontWeight: FontWeight.w700,
        fontSize: 13,
      ),
      prefixIcon: icon != null
          ? Icon(icon, size: 20, color: const Color(0xFF00657F))
          : null,
      filled: true,
      fillColor: const Color(0xFFF5F7FA),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: Colors.grey.shade300, width: 1),
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: Colors.grey.shade300, width: 1),
      ),
      focusedBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: darkPeak, width: 1.4),
      ),
    );
  }

  Theme _dropdownTheme(BuildContext context, Widget child) {
    return Theme(
      data: Theme.of(context).copyWith(canvasColor: Colors.white),
      child: DropdownButtonHideUnderline(child: child),
    );
  }

  bool get _isCurrentFilterMonth {
    if (_selectedMonth == null || _selectedYear == null) return false;
    var now = DateTime.now();
    if (now.day <= 5) {
      now = DateTime(now.year, now.month - 1, now.day);
    }
    return _selectedMonth == now.month.toString().padLeft(2, '0') &&
        _selectedYear == now.year.toString();
  }

  @override
  Widget build(BuildContext context) {
    final showForm = (_reviewForFilter == null && _isCurrentFilterMonth);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: Text(
          "${widget.internName} Review",
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        flexibleSpace: Container(color: const Color(0xFF00657F)),
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _refreshAllData,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                children: [
                  _buildMonthYearFilter(),
                  const SizedBox(height: 16),
                  if (_noRecordForFilter && !_isCurrentFilterMonth)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3E0),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'No record found for selected month',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF8D6E63),
                        ),
                      ),
                    ),
                  if (showForm) ...[
                    const SizedBox(height: 8),
                    _buildReviewForm(),
                  ] else if (_reviewForFilter != null) ...[
                    const SizedBox(height: 8),
                    _buildGradedView(),
                  ] else if (!_isCurrentFilterMonth && !_noRecordForFilter) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Select a month and year to view or give review',
                      style: TextStyle(fontSize: 13, color: Color(0xFF757575)),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_isTemplatesLoading)
            Container(
              color: Colors.black.withOpacity(0.2),
              child: const Center(
                child: CircularProgressIndicator(color: Color(0xFF00657F)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMonthYearFilter() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: _dropdownTheme(
              context,
              DropdownButtonFormField2<String>(
                dropdownStyleData: DropdownStyleData(
                  width: MediaQuery.of(context).size.width * 0.43,
                  offset: const Offset(0, 0),
                  decoration: BoxDecoration(
                    color: Colors.white, // 👈 clean white background
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.12),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                ),
                value: _selectedMonth,
                items: _months
                    .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                    .toList(),
                onChanged: (v) async {
                  setState(() {
                    _selectedMonth = v;
                    _reviewForFilter = null;
                    _noRecordForFilter = false;
                  });
                  await _fetchReviewByMonth(); // auto fetch on change
                },
                decoration: _dropdownDecoration(
                  label: "Month",
                  icon: Icons.calendar_today,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _dropdownTheme(
              context,
              DropdownButtonFormField2<String>(
                dropdownStyleData: DropdownStyleData(
                  width: MediaQuery.of(context).size.width * 0.43,
                  offset: const Offset(0, 0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.12),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                ),
                value: _selectedYear,
                items: _years
                    .map((y) => DropdownMenuItem(value: y, child: Text(y)))
                    .toList(),
                onChanged: (v) async {
                  setState(() {
                    _selectedYear = v;
                    _reviewForFilter = null;
                    _noRecordForFilter = false;
                  });
                  await _fetchReviewByMonth(); // auto fetch on change
                },
                decoration: _dropdownDecoration(
                  label: "Year",
                  icon: Icons.event_available,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGradedView() {
    final review = _reviewForFilter!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // header card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
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
                  color: const Color(0xFF00657F).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.assessment_rounded,
                  color: Color(0xFF00657F),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.team,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF003648),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      review.date ?? '',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF757575),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 12),
        // overall
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: const Color(0xFFE8F5E9),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF2E7D32).withOpacity(0.5)),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.verified_rounded,
                size: 20,
                color: Color(0xFF2E7D32),
              ),
              const SizedBox(width: 8),
              Text(
                'Overall Score: ${review.overallPercentage.toStringAsFixed(1)}%',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2E7D32),
                ),
              ),
            ],
          ),
        ),
        // goals
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: review.goals.length,
          itemBuilder: (context, index) {
            final goal = review.goals[index];
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              color: Colors.white,
              elevation: 1,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      goal.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: Color(0xFF212121),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      goal.description,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF616161),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Text(
                          'Weight: ${goal.weight}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF757575),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Text(
                          'Grade: ${goal.grade ?? "-"}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF00657F),
                          ),
                        ),
                      ],
                    ),
                    if (goal.comment != null && goal.comment!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Comment: ${goal.comment}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF424242),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildReviewForm() {
    return Column(
      children: [
        // Team selection dropdown
        Padding(
          padding: const EdgeInsets.only(
            left: 16,
            top: 4,
            bottom: 4,
            right: 16,
          ),
          child: _dropdownTheme(
            context,
            DropdownButtonFormField<String>(
              isExpanded: true,
              borderRadius: BorderRadius.circular(14),
              dropdownColor: Colors.white,
              icon: const Icon(Icons.keyboard_arrow_down_rounded),
              style: const TextStyle(fontSize: 14, color: Color(0xFF212121)),
              decoration: _dropdownDecoration(
                label: "Select Team",
                icon: Icons.groups_2_outlined,
              ),
              // Safety: Ensure _selectedTeam exists in the items to prevent crash
              initialValue: (() {
                if (_selectedTeam == null) return null;
                final teamLower = _selectedTeam!.toLowerCase();

                if (_dynamicTemplates.isEmpty) {
                  const hardcoded = [
                    "Software Development",
                    "Marketing",
                    "Business Development",
                  ];
                  return hardcoded.any((t) => t.toLowerCase() == teamLower)
                      ? hardcoded.firstWhere(
                          (t) => t.toLowerCase() == teamLower,
                        )
                      : null;
                }

                final template = _dynamicTemplates.firstWhere(
                  (t) =>
                      (t['category'] as String).toLowerCase() == teamLower ||
                      (t['roleName'] as String).toLowerCase() == teamLower,
                  orElse: () => {},
                );

                return template.isNotEmpty
                    ? (template['roleName'] ?? template['category']) as String
                    : null;
              })(),
              items: _dynamicTemplates.isEmpty
                  ? [
                          "Software Development",
                          "Marketing",
                          "Business Development",
                        ]
                        .map(
                          (t) => DropdownMenuItem(
                            value: t,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              child: Text(t),
                            ),
                          ),
                        )
                        .toList()
                  : _dynamicTemplates
                        .map((t) => (t['roleName'] ?? t['category']) as String)
                        .toSet()
                        .map(
                          (t) => DropdownMenuItem(
                            value: t,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              child: Text(t),
                            ),
                          ),
                        )
                        .toList(),
              onChanged: _onTeamSelected,
            ),
          ),
        ),
        const SizedBox(height: 14),

        if (_selectedTeam != null)
          ..._reviews.asMap().entries.map((entry) {
            final index = entry.key;
            final review = entry.value;
            final kpis = _getAvailableKpisForEntry(review, review.perspective);
            return _buildGoalEntry(index, review, kpis);
          }),

        if (_selectedTeam != null)
          TextButton.icon(
            onPressed: _addReview,
            icon: const Icon(
              Icons.add_circle_outline,
              color: Color(0xFF00657F),
            ),
            label: const Text(
              "Add Another Goal",
              style: TextStyle(
                color: Color(0xFF00657F),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        const SizedBox(height: 8),
        if (_selectedTeam != null)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitReview,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00657F),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                "Submit All Reviews",
                style: TextStyle(fontSize: 15, color: Colors.white),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildGoalEntry(int index, ReviewEntry review, List<String> kpis) {
    final perspectives = _getAvailablePerspectivesForEntry(review);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  "Goal ${index + 1}",
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: Color(0xFF003648),
                  ),
                ),
                const Spacer(),
                if (_reviews.length > 1)
                  IconButton(
                    icon: const Icon(
                      Icons.delete_outline,
                      color: Color(0xFFB00020),
                    ),
                    onPressed: () => _removeReview(index),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // Perspective dropdown
            _dropdownTheme(
              context,
              DropdownButtonFormField<String>(
                isExpanded: true,
                borderRadius: BorderRadius.circular(14),
                dropdownColor: Colors.white,
                icon: const Icon(Icons.keyboard_arrow_down_rounded),
                style: const TextStyle(fontSize: 14, color: Color(0xFF212121)),
                decoration: _dropdownDecoration(
                  label: "Perspective",
                  icon: Icons.category_outlined,
                ),
                initialValue: review.perspective,
                items: perspectives
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (value) {
                  setState(() {
                    review.perspective = value;
                    review.kpi = null;
                    review.goal = null;
                  });
                },
              ),
            ),
            const SizedBox(height: 12),

            // KPI dropdown
            _dropdownTheme(
              context,
              DropdownButtonFormField<String>(
                isExpanded: true,
                borderRadius: BorderRadius.circular(14),
                dropdownColor: Colors.white,
                icon: const Icon(Icons.keyboard_arrow_down_rounded),
                style: const TextStyle(fontSize: 14, color: Color(0xFF212121)),
                decoration: _dropdownDecoration(
                  label: "KPI Name",
                  icon: Icons.speed_rounded,
                ),
                initialValue: review.kpi,
                items: kpis
                    .map(
                      (k) => DropdownMenuItem(
                        value: k,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Text(k),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  setState(() {
                    review.kpi = value;
                    review.goal = _teamGoals.firstWhere(
                      (g) =>
                          g.perspective == review.perspective &&
                          g.kpiName == review.kpi,
                    );
                  });
                },
              ),
            ),
            const SizedBox(height: 14),

            if (review.goal != null) ...[
              Text(
                review.goal!.title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                  color: Color(0xFF003648),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                review.goal!.description,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
              ),
              const SizedBox(height: 14),
              TextField(
                enableInteractiveSelection: false,
                controller: review.commentController,
                maxLines: 4,
                maxLength: 5000,
                buildCounter:
                    (
                      BuildContext context, {
                      required int currentLength,
                      required bool isFocused,
                      required int? maxLength,
                    }) {
                      return Text(
                        "$currentLength/80 (Min)",
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: currentLength < 5 ? Colors.red : Colors.green,
                        ),
                      );
                    },
                decoration: InputDecoration(
                  labelText: "Reviewer comments",
                  labelStyle: const TextStyle(
                    color: Color(0xFF003648),
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),

                  floatingLabelStyle: const TextStyle(
                    color: Color(0xFF003648),
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                  alignLabelWithHint: true,
                  filled: true,
                  fillColor: const Color(0xFFF5F7FA),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: Colors.grey.shade300,
                      width: 1,
                    ),
                  ),
                  focusedBorder: const OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(14)),
                    borderSide: BorderSide(
                      color: Color(0xFF003648),
                      width: 1.4,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    for (final review in _reviews) {
      review.commentController.dispose();
    }
    super.dispose();
  }
}
