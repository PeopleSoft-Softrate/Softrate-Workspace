import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

class EmployeePolicyPage extends StatefulWidget {
  const EmployeePolicyPage({super.key});

  @override
  State<EmployeePolicyPage> createState() => _EmployeePolicyPageState();
}

class _EmployeePolicyPageState extends State<EmployeePolicyPage> {
  List<Map<String, dynamic>> _policies = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadEmployeePolicies();
  }

  Future<void> _loadEmployeePolicies() async {
    setState(() => _loading = true);
    try {
      final res = await http.get(Uri.parse("${getBaseUrl()}/api/policy/all"));
      final List data = jsonDecode(res.body);

      // Filter policies where "employee" is allowed
      _policies = data
          .where((p) => (p["policy_view_by"] as List).contains("employee"))
          .toList()
          .cast<Map<String, dynamic>>();

    } catch (e) {
      debugPrint("Error loading employee policies: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Failed to load policies"),
            backgroundColor: Color(0xFF00657F),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _processPdfUrl(String url) {
    String processedUrl = url.trim();
    
    // Handle Dropbox
    if (processedUrl.contains('dropbox.com')) {
      processedUrl = processedUrl.replaceAll('dl=0', 'dl=1');
    }
    
    // Handle Google Drive
    if (processedUrl.contains('drive.google.com')) {
      final match = RegExp(r'/d/([a-zA-Z0-9_-]+)').firstMatch(processedUrl);
      if (match != null) {
        final fileId = match.group(1);
        processedUrl = 'https://drive.google.com/uc?export=download&id=$fileId';
      }
    }
    
    return processedUrl;
  }

  void _viewPolicy(String url) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PolicyPdfViewer(pdfUrl: url),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        title: const Text(
          "Employee Policies",
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        toolbarHeight: 72,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _loadEmployeePolicies,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF00657F)),
            )
          : RefreshIndicator(
              onRefresh: _loadEmployeePolicies,
              color: const Color(0xFF00657F),
              child: _policies.isEmpty
                  ? _emptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                      itemCount: _policies.length,
                      itemBuilder: (context, index) {
                        final policy = _policies[index];
                        return _policyCard(policy);
                      },
                    ),
            ),
    );
  }

  Widget _emptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF00657F).withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.people_outline,
                size: 48,
                color: Color(0xFF00657F),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              "No Policies Available",
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Color(0xFF003648),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              "No employee policies have been assigned yet.\nContact your HR department.",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade600,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              onPressed: _loadEmployeePolicies,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text(
                "Refresh",
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF00657F),
                side: const BorderSide(color: Color(0xFF00657F)),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _policyCard(Map<String, dynamic> policy) {
    return InkWell(
      onTap: () => _viewPolicy(policy["policy_url"]),
      borderRadius: BorderRadius.circular(20),
      child: Container(
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFF00657F),
                        const Color(0xFF00657F).withOpacity(0.8),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.picture_as_pdf_rounded,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        policy["policy_name"] ?? "Unnamed Policy",
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF003648),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00657F).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.people,
                              size: 14,
                              color: const Color(0xFF00657F),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              "Employee Access",
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF00657F),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.grey,
                  size: 24,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// =======================
/// PROFESSIONAL PDF VIEWER
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

  Future<void> _processUrl() async {
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
          'Policy Document',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () => _processUrl(),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF00657F))
            )
          : _error || _processedUrl == null || _processedUrl!.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(40),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.picture_as_pdf_outlined,
                          size: 64,
                          color: Colors.grey.shade400,
                        ),
                        const SizedBox(height: 24),
                        const Text(
                          "Document Not Available",
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF003648),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Unable to load the policy document.\nPlease try again or contact support.",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: () => _processUrl(),
                          icon: const Icon(Icons.refresh),
                          label: const Text("Retry"),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF00657F),
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : SfPdfViewer.network(
                  _processedUrl!,
                  canShowScrollHead: true,
                  canShowPaginationDialog: true,
                  onDocumentLoadFailed: (details) {
                    setState(() => _error = true);
                  },
                ),
    );
  }
}
