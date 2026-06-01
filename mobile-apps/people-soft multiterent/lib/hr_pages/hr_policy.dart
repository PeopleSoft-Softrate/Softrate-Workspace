import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

/// =======================
/// MODEL
/// =======================
class PolicyInput {
  String? id;
  final TextEditingController nameController;
  final TextEditingController urlController;
  bool employee;
  bool intern;

  PolicyInput({
    this.id,
    String name = '',
    String url = '',
    this.employee = false,
    this.intern = false,
  })  : nameController = TextEditingController(text: name),
        urlController = TextEditingController(text: url);

  bool get isCompletelyEmpty =>
      id == null &&
      nameController.text.trim().isEmpty &&
      urlController.text.trim().isEmpty &&
      !employee &&
      !intern;
}

/// =======================
/// ADMIN PAGE
/// =======================
class HrPolicy extends StatefulWidget {
  const HrPolicy({super.key});

  @override
  State<HrPolicy> createState() => _HrPolicyState();
}

class _HrPolicyState extends State<HrPolicy> {
  final List<PolicyInput> _policies = [];
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadPolicies();
  }

  Future<void> _loadPolicies() async {
    try {
      final res = await http.get(Uri.parse("${getBaseUrl()}/api/policy/all"));
      final List data = jsonDecode(res.body);

      _policies.clear();

      for (final p in data) {
        _policies.add(
          PolicyInput(
            id: p["_id"],
            name: p["policy_name"],
            url: p["policy_url"],
            employee: p["policy_view_by"].contains("employee"),
            intern: p["policy_view_by"].contains("intern"),
          ),
        );
      }

      _addEmptyRow();
    } catch (_) {
      _showSnack("Failed to load policies");
    }

    if (mounted) setState(() => _loading = false);
  }

  void _addEmptyRow() {
    if (_policies.any((p) => p.isCompletelyEmpty)) return;
    _policies.add(PolicyInput());
  }

  Future<void> _savePolicies() async {
    if (_saving) return;

    final List<Map<String, dynamic>> create = [];
    final List<Map<String, dynamic>> update = [];

    for (final p in _policies) {
      if (p.isCompletelyEmpty) continue;

      if (p.nameController.text.trim().isEmpty ||
          p.urlController.text.trim().isEmpty) {
        _showSnack("Policy name & URL required");
        return;
      }

      final roles = <String>[];
      if (p.employee) roles.add("employee");
      if (p.intern) roles.add("intern");

      if (roles.isEmpty) {
        _showSnack("Select who can view the policy");
        return;
      }

      final body = {
        "policy_name": p.nameController.text.trim(),
        "policy_url": p.urlController.text.trim(),
        "policy_view_by": roles,
      };

      p.id == null
          ? create.add(body)
          : update.add({"_id": p.id, ...body});
    }

    if (mounted) setState(() => _saving = true);

    try {
      if (create.isNotEmpty) {
        await http.post(
          Uri.parse("${getBaseUrl()}/api/policy/bulk-add"),
          headers: {"Content-Type": "application/json"},
          body: jsonEncode({"policies": create}),
        );
      }

      if (update.isNotEmpty) {
        await http.put(
          Uri.parse("${getBaseUrl()}/api/policy/bulk-update"),
          headers: {"Content-Type": "application/json"},
          body: jsonEncode({"policies": update}),
        );
      }

      _showSnack("Policies saved successfully");
      _loadPolicies();
    } catch (_) {
      _showSnack("Save failed");
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _deletePolicy(String id, int index) async {
    try {
      await http.delete(Uri.parse("${getBaseUrl()}/api/policy/$id"));
      if (mounted) {
        setState(() {
          _policies.removeAt(index);
          _addEmptyRow();
        });
      }
    } catch (_) {
      _showSnack("Delete failed");
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: const Color(0xFF00657F),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _viewPolicy(String policyUrl) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PolicyPdfViewer(pdfUrl: policyUrl),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        title: const Text(
          "HR Policies",
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF00657F),
        elevation: 0,
        centerTitle: false,
        toolbarHeight: 72,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00657F)))
          : RefreshIndicator(
              onRefresh: _loadPolicies,
              color: const Color(0xFF00657F),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                itemCount: _policies.length + 1,
                itemBuilder: (context, index) {
                  if (index == _policies.length) {
                    return _saveButton();
                  }

                  final p = _policies[index];
                  final isEmptyRow = p.isCompletelyEmpty;

                  return _policyCard(p, isEmptyRow, index);
                },
              ),
            ),
    );
  }

  Widget _policyCard(PolicyInput p, bool isEmptyRow, int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF00657F).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.description_rounded,
                  color: Color(0xFF00657F),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.nameController.text.isEmpty ? "New Policy" : p.nameController.text.trim(),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF003648),
                      ),
                    ),
                    Text(
                      isEmptyRow ? "Fill details to create policy" : "Policy details",
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Name Field
          TextField(
            controller: p.nameController,
            decoration: InputDecoration(
              labelText: "Policy Name",
              labelStyle: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade700,
              ),
              hintText: "Enter policy name",
              prefixIcon: const Icon(Icons.description, color: Color(0xFF00657F)),
              filled: true,
              fillColor: const Color(0xFFF7F9FB),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.grey.shade300, width: 1),
              ),
              focusedBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(14)),
                borderSide: BorderSide(color: Color(0xFF00657F), width: 1.6),
              ),
            ),
            onChanged: (_) {
              if (mounted) setState(() => _addEmptyRow());
            },
          ),
          const SizedBox(height: 16),

          // URL Field
          TextField(
            controller: p.urlController,
            decoration: InputDecoration(
              labelText: "Policy URL",
              labelStyle: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade700,
              ),
              hintText: "https://drive.google.com/...",
              prefixIcon: const Icon(Icons.link_rounded, color: Color(0xFF00657F)),
              filled: true,
              fillColor: const Color(0xFFF7F9FB),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.grey.shade300, width: 1),
              ),
              focusedBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(14)),
                borderSide: BorderSide(color: Color(0xFF00657F), width: 1.6),
              ),
            ),
            onChanged: (_) {
              if (mounted) setState(() => _addEmptyRow());
            },
          ),
          const SizedBox(height: 20),

          // Role Selection - FIXED: Both now clickable
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    if (mounted) setState(() => p.employee = !p.employee);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: p.employee ? const Color(0xFF00657F).withOpacity(0.08) : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: p.employee ? const Color(0xFF00657F) : Colors.grey.shade200,
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: p.employee ? const Color(0xFF00657F) : Colors.grey.shade300,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            p.employee ? Icons.check : Icons.people_outline,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Employee",
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: p.employee ? const Color(0xFF003648) : Colors.grey.shade700,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              "Company staff",
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    if (mounted) setState(() => p.intern = !p.intern);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: p.intern ? const Color(0xFF00657F).withOpacity(0.08) : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: p.intern ? const Color(0xFF00657F) : Colors.grey.shade200,
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: p.intern ? const Color(0xFF00657F) : Colors.grey.shade300,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            p.intern ? Icons.check : Icons.school_outlined,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Intern",
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: p.intern ? const Color(0xFF003648) : Colors.grey.shade700,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              "Trainees",
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Action Buttons - FIXED: Delete button restored
          Row(
            children: [
              if (!isEmptyRow && p.urlController.text.trim().isNotEmpty)
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _viewPolicy(p.urlController.text.trim()),
                    icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
                    label: const Text(
                      "View Policy",
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00657F),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
                SizedBox(width: 10),
              if (p.id != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _deletePolicy(p.id!, index),
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text(
                      "Delete",
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red.shade600,
                      side: BorderSide(color: Colors.red.shade200, width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              if (isEmptyRow)
                const Spacer(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _saveButton() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 40),
      child: SizedBox(
        width: double.infinity,
        height: 56,
        child: ElevatedButton(
          onPressed: _saving ? null : _savePolicies,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF00657F),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
          ),
          child: _saving
              ? const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    ),
                    SizedBox(width: 12),
                    Text(
                      "Saving...",
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                )
              : const Text(
                  "Save All Changes",
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
      ),
    );
  }
}

/// =======================
/// PDF VIEWER (SAFE)
/// =======================
class PolicyPdfViewer extends StatefulWidget {
  final String pdfUrl;
  const PolicyPdfViewer({super.key, required this.pdfUrl});

  @override
  State<PolicyPdfViewer> createState() => _PolicyPdfViewerState();
}

class _PolicyPdfViewerState extends State<PolicyPdfViewer> {
  static const _channel = MethodChannel('secure_screen');
  bool _isLoading = true;
  String? _processedUrl;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _enableSecure();
    _processUrl();
  }

  Future<void> _enableSecure() async {
    try {
      await _channel.invokeMethod('enableSecure');
    } catch (e) {
      debugPrint('Error enabling secure mode: $e');
    }
  }

  Future<void> _disableSecure() async {
    try {
      await _channel.invokeMethod('disableSecure');
    } catch (e) {
      debugPrint('Error disabling secure mode: $e');
    }
  }

  void _processUrl() async {
    try {
      String link = widget.pdfUrl.trim();

      if (link.contains('dropbox.com')) {
        link = link.replaceAll('dl=0', 'dl=1');
      }

      if (link.contains('drive.google.com')) {
        final match = RegExp(r'/d/([a-zA-Z0-9_-]+)').firstMatch(link);
        if (match != null) {
          final fileId = match.group(1);
          link = 'https://drive.google.com/uc?export=download&id=$fileId';
        }
      }

      _processedUrl = link;
    } catch (e) {
      debugPrint('Error processing PDF URL: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _disableSecure();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        title: const Text(
          'Policy PDF',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF00657F),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00657F)))
          : _error || _processedUrl == null || _processedUrl!.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'No PDF available at this link',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, color: Color(0xFF003648)),
                    ),
                  ),
                )
              : SfPdfViewer.network(
                  _processedUrl!,
                  canShowScrollHead: true,
                  canShowPaginationDialog: true,
                  onDocumentLoadFailed: (details) {
                    if (mounted) setState(() => _error = true);
                  },
                ),
    );
  }
}
