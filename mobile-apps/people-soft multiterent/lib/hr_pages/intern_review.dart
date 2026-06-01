import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;

class InternReview extends StatefulWidget {
  final String internId;
  final String internName;

  const InternReview({
    super.key,
    required this.internId,
    required this.internName,
  });

  @override
  State<InternReview> createState() => _InternReviewState();
}

class _InternReviewState extends State<InternReview> {
  late Future<ReviewModel?> _reviewFuture;
  final List<String?> _grades = [];
  String _selectedMonth = '';

  @override
  void initState() {
    super.initState();
    var now = DateTime.now();
    if (now.day <= 5) {
      now = DateTime(now.year, now.month - 1, now.day);
    }
    _selectedMonth = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    _reviewFuture = _fetchReview();
  }

  /* ---------------- FETCH REVIEW ---------------- */

  Future<ReviewModel?> _fetchReview() async {
    final uri = Uri.parse(
      '${getBaseUrl()}/api/reviews/${widget.internId}?month=$_selectedMonth',
    );

    final res = await http.get(uri);

    if (res.statusCode == 404) {
      _grades.clear();
      return null;
    }

    if (res.statusCode != 200) {
      throw Exception('Failed to load review');
    }

    final decoded = jsonDecode(res.body);
    final data = decoded['data'];

    if (data == null) return null;

    final review = ReviewModel.fromJson(data);

    _grades
      ..clear()
      ..addAll(
        review.goals.map(
          (g) => g.grade != null && g.grade!.isNotEmpty ? g.grade : null,
        ),
      );

    return review;
  }

  /* ---------------- SUBMIT GRADES ---------------- */

