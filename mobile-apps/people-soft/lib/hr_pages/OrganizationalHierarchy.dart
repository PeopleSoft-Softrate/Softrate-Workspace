import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'dart:convert';
import 'package:hrmappfrontend/port.dart';
import 'package:flutter/services.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart'; // Add this import

class OrganizationalHierarchy extends StatefulWidget {
  const OrganizationalHierarchy({super.key});

  @override
  State<OrganizationalHierarchy> createState() => _OrganizationalHierarchyState();
}

class _OrganizationalHierarchyState extends State<OrganizationalHierarchy> {
  final TextEditingController _policyUrlController = TextEditingController();
  bool _isLoading = false;
  bool _isPageLoading = true;
  String? _hrEmail;

  @override
  void initState() {
    super.initState();
    _loadHrData();
  }

  Future<void> _loadHrData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final isLoggedIn = prefs.getBool('hr_logged_in') ?? false;
      _hrEmail = prefs.getString('hr_email');

      if (isLoggedIn && _hrEmail != null) {
        await _fetchPolicyUrl();
      }
    } finally {
      if (mounted) setState(() => _isPageLoading = false);
    }
  }

  Future<void> _fetchPolicyUrl() async {
    if (_hrEmail == null) return;

    final url = '${getBaseUrl()}/api/hr/policy?email=$_hrEmail';
    final response = await http.get(Uri.parse(url));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['success'] && data['policy_url'] != null) {
        _policyUrlController.text = data['policy_url'];
      }
    }
  }

  Future<void> _savePolicyUrl() async {
    if (_hrEmail == null || _policyUrlController.text.isEmpty) return;

    setState(() => _isLoading = true);
    final url = '${getBaseUrl()}/api/hr/policy/save';

    try {
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': _hrEmail,
          'policyUrl': _policyUrlController.text.trim(),
        }),
      );

      if (response.statusCode == 200 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Policy URL saved successfully'),
            backgroundColor: Color(0xFF00657F),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Open PDF using native PDF viewer (like InternHrpolicies)
  void _openPolicyUrl() {
    final rawUrl = _policyUrlController.text.trim();
    if (rawUrl.isEmpty) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => HrPolicyPdfViewer(pdfUrl: rawUrl),
      ),
    );
  }

  @override
  void dispose() {
    _policyUrlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isPageLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF5F1ED),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF00657F)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        title: const Text(
          'Organizational Hierarchy',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        toolbarHeight: 72,
      ),
      body: SafeArea(
        child: Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: Color(0xFFF5F1ED),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Organizational Hierarchy Management',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF003648),
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Manage and share the latest Organizational Hierarchy PDF with your team from a single place.',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade700,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                Container(
                  width: double.infinity,
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
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Organizational Hierarchy PDF',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF003648),
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Paste the public Google Drive PDF link to share with employees.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.black54,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Divider(
                        height: 1,
                        color: Colors.grey.shade200,
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _policyUrlController,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF003648),
                        ),
                        decoration: InputDecoration(
                          labelText: 'Organizational Hierarchy PDF URL',
                          labelStyle: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade700,
                          ),
                          hintText: 'https://drive.google.com/file/d/..../view',
                          hintStyle: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade500,
                          ),
                          prefixIcon: const Icon(
                            Icons.link_rounded,
                            color: Color(0xFF00657F),
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF7F9FB),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 14,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: Colors.grey.shade300,
                              width: 1,
                            ),
                          ),
                          focusedBorder: const OutlineInputBorder(
                            borderRadius: BorderRadius.all(Radius.circular(14)),
                            borderSide: BorderSide(
                              color: Color(0xFF00657F),
                              width: 1.6,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 18,
                      color: Color(0xFF00657F),
                    ),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Make sure the PDF link has "Anyone with the link can view" enabled in Google Drive.',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF4A4A4A),
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: _isLoading ? null : _savePolicyUrl,
                          icon: _isLoading
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.save_rounded, size: 20),
                          label: Text(
                            _isLoading ? 'Saving...' : 'Save URL',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
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
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: OutlinedButton.icon(
                          onPressed: _policyUrlController.text.isEmpty
                              ? null
                              : _openPolicyUrl,
                          icon: const Icon(
                            Icons.picture_as_pdf_rounded,
                            size: 20,
                          ),
                          label: const Text(
                            'View Hierarchy',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF00657F),
                            side: const BorderSide(
                              color: Color(0xFF00657F),
                              width: 1.3,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Native PDF Viewer (same logic as InternHrpolicies)
class HrPolicyPdfViewer extends StatefulWidget {
  final String pdfUrl;
  const HrPolicyPdfViewer({required this.pdfUrl, super.key});

  @override
  State<HrPolicyPdfViewer> createState() => _HrPolicyPdfViewerState();
}

class _HrPolicyPdfViewerState extends State<HrPolicyPdfViewer> {
  static final _channel = MethodChannel('secure_screen');

  bool _isLoading = true;
  String? _processedPdfUrl;

  @override
  void initState() {
    super.initState();
    _enableSecure();
    _processPdfUrl();
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

  Future<void> _processPdfUrl() async {
    try {
      String link = widget.pdfUrl.trim();

      // Handle Dropbox link: convert dl=0 -> dl=1
      if (link.contains('dropbox.com')) {
        link = link.replaceAll('dl=0', 'dl=1');
      }

      // Handle Google Drive link: convert to direct download
      if (link.contains('drive.google.com')) {
        final regExp = RegExp(r'/d/([a-zA-Z0-9_-]+)');
        final match = regExp.firstMatch(link);
        if (match != null) {
          final fileId = match.group(1);
          link = 'https://drive.google.com/uc?export=download&id=$fileId';
        }
      }

      _processedPdfUrl = link;
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
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF5F1ED),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF00657F)),
        ),
      );
    }

    if (_processedPdfUrl == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF5F1ED),
        body: Center(
          child: Text('No Organizational Hierarchy available.'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'HR Policy PDF',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF00657F),
      ),
      body: SfPdfViewer.network(
        _processedPdfUrl!,
        canShowScrollHead: true,
        canShowPaginationDialog: true,
      ),
    );
  }
}
