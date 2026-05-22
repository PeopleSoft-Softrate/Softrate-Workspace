import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:url_launcher/url_launcher.dart' as url_launcher;

class ManagerRecruitmentPage extends StatefulWidget {
  const ManagerRecruitmentPage({super.key});

  @override
  State<ManagerRecruitmentPage> createState() => _ManagerRecruitmentPageState();
}

class _ManagerRecruitmentPageState extends State<ManagerRecruitmentPage> {
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  String _searchQuery = "";
  String _selectedFilter = "All";
  bool _isLoading = true;
  List<dynamic> _candidates = [];

  @override
  void initState() {
    super.initState();
    _fetchAssignedInterns();
  }

  Future<void> _fetchAssignedInterns() async {
    setState(() => _isLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final managerMongoId = prefs.getString("manager_mongo_id");

      if (managerMongoId == null) {
        setState(() => _isLoading = false);
        return;
      }

      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/intern/assigned-to/$managerMongoId"),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        setState(() {
          _candidates = data.map((intern) {
            return {
              "_id": intern['_id'],
              "name": intern['fullName'] ?? 'Unknown',
              "role": intern['role'] ?? 'Intern',
              "college": intern['college'] ?? 'N/A',
              "exp": intern['year'] ?? 'N/A',
              "department": intern['department'] ?? 'N/A',
              "status": intern['managerApprovalStatus'] ?? 'pending',
              "dotColor": _getStatusColor(intern['managerApprovalStatus']),
              "skills": [intern['department'] ?? 'N/A'],
              "type": intern['applicationType'] == 'Job' ? 'Job' : 'Intern',
              "contact": intern['contact'] ?? 'N/A',
              "emergencyContact": intern['emergencyContact'] ?? 'N/A',
              "email": intern['email'] ?? 'N/A',
              "linkedin": intern['linkedin'] ?? '',
              "createdAt": intern['createdAt'],
            };
          }).toList();
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print("Error fetching interns: $e");
      setState(() => _isLoading = false);
    }
  }

