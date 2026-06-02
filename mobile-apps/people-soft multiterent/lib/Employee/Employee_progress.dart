import 'dart:convert';
import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;

class EmployeeProgress extends StatefulWidget {
  final String employeeId;
  final String employeeName;

  const EmployeeProgress({
    required this.employeeId,
    required this.employeeName,
    super.key,
  });

  @override
  State<EmployeeProgress> createState() => _EmployeeProgressState();
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
  final String employeeId;
  final String employeeName;
  final String team;
  final bool isGraded;
  final double overallPercentage;
  final List<GoalModel> goals;
  final String? date;

  ReviewModel({
    required this.employeeId,
    required this.employeeName,
    required this.team,
    required this.isGraded,
    required this.overallPercentage,
    required this.goals,
    this.date,
  });

  factory ReviewModel.fromJson(Map<String, dynamic> json) {
    return ReviewModel(
      employeeId: json['employeeId'],
      employeeName: json['employeeName'],
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

// ---------- State ----------
class _EmployeeProgressState extends State<EmployeeProgress> {
  String? _selectedTeam;
  List<GoalDefinition> _teamGoals = [];
  List<ReviewEntry> _reviews = [ReviewEntry()];
  ReviewModel? _reviewForFilter;
  bool _noRecordForFilter = false;

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

  // ---------- Goals (same as intern) ----------
  final List<GoalDefinition> _devGoals = [
    GoalDefinition(
      perspective: "Quality Perspective",
      kpiName: "Error/Rework Rate",
      title: "Deliver High-Quality Output",
      description:
          "Ensure all assigned work meets expected standards with minimal corrections or rework required.",
      weight: 25,
    ),
    GoalDefinition(
      perspective: "Quality Perspective",
      kpiName: "Standards Compliance",
      title: "Adherence to Standards",
      description:
          "Follow all internal coding, design, and documentation standards consistently.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Timeliness Perspective",
      kpiName: "Task Delivery Timeliness",
      title: "On-Time Task Completion",
      description:
          "Complete assigned tasks within the agreed timelines to support smooth project execution.",
      weight: 25,
    ),
    GoalDefinition(
      perspective: "Timeliness Perspective",
      kpiName: "ETA Accuracy",
      title: "Effective Task Planning",
      description:
          "Provide clear ETAs and manage priorities based on urgency and importance.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Collaboration Perspective",
      kpiName: "Communication Effectiveness",
      title: "Clear Communication",
      description:
          "Share timely updates, highlight blockers early, and communicate progress effectively.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Collaboration Perspective",
      kpiName: "Team Collaboration Score",
      title: "Team Support & Cooperation",
      description:
          "Collaborate well with peers, participate in discussions, and assist team members when needed.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Improvement Perspective",
      kpiName: "Improvement Contributions",
      title: "Suggest Process/Product Improvements",
      description:
          "Propose practical ideas that enhance product quality or team efficiency.",
      weight: 5,
    ),
    GoalDefinition(
      perspective: "Improvement Perspective",
      kpiName: "Skill Enhancement Activity",
      title: "Skill Development",
      description:
          "Continuously learn new skills and apply them to improve work performance.",
      weight: 5,
    ),
  ];

  final List<GoalDefinition> _marketingGoals = [
    GoalDefinition(
      perspective: "Quality Perspective",
      kpiName: "Lead Quality Score",
      title: "Lead Qualification & Targeting",
      description:
          "Ensure leads generated or contacted are relevant, correctly profiled, and aligned with target customer segments.",
      weight: 25,
    ),
    GoalDefinition(
      perspective: "Quality Perspective",
      kpiName: "Proposal/ Communication Accuracy",
      title: "Accurate Client Communication",
      description:
          "Share accurate, clear proposals, messages, and presentations with minimal corrections or clarifications needed.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Timeliness Perspective",
      kpiName: "Follow-Up Timeliness",
      title: "Prompt Lead/Client Follow-ups",
      description:
          "Ensure timely follow-ups with prospects and clients to avoid missed opportunities.",
      weight: 25,
    ),
    GoalDefinition(
      perspective: "Timeliness Perspective",
      kpiName: "Pipeline Update Frequency",
      title: "Up-to-Date Sales Pipeline",
      description:
          "Maintain updated records of leads, statuses, and interactions for transparency and planning.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Collaboration Perspective",
      kpiName: "Cross-Team Coordination Score",
      title: "Collaboration with Marketing & Product Teams",
      description:
          "Work effectively with marketing and product teams to align messaging, campaigns, and client requirements.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Collaboration Perspective",
      kpiName: "Communication Effectiveness",
      title: "Internal & Client Communication",
      description:
          "Provide clear, timely communication to clients and internal teams regarding requirements, progress, and blockers.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Improvement Perspective",
      kpiName: "Opportunity Identification",
      title: "Market & Opportunity Research",
      description:
          "Identify new business opportunities, sectors, or client categories that can drive revenue growth.",
      weight: 5,
    ),
    GoalDefinition(
      perspective: "Improvement Perspective",
      kpiName: "Skill Enhancement Activity",
      title: "Sales & Marketing Skill Development",
      description:
          "Continuously learn new sales techniques, CRM practices, or marketing strategies to improve performance.",
      weight: 5,
    ),
  ];
  final List<GoalDefinition> _businessDevGoals = [
    GoalDefinition(
      perspective: "Quality Perspective",
      kpiName: "Lead Conversion Quality",
      title: "Effective Lead Conversion",
      description:
          "Focus on converting qualified leads into paying clients through proper need understanding, structured pitching, and professional communication.",
      weight: 25,
    ),
    GoalDefinition(
      perspective: "Quality Perspective",
      kpiName: "Sales Communication Accuracy",
      title: "Professional Client Communication",
      description:
          "Ensure proposals, quotations, and business discussions are accurate, clear, and aligned with company offerings with minimal correction required.",
      weight: 10,
    ),
    GoalDefinition(
      perspective: "Timeliness Perspective",
      kpiName: "Target Achievement Timeliness",
      title: "On-Time Target Achievement",
      description:
          "Consistently work towards achieving weekly and monthly sales targets within defined timelines without excessive follow-ups from management.",
      weight: 15,
    ),
    GoalDefinition(
      perspective: "Timeliness Perspective",
      kpiName: "Follow-Up Discipline",
      title: "Structured Lead Follow-Up",
      description:
          "Maintain disciplined and timely follow-ups with prospects to prevent opportunity loss and keep the sales pipeline active.",
      weight: 15,
    ),
    GoalDefinition(
      perspective: "Collaboration Perspective",
      kpiName: "Cross-Team Coordination",
      title: "Internal Coordination for Client Onboarding",
      description:
          "Coordinate effectively with marketing and development teams to ensure smooth client onboarding and requirement clarity.",
      weight: 15,
    ),
    GoalDefinition(
      perspective: "Collaboration Perspective",
      kpiName: "Reporting & Transparency",
      title: "Accurate Sales Reporting",
      description:
          "Maintain updated records of leads, conversations, deal status, and submit periodic reports to management transparently.",
      weight: 15,
    ),
    GoalDefinition(
      perspective: "Improvement Perspective",
      kpiName: "Opportunity Identification",
      title: "Market & Client Expansion",
      description:
          "Proactively identify new business opportunities, industry segments, or client categories that can contribute to revenue growth.",
      weight: 15,
    ),
    GoalDefinition(
      perspective: "Improvement Perspective",
      kpiName: "Skill Enhancement Activity",
      title: "Sales Skill Development",
      description:
          "Continuously improve communication, negotiation, and persuasion skills and apply learnings to enhance sales performance.",
      weight: 15,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _initCurrentMonthDefaults();
    _fetchReviewByMonth();
  }

  void _initCurrentMonthDefaults() {
    var now = DateTime.now();
    if (now.day <= 5) {
      now = DateTime(now.year, now.month - 1, now.day);
    }
    _selectedMonth = now.month.toString().padLeft(2, '0');
    _selectedYear = now.year.toString();
  }

  // ---------- Fetch by selected month/year (employee endpoint) ----------
  Future<void> _fetchReviewByMonth() async {
    if (_selectedMonth == null || _selectedYear == null) return;

    final monthStr = "${_selectedYear!}-${_selectedMonth!}";
    final uri = Uri.parse(
      '${getBaseUrl()}/api/employee-reviews/${widget.employeeId}?month=$monthStr',
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

  // ---------- Helper methods ----------
  Map<String, dynamic> _buildPayload() {
    return {
      "employeeId": widget.employeeId,
      "employeeName": widget.employeeName,
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
          content: Text(
            "Each reviewer comment must contain at least 80 characters.",
          ),
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
    final url = Uri.parse("${getBaseUrl()}/api/employee-reviews/submit-review");
    print(url);

    final res = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(payload),
    );

    if (res.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Review submitted successfully.")),
      );
      setState(() {
        _reviewForFilter = null;
        _noRecordForFilter = false;
      });
      _fetchReviewByMonth(); // Refresh after submit
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
    setState(() {
      _selectedTeam = team;
      _teamGoals = team == "Software Development"
          ? _devGoals
          : team == "Marketing"
          ? _marketingGoals
          : _businessDevGoals;
      _reviews = [ReviewEntry()];
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
          "${widget.employeeName} Review",
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        flexibleSpace: Container(color: const Color(0xFF00657F)),
      ),
      body: SingleChildScrollView(
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
                  style: TextStyle(fontSize: 13, color: Color(0xFF8D6E63)),
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
    );
  }

  // ---------- All UI methods (identical to intern version) ----------
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
                  width: MediaQuery.of(context).size.width * 0.4,
                  offset: const Offset(0, -16),
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
                  await _fetchReviewByMonth();
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
                  width: MediaQuery.of(context).size.width * 0.45,
                  offset: const Offset(0, -16),
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
                  await _fetchReviewByMonth();
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
              initialValue: _selectedTeam,
              items:
                  const [
                        "Software Development",
                        "Marketing",
                        "Business Development",
                      ]
                      .map(
                        (t) => DropdownMenuItem(
                          value: t,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
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
                controller: review.commentController,
                maxLines: 4,
                maxLength: 250,
                buildCounter:
                    (
                      BuildContext context, {
                      required int currentLength,
                      required bool isFocused,
                      required int? maxLength,
                    }) {
                      return Text(
                        "$currentLength/80",
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: currentLength < 60 ? Colors.red : Colors.green,
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
