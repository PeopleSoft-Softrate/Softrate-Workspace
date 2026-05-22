import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/hr_pages/intern_review.dart';

class ManagerAppraisalPage extends StatefulWidget {
  const ManagerAppraisalPage({super.key});

  @override
  State<ManagerAppraisalPage> createState() => _ManagerAppraisalPageState();
}

class _ManagerAppraisalPageState extends State<ManagerAppraisalPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isInternsLoading = true;
  List<dynamic> _assignedInterns = [];

  // Sophisticated Teal Management Palette
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  // Demo Data
  final List<Map<String, dynamic>> _teamMembers = [
    {
      "name": "Alex Johnson",
      "role": "Sr. Developer",
      "rating": 4.5,
      "feedback": "Excellent performance this quarter.",
    },
    {
      "name": "Sarah Williams",
      "role": "UI Designer",
      "rating": 0.0,
      "feedback": "",
    },
    {
      "name": "Michael Chen",
      "role": "QA Engineer",
      "rating": 4.0,
      "feedback": "Very diligent and proactive.",
    },
  ];

  final List<Map<String, dynamic>> _assetRequests = [
    {
      "name": "Emily Davis",
      "asset": "MacBook Pro M3",
      "reason": "Current laptop performance issues.",
      "status": "Pending",
    },
    {
      "name": "David Miller",
      "asset": "Dell 27\" Monitor",
      "reason": "Dual monitor setup for coding.",
      "status": "Pending",
    },
    {
      "name": "Alex Johnson",
      "asset": "Mechanical Keyboard",
      "reason": "Ergonomic needs.",
      "status": "Approved",
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchAssignedInterns();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchAssignedInterns() async {
    setState(() => _isInternsLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final managerMongoId = prefs.getString("manager_mongo_id");

      if (managerMongoId == null) {
        setState(() => _isInternsLoading = false);
        return;
      }

      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/assignments/team/$managerMongoId"),
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        setState(() {
          _assignedInterns = data['interns'] ?? [];
          _isInternsLoading = false;
        });
      } else {
        setState(() => _isInternsLoading = false);
      }
    } catch (e) {
      print("Error fetching assigned interns: $e");
      setState(() => _isInternsLoading = false);
    }
  }

  void _showRatingDialog(int index) {
    double selectedRating = _teamMembers[index]["rating"] == 0.0
        ? 3.0
        : _teamMembers[index]["rating"];
    final TextEditingController feedbackController = TextEditingController(
      text: _teamMembers[index]["feedback"],
    );

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: surfaceColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            "Rate ${_teamMembers[index]["name"]}",
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16.5, color: primaryColor),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text("PERFORMANCE RATING", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: subtitleColor, letterSpacing: 0.4)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (starIndex) {
                  return IconButton(
                    onPressed: () => setDialogState(() => selectedRating = starIndex + 1.0),
                    icon: Icon(
                      starIndex < selectedRating ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: Colors.amber.shade600,
                      size: 36,
                    ),
                  );
                }),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: feedbackController,
                maxLines: 3,
                style: const TextStyle(fontSize: 14, color: primaryColor, fontWeight: FontWeight.w500),
                decoration: InputDecoration(
                  hintText: "Add specific feedback...",
                  hintStyle: const TextStyle(fontSize: 13, color: subtitleColor),
                  filled: true,
                  fillColor: backgroundColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.all(16),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel", style: TextStyle(color: subtitleColor, fontWeight: FontWeight.w600)),
            ),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _teamMembers[index]["rating"] = selectedRating;
                  _teamMembers[index]["feedback"] = feedbackController.text;
                });
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: primaryColor,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    content: const Text("Rating submitted successfully", style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text("Submit", style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  void _updateAssetStatus(int index, String status) {
    setState(() {
      _assetRequests[index]["status"] = status;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: primaryColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Text("Request $status successfully", style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildProfessionalHeader(),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [_buildRatingsTab(), _buildInternReviewsTab(), _buildAssetRequestsTab()],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfessionalHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildModernIconButton(Icons.arrow_back_ios_new_rounded, () => Navigator.pop(context)),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Appraisal",
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontSize: 24,
                        letterSpacing: -1.0,
                      ),
                    ),
                    Text(
                      "PERFORMANCE & ASSET TRACKER",
                      style: TextStyle(
                        color: subtitleColor,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          TabBar(
            controller: _tabController,
            labelColor: primaryColor,
            unselectedLabelColor: subtitleColor,
            indicatorColor: primaryColor,
            indicatorSize: TabBarIndicatorSize.label,
            dividerColor: Colors.transparent,
            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            tabs: const [
              Tab(text: "Team Ratings"),
              Tab(text: "Intern Reviews"),
              Tab(text: "Asset Requests"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRatingsTab() {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      itemCount: _teamMembers.length,
      itemBuilder: (context, index) {
        final member = _teamMembers[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderColor.withValues(alpha: 0.8)),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 15, offset: const Offset(0, 8)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: primaryColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        member["name"][0],
                        style: const TextStyle(color: primaryColor, fontWeight: FontWeight.w600, fontSize: 16),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(member["name"], style: const TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 14.5)),
                        Text(member["role"], style: const TextStyle(color: subtitleColor, fontSize: 10.5, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  _ratingBadge(member["rating"]),
                ],
              ),
              if (member["feedback"].isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: backgroundColor,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    member["feedback"],
                    style: const TextStyle(fontSize: 12, color: primaryColor, fontStyle: FontStyle.italic, height: 1.5, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: _buildActionBtn("Update Rating & Feedback", Icons.edit_note_rounded, primaryColor, () => _showRatingDialog(index)),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInternReviewsTab() {
    if (_isInternsLoading) {
      return const Center(child: CircularProgressIndicator(color: primaryColor));
    }

    if (_assignedInterns.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.rate_review_rounded, size: 64, color: subtitleColor),
            SizedBox(height: 16),
            Text(
              "No assigned interns found",
              style: TextStyle(color: subtitleColor, fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      itemCount: _assignedInterns.length,
      itemBuilder: (context, index) {
        final intern = _assignedInterns[index];
        final name = intern['fullName'] ?? 'Unknown Intern';
        final role = intern['role'] ?? 'Intern';
        final dept = intern['department'] ?? 'N/A';
        final college = intern['college'] ?? 'N/A';
        final String internId = intern['internid'] ?? intern['internId'] ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderColor.withValues(alpha: 0.8)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 15,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: primaryColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        name.isNotEmpty ? name[0] : 'I',
                        style: const TextStyle(
                          color: primaryColor,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: primaryColor,
                            fontSize: 14.5,
                          ),
                        ),
                        Text(
                          "$role • $dept",
                          style: const TextStyle(
                            color: subtitleColor,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.school_rounded, size: 12, color: subtitleColor),
                        const SizedBox(width: 6),
                        Text(
                          "College: $college",
                          style: const TextStyle(
                            fontSize: 11,
                            color: subtitleColor,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    if (internId.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.badge_rounded, size: 12, color: subtitleColor),
                          const SizedBox(width: 6),
                          Text(
                            "ID: $internId",
                            style: const TextStyle(
                              fontSize: 11,
                              color: subtitleColor,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: _buildActionBtn(
                  "Evaluate & Grade Goals",
                  Icons.rate_review_rounded,
                  primaryColor,
                  () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => InternReview(
                          internId: internId,
                          internName: name,
                        ),
                      ),
                    );
                    _fetchAssignedInterns();
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAssetRequestsTab() {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      itemCount: _assetRequests.length,
      itemBuilder: (context, index) {
        final req = _assetRequests[index];
        bool isPending = req["status"] == "Pending";

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderColor.withValues(alpha: 0.8)),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 15, offset: const Offset(0, 8)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      req["asset"],
                      style: const TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 15),
                    ),
                  ),
                  _statusChip(req["status"]),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.person_outline_rounded, size: 14, color: subtitleColor),
                  const SizedBox(width: 6),
                  Text("Requested by: ${req["name"]}", style: const TextStyle(fontSize: 12, color: subtitleColor, fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                "Reason: ${req["reason"]}",
                style: const TextStyle(fontSize: 12, color: subtitleColor, fontWeight: FontWeight.w500),
              ),
              if (isPending) ...[
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(child: _buildSmallActionBtn("Reject", Icons.close_rounded, Colors.red.shade400, () => _updateAssetStatus(index, "Rejected"))),
                    const SizedBox(width: 12),
                    Expanded(child: _buildSmallActionBtn("Approve", Icons.check_circle_rounded, Colors.teal, () => _updateAssetStatus(index, "Approved"))),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildActionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.1)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildSmallActionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.1)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _ratingBadge(double rating) {
    if (rating == 0.0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(10)),
        child: const Text("NO RATING", style: TextStyle(fontSize: 8.5, color: subtitleColor, fontWeight: FontWeight.w600, letterSpacing: 0.4)),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, color: Colors.amber.shade700, size: 14),
          const SizedBox(width: 4),
          Text(
            rating.toString(),
            style: TextStyle(fontWeight: FontWeight.w600, color: Colors.amber.shade700, fontSize: 11.5),
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    Color color = status == "Pending"
        ? Colors.orange
        : (status == "Approved" ? Colors.teal : Colors.red.shade400);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: color, fontSize: 8.5, fontWeight: FontWeight.w600, letterSpacing: 0.5),
      ),
    );
  }

  Widget _buildModernIconButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Icon(icon, color: primaryColor, size: 20),
      ),
    );
  }
}