  Color _getStatusColor(String? status) {
    switch (status) {
      case 'approved': return Colors.teal;
      case 'rejected': return Colors.red.shade400;
      default: return const Color(0xFF64748B);
    }
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
        child: Stack(
          children: [
            Positioned(
              top: -100,
              right: -100,
              child: _buildBlurCircle(primaryColor.withOpacity(0.05), 400),
            ),
            SafeArea(
              child: Column(
                children: [
                  _buildProfessionalAppBar(),
                  Expanded(
                    child: _buildCandidateList(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBlurCircle(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }

  Widget _buildProfessionalAppBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
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
                      "Recruitment",
                      style: TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 24, letterSpacing: -1.0),
                    ),
                    Text(
                      "MANAGE ASSIGNED INTERNS",
                      style: TextStyle(color: subtitleColor, fontSize: 9.5, fontWeight: FontWeight.w500, letterSpacing: 1.4),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),
          _buildThemeSearchBar(),
          const SizedBox(height: 16),
          _buildAlignedFilters(),
        ],
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

  Widget _buildThemeSearchBar() {
    return Container(
      decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(16), border: Border.all(color: borderColor)),
      child: TextField(
        onChanged: (val) => setState(() => _searchQuery = val),
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: primaryColor),
        decoration: const InputDecoration(
          hintText: "Search assigned interns...",
          hintStyle: TextStyle(color: subtitleColor, fontSize: 13, fontWeight: FontWeight.w400),
          prefixIcon: Icon(Icons.search_rounded, size: 20, color: primaryColor),
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }

  Widget _buildAlignedFilters() {
    final filters = ["All", "Intern", "Job"];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((filter) {
          final isSelected = _selectedFilter == filter;
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: InkWell(
              onTap: () => setState(() => _selectedFilter = filter),
              borderRadius: BorderRadius.circular(12),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? primaryColor : surfaceColor,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isSelected ? primaryColor : borderColor, width: 1.5),
                  boxShadow: isSelected ? [BoxShadow(color: primaryColor.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4))] : [],
                ),
                child: Text(
                  filter,
                  style: TextStyle(color: isSelected ? Colors.white : subtitleColor, fontSize: 11.5, fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildCandidateList() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: primaryColor));
    }

    final filtered = _candidates.where((c) {
      final nameMatch = c['name'].toLowerCase().contains(_searchQuery.toLowerCase());
      final typeMatch = _selectedFilter == "All" || c['type'] == _selectedFilter;
      final statusMatch = c['status'] == 'pending'; // Only show pending
      return nameMatch && typeMatch && statusMatch;
    }).toList();

    if (filtered.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_off_rounded, size: 70, color: borderColor),
            SizedBox(height: 16),
            Text("No assigned interns found", style: TextStyle(color: subtitleColor, fontSize: 14, fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        final c = filtered[index];
        return _buildProfessionalCandidateCard(c);
      },
    );
  }

  Widget _buildProfessionalCandidateCard(Map<String, dynamic> c) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderColor.withOpacity(0.8)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 15, offset: const Offset(0, 8))],
      ),
      child: ExpansionTile(
        shape: const RoundedRectangleBorder(side: BorderSide.none),
        collapsedShape: const RoundedRectangleBorder(side: BorderSide.none),
        tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        leading: Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(color: primaryColor.withOpacity(0.1), borderRadius: BorderRadius.circular(16)),
          child: Center(child: Text(c['name'][0], style: const TextStyle(color: primaryColor, fontWeight: FontWeight.w700, fontSize: 22))),
        ),
        title: Text(c['name'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: primaryColor, letterSpacing: -0.3)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Row(
            children: [
              const Icon(Icons.school_rounded, size: 11, color: subtitleColor),
              const SizedBox(width: 4),
              Text(c['exp'], style: const TextStyle(fontSize: 11.5, color: subtitleColor, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
        trailing: _buildCompactStatusIndicator(c),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 12),
                
                // Details Grid
                _buildInfoGrid(c),
                
                const SizedBox(height: 24),
                const Text("POSITION / CATEGORY", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: subtitleColor, letterSpacing: 1.0)),
                const SizedBox(height: 12),
                _buildStatusTag(c['role']),
                
                const SizedBox(height: 24),
                if (c['linkedin'].isNotEmpty) ...[
                  _buildLinkedInButton(c['linkedin']),
                  const SizedBox(height: 24),
                ],

                _buildThemedActionGrid(c),
                
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    "Applied on: ${_formatDate(c['createdAt'])}",
                    style: const TextStyle(fontSize: 10, color: subtitleColor, fontStyle: FontStyle.italic),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoGrid(Map<String, dynamic> c) {
    return Column(
      children: [
        _buildInfoRow(Icons.school_rounded, "College", c['college']),
        const SizedBox(height: 12),
        _buildInfoRow(Icons.account_tree_rounded, "Department", c['department']),
        const SizedBox(height: 12),
        _buildInfoRow(Icons.phone_android_rounded, "Contact", c['contact']),
        const SizedBox(height: 12),
        _buildInfoRow(Icons.emergency_rounded, "Emergency", c['emergencyContact']),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, size: 14, color: primaryColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: subtitleColor, letterSpacing: 0.5)),
              Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: primaryColor)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLinkedInButton(String url) {
    return InkWell(
      onTap: () async {
        final uri = Uri.parse(url);
        if (await url_launcher.canLaunchUrl(uri)) {
          await url_launcher.launchUrl(uri);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF0077B5).withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF0077B5).withOpacity(0.2)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.link_rounded, size: 16, color: Color(0xFF0077B5)),
            SizedBox(width: 8),
            Text("LinkedIn Profile", style: TextStyle(color: Color(0xFF0077B5), fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return "N/A";
    try {
      final date = DateTime.parse(dateStr);
      return "${date.day}/${date.month}/${date.year}";
    } catch (e) {
      return dateStr;
    }
  }

  Widget _buildPipelineSteps(Map<String, dynamic> c) {
    return Row(
      children: List.generate(4, (index) {
        return Expanded(
          child: Container(
            height: 4,
            margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(color: index == 0 ? primaryColor : borderColor, borderRadius: BorderRadius.circular(2)),
          ),
        );
      }),
    );
  }

  Widget _buildCompactStatusIndicator(Map<String, dynamic> c) {
    final Color color = c['dotColor'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(c['status'].toUpperCase(), style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w600, color: color, letterSpacing: 0.5)),
    );
  }

  Widget _buildStatusTag(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: primaryColor)),
    );
  }

  Widget _buildInfoBadge(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: primaryColor),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 11, color: primaryColor, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildThemedActionGrid(Map<String, dynamic> c) {
    bool isPending = c['status'] == 'pending';
    return Column(
      children: [
        if (isPending)
          Row(
            children: [
              Expanded(child: _buildFinalActionBtn("Reject", Icons.close_rounded, Colors.red.shade400, () => _submitManagerReview(c, "rejected"))),
              const SizedBox(width: 12),
              Expanded(child: _buildFinalActionBtn("Approve", Icons.check_rounded, Colors.teal, () => _submitManagerReview(c, "approved"))),
            ],
          )
        else
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: _getStatusColor(c['status']).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: Text("Decision: ${c['status'].toUpperCase()}", textAlign: TextAlign.center, style: TextStyle(color: _getStatusColor(c['status']), fontWeight: FontWeight.bold, fontSize: 13)),
          )
      ],
    );
  }

  Future<void> _submitManagerReview(Map<String, dynamic> c, String status) async {
    final remarksController = TextEditingController();
    final bool isApprove = status == 'approved';
    final Color actionColor = isApprove ? Colors.teal : Colors.red.shade400;

    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(28), border: Border.all(color: borderColor)),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: actionColor.withOpacity(0.1), shape: BoxShape.circle),
                child: Icon(isApprove ? Icons.check_circle_rounded : Icons.cancel_rounded, color: actionColor, size: 32),
              ),
              const SizedBox(height: 20),
              Text(
                "Confirm ${status[0].toUpperCase()}${status.substring(1)}",
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: primaryColor, letterSpacing: -0.5),
              ),
              const SizedBox(height: 8),
              Text(
                "Are you sure you want to $status ${c['name']}'s application?",
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: subtitleColor, height: 1.5),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: remarksController,
                maxLines: 3,
                style: const TextStyle(fontSize: 14, color: primaryColor),
                decoration: InputDecoration(
                  hintText: "Add your remarks here...",
                  hintStyle: const TextStyle(color: subtitleColor, fontSize: 13),
                  filled: true,
                  fillColor: backgroundColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.all(16),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text("Cancel", style: TextStyle(color: subtitleColor, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: actionColor,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text("Submit ${isApprove ? 'Approval' : 'Rejection'}", style: const TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);
    try {
      final response = await http.put(
        Uri.parse("${getBaseUrl()}/api/intern/manager-review/${c['_id']}"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"status": status, "remarks": remarksController.text.trim()}),
      );

      if (response.statusCode == 200) {
        _fetchAssignedInterns();
      } else {
        setState(() => _isLoading = false);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Review submission failed")));
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e")));
    }
  }

  Widget _buildFinalActionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withOpacity(0.1))),
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
}
