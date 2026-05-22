import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:hrmappfrontend/hr_pages/pdf/certificate_pdf_service.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:path_provider/path_provider.dart';

class InternResignation extends StatefulWidget {
  const InternResignation({super.key});

  @override
  State<InternResignation> createState() => _InternResignationState();
}

class _InternResignationState extends State<InternResignation> {
  late Future<List<ResignationRequest>> _resignations;
  String? _processingId;

  @override
  void initState() {
    super.initState();
    _resignations = fetchPendingResignations();
  }

  // ================= API CALLS =================

  Future<List<ResignationRequest>> fetchPendingResignations() async {
    final url = '${getBaseUrl()}/api/resignation/pending';
    final response = await http.get(Uri.parse(url));

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      final list = (decoded['data'] as List? ?? []);
      return list.map((e) => ResignationRequest.fromJson(e)).toList();
    }
    throw Exception('Failed to fetch resignations');
  }

  Future<void> rejectResignation(String id) async {
  setState(() => _processingId = id); // start loading

  try {
    final url = '${getBaseUrl()}/api/resignation/reject/$id';
    final res = await http.put(Uri.parse(url));

    if (res.statusCode == 200) {
      setState(() {
        _resignations = fetchPendingResignations();
      });
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to reject: ${res.body}')),
        );
      }
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  } finally {
    setState(() => _processingId = null); // stop loading
  }
}


  Future<InternDetails> fetchInternDetails(String internId) async {
  final url = Uri.parse('${getBaseUrl()}/api/intern/get/$internId');
  final response = await http.get(url);

  if (response.statusCode == 200) {
    final decoded = jsonDecode(response.body);
    final internJson = decoded['intern']; // <-- backend returns 'intern'
    if (internJson == null) {
      throw Exception('Intern details not found');
    }
    return InternDetails.fromJson(internJson);
  } else {
    throw Exception('Failed to fetch intern details');
  }
}


  Future<void> acceptWithCertificates({
    required ResignationRequest req,
    required String title,
    required bool internship,
    required bool project,
    required bool lor,
  }) async {
    final uri = Uri.parse('${getBaseUrl()}/api/resignation/hr-review/accept/${req.id}');
    
    // Instead of generating PDFs in Flutter, we pass the flags to the backend
    final response = await http.put(
      uri,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "title": title,
        "internship": internship,
        "project": project,
        "lor": lor,
        "remarks": "Offboarding approved" // Add default remarks or let HR enter them later
      }),
    );

    if (response.statusCode == 200) {
      setState(() {
        _resignations = fetchPendingResignations();
      });
    } else {
      throw Exception('Accept failed: ${response.body}');
    }
  }

  // ================= UI =================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Off Board",style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
      ),
      body: FutureBuilder<List<ResignationRequest>>(
        future: _resignations,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return const Center(child: Text("No pending resignations"));
          }

          final list = snapshot.data!;
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            itemBuilder: (context, index) {
              final req = list[index];

              return Card(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 2,
                margin: const EdgeInsets.symmetric(vertical: 8),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: const Color(0xFF00657F)
                                .withOpacity(0.08),
                            child: Text(
                              req.internName.isNotEmpty
                                  ? req.internName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: Color(0xFF00657F),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  req.internName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  "ID: ${req.internId} • ${req.department}",
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Icon(Icons.calendar_today_outlined,
                              size: 14, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text(
                            "Last working day: ${req.lastWorkingDay}",
                            style: TextStyle(
                              color: Colors.grey[700],
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        req.exitReason,
                        style: const TextStyle(fontSize: 13),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton.icon(
                            onPressed: _processingId == req.id ? null : () => rejectResignation(req.id),
                            icon: _processingId == req.id
                                ? SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Icon(Icons.close, size: 18, color: Colors.red),
                            label: Text(
                              "Reject",
                              style: TextStyle(
                                color: _processingId == req.id ? Colors.grey : Colors.red,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF00657F),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            onPressed: () => _showAcceptDialog(req),
                            icon:
                                const Icon(Icons.check, size: 18, color: Colors.white,),
                            label: const Text("Accept",style: TextStyle(color: Colors.white),),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  // ================= ACCEPT DIALOG =================

  void _showAcceptDialog(ResignationRequest req) {
    String title = "Mr";
    bool internship = false;
    bool project = false;
    bool lor = false;
    bool isSubmitting = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          
          builder: (context, setStateDialog) {
            Future<void> handleConfirm() async {
              setStateDialog(() => isSubmitting = true);
              try {
                await acceptWithCertificates(
                  req: req,
                  title: title,
                  internship: internship,
                  project: project,
                  lor: lor,
                );
                if (context.mounted) Navigator.pop(context);
              } catch (e) {
                setStateDialog(() => isSubmitting = false);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e')),
                  );
                }
              }
            }

            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              title: const Text(
                "Accept resignation",
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              content: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      req.internName,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "ID: ${req.internId}",
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      "Title",
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: RadioListTile<String>(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            value: "Mr",
                            groupValue: title,
                            title: const Text("Mr"),
                            onChanged: (v) =>
                                setStateDialog(() => title = v!),
                          ),
                        ),
                        Expanded(
                          child: RadioListTile<String>(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            value: "Ms",
                            groupValue: title,
                            title: const Text("Ms"),
                            onChanged: (v) =>
                                setStateDialog(() => title = v!),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      "Certificates",
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: const Text("Internship completion"),
                      value: internship,
                      onChanged: (v) =>
                          setStateDialog(() => internship = v ?? false),
                    ),
                    CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: const Text("Project completion"),
                      value: project,
                      onChanged: (v) =>
                          setStateDialog(() => project = v ?? false),
                    ),
                    CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: const Text("Letter of recommendation"),
                      value: lor,
                      onChanged: (v) =>
                          setStateDialog(() => lor = v ?? false),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed:
                      isSubmitting ? null : () => Navigator.pop(context),
                  child: const Text("Cancel",style: TextStyle(color: Color(0xFF00657F)))
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00657F),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  onPressed: isSubmitting ? null : handleConfirm,
                  child: isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text("Confirm & send",style: TextStyle(color: Colors.white),),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

// ================= MODEL =================

class ResignationRequest {
  final String id;
  final String internName;
  final String internId;
  final String department;
  final String lastWorkingDay;
  final String exitReason;
  final String status;
  final String assetReturnStatus;

  ResignationRequest({
    required this.id,
    required this.internName,
    required this.internId,
    required this.department,
    required this.lastWorkingDay,
    required this.exitReason,
    required this.status,
    required this.assetReturnStatus,
  });

  factory ResignationRequest.fromJson(Map<String, dynamic> json) {
    return ResignationRequest(
      id: json['_id'] ?? '',
      internName: json['internName'] ?? '',
      internId: json['internId'] ?? '',
      department: json['department'] ?? '',
      lastWorkingDay: json['lastWorkingDay'] ?? '',
      exitReason: json['exitReason'] ?? '',
      status: json['status'] ?? '',
      assetReturnStatus: json['assetReturnStatus'] ?? '',
    );
  }
}

class InternDetails {
  final String internId;
  final String fullName;
  final String email;
  final String college;
  final String department;
  final String role;
  final String joiningDate;
  final String lastWorkingDay;

  InternDetails({
    required this.internId,
    required this.fullName,
    required this.email,
    required this.college,
    required this.department,
    required this.role,
    required this.joiningDate,
    required this.lastWorkingDay,
  });

  factory InternDetails.fromJson(Map<String, dynamic> json) {
    return InternDetails(
      internId: json['internid'] ?? '',
      fullName: json['fullName'] ?? '',
      email: json['email'] ?? '',
      college: json['college'] ?? '',
      department: json['department'] ?? '',
      role: json['role'] ?? '',
      joiningDate: json['onboardingDate'] ?? '',
      lastWorkingDay: json['endDate'] ?? '',
    );
  }
}