  Future<void> _submitGrades(ReviewModel review) async {
    if (_grades.any((g) => g == null || g.isEmpty)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please grade all goals')));
      return;
    }

    final uri = Uri.parse(
      '${getBaseUrl()}/api/reviews/${review.internId}/grade?month=$_selectedMonth',
    );

    final body = {
      'goals': List.generate(review.goals.length, (i) {
        return {'_id': review.goals[i].id, 'grade': _grades[i]};
      }),
    };

    final res = await http.put(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );

    final decoded = jsonDecode(res.body);

    if (res.statusCode != 200 || decoded['success'] != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(decoded['message'] ?? 'Failed to save review')),
      );
      return;
    }

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Review saved successfully')));

    setState(() {
      _reviewFuture = _fetchReview();
    });
  }

  /* ---------------- UI ---------------- */

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        title: Text(
          'Review - ${widget.internName}',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        centerTitle: false,
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(child: _monthSelector()),
                const SizedBox(width: 12),
                const Icon(
                  Icons.info_outline_rounded,
                  size: 18,
                  color: Color(0xFF757575),
                ),
                const SizedBox(width: 4),
                const Text(
                  'Last 6 months',
                  style: TextStyle(fontSize: 11, color: Color(0xFF757575)),
                ),
              ],
            ),
          ),
          // const Divider(height: 0),
          Expanded(
            child: FutureBuilder<ReviewModel?>(
              future: _reviewFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: Color(0xFF00657F)),
                  );
                }

                if (snapshot.hasError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        snapshot.error.toString(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFFB00020),
                          fontSize: 13,
                        ),
                      ),
                    ),
                  );
                }

                final review = snapshot.data;
                if (review == null) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'No review submitted for this month',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF757575),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  );
                }

                return Column(
                  children: [
                    _reviewHeader(review),
                    SizedBox(height: 16),
                    if (review.isGraded)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                        child: _overallScoreChip(review.overallPercentage),
                      ),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                        itemCount: review.goals.length,
                        itemBuilder: (context, index) =>
                            _goalCard(review, index),
                      ),
                    ),
                    if (!review.isGraded) _saveButton(review),
                    if (review.isGraded)
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 8, 16, 16),
                        child: Text(
                          'Review already graded for this month',
                          style: TextStyle(
                            color: Color(0xFF757575),
                            fontSize: 13,
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /* ---------------- WIDGETS ---------------- */

  Widget _reviewHeader(ReviewModel review) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color.fromARGB(19, 0, 0, 0),
            blurRadius: 8,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00657F).withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.assessment_rounded,
              color: Color(0xFF00657F),
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  review.team.isEmpty ? 'Team not set' : review.team,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Color(0xFF003648),
                  ),
                ),
                const SizedBox(height: 2),
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
    );
  }

  Widget _overallScoreChip(double percentage) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2E7D32).withOpacity(0.4)),
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
            'Overall Score: ${percentage.toStringAsFixed(1)}%',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2E7D32),
            ),
          ),
        ],
      ),
    );
  }

  Widget _goalCard(ReviewModel review, int index) {
    final goal = review.goals[index];
    final grade = _grades[index];

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      elevation: 1,
      color: const Color.fromARGB(255, 255, 255, 255), // very light card tint
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Perspective + weight
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00657F).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    goal.perspective,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF00657F),
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  'Weight: ${goal.weight}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF757575),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Title
            Text(
              goal.title,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF212121),
              ),
            ),
            const SizedBox(height: 4),

            // Description
            Text(
              goal.description,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF424242),
                height: 1.3,
              ),
            ),
            const SizedBox(height: 6),

            // KPI
            Text(
              'KPI: ${goal.kpi}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF616161)),
            ),

            // Comment
            if (goal.comment != null && goal.comment!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE4F2F5), // subtle teal-grey
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Comment: ${goal.comment}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF274046),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 12),

            // Grade chips
            Row(
              children: ['A', 'B', 'C', 'D'].map((g) {
                final selected = grade == g;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 2,
                    ),
                    child: ChoiceChip(
                      label: Text(
                        g,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: selected
                              ? FontWeight.bold
                              : FontWeight.w500,
                          color: selected
                              ? Colors.white
                              : const Color(0xFF00657F),
                        ),
                      ),
                      selected: selected,
                      selectedColor: const Color(0xFF00657F),
                      backgroundColor: const Color(0xFFE0F2F5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(50),
                        side: BorderSide(
                          color: selected
                              ? const Color(0xFF004D5A)
                              : const Color(0xFFB0D6DD),
                          width: 1.5,
                        ),
                      ),
                      elevation: selected ? 4 : 1,
                      shadowColor: selected
                          ? Colors.black45
                          : Colors.transparent,
                      onSelected: review.isGraded
                          ? null
                          : (_) => setState(() => _grades[index] = g),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _saveButton(ReviewModel review) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: const BoxDecoration(
        color: Color(0xFFF5F1ED),
        boxShadow: [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 10,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton.icon(
          onPressed: () => _submitGrades(review),
          icon: const Icon(Icons.save_rounded, size: 20),
          label: const Text(
            'Save Review',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF00657F),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ),
    );
  }

  Widget _monthSelector() {
    var now = DateTime.now();
    if (now.day <= 5) {
      now = DateTime(now.year, now.month - 1, now.day);
    }
    final months = List.generate(6, (i) {
      final d = DateTime(now.year, now.month - i);
      return '${d.year}-${d.month.toString().padLeft(2, '0')}';
    });

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F7FA),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF459DB2).withOpacity(0.5)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          borderRadius: BorderRadius.circular(14),
          value: _selectedMonth,
          icon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: Color(0xFF146374),
          ),
          dropdownColor: Colors.white,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF146374),
          ),
          items: months
              .map((m) => DropdownMenuItem(value: m, child: Text(m)))
              .toList(),
          onChanged: (v) {
            if (v != null) {
              setState(() {
                _selectedMonth = v;
                _reviewFuture = _fetchReview();
              });
            }
          },
        ),
      ),
    );
  }
}

/* ---------------- MODELS ---------------- */

class ReviewModel {
  final String internId;
  final String internName;
  final String team;
  final String? date;
  final bool isGraded;
  final double overallPercentage;
  final List<GoalModel> goals;

  ReviewModel({
    required this.internId,
    required this.internName,
    required this.team,
    required this.goals,
    required this.isGraded,
    required this.overallPercentage,
    this.date,
  });

  factory ReviewModel.fromJson(Map<String, dynamic> json) {
    return ReviewModel(
      internId: json['internId'] ?? '',
      internName: json['internName'] ?? '',
      team: json['team'] ?? '',
      date: json['date'],
      isGraded: json['isGraded'] ?? false,
      overallPercentage: (json['summary']?['percentage'] ?? 0).toDouble(),
      goals: (json['goals'] as List? ?? [])
          .map((g) => GoalModel.fromJson(g))
          .toList(),
    );
  }
}

class GoalModel {
  final String id;
  final String perspective;
  final String kpi;
  final String title;
  final String description;
  final int weight;
  final String? grade;
  final String? comment;

  GoalModel({
    required this.id,
    required this.perspective,
    required this.kpi,
    required this.title,
    required this.description,
    required this.weight,
    this.grade,
    this.comment,
  });

  factory GoalModel.fromJson(Map<String, dynamic> json) {
    return GoalModel(
      id: json['_id'] ?? '',
      perspective: json['perspective'] ?? '',
      kpi: json['kpi'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      weight: json['weight'] ?? 0,
      grade: json['grade'],
      comment: json['comment'],
    );
  }
}
