import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'dart:convert';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:hrmappfrontend/port.dart'; // contains getBaseUrl()

class intern_Organizational_Hierarchy extends StatefulWidget {
  const intern_Organizational_Hierarchy({super.key});

  @override
  State<intern_Organizational_Hierarchy> createState() =>
      _intern_Organizational_HierarchyState();
}

class _intern_Organizational_HierarchyState
    extends State<intern_Organizational_Hierarchy> {
  static final _channel = MethodChannel('secure_screen');

  bool _isLoading = true;
  String? _pdfUrl;

  @override
  void initState() {
    super.initState();
    _enableSecure();
    _fetchPolicyUrl();
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

  Future<void> _fetchPolicyUrl() async {
    try {
      final url = '${getBaseUrl()}/api/hr/policy-only'; // backend endpoint
      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] && data['policy_url'] != null) {
          String link = data['policy_url'].toString().trim();

          // Handle Dropbox link: convert dl=0 -> dl=1
          if (link.contains('dropbox.com')) {
            link = link.replaceAll('dl=0', 'dl=1');
          }

          if (link.contains('drive.google.com')) {
            final regExp = RegExp(r'/d/([a-zA-Z0-9_-]+)');
            final match = regExp.firstMatch(link);
            if (match != null) {
              final fileId = match.group(1);
              link = 'https://drive.google.com/uc?export=download&id=$fileId';
            }
          }

          _pdfUrl = link;
        }
      }
    } catch (e) {
      debugPrint('Error fetching policy URL: $e');
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

    if (_pdfUrl == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF5F1ED),
        body: Center(child: Text('No Organizational Hierarchy available.')),
      );
    }

    return Scaffold(
      appBar: AppBar(
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
      ),
      body: SfPdfViewer.network(
        _pdfUrl!,
        canShowScrollHead: true,
        canShowPaginationDialog: true,
      ),
    );
  }
}
