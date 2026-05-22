import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class ApiService {
  static String get baseUrl {
    if (Platform.isAndroid) {
      // return 'http://10.139.243.125:4000/api';
      return 'https://softrate-call.onrender.com/api';
    }
    return 'https://softrate-call.onrender.com/api';
    // return 'http://10.139.243.125:4000/api';
  }

  // ── Verify Company Code ───────────────────────────────────
  static Future<Map<String, dynamic>> verifyCompanyCode(String companyCode) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/auth/company/$companyCode'),
        headers: {'Content-Type': 'application/json'},
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body);
      } else {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['message'] ?? 'Company code not found.'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Verification failed: $e'};
    }
  }

  // ── Employee Login ────────────────────────────────────────
  static Future<Map<String, dynamic>> loginEmployee(
      String companyCode, String mobile) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/employees/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'companyCode': companyCode, 'mobile': mobile}),
      );
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body);
      } else {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['message'] ?? 'Server error: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to connect to server: $e'};
    }
  }

  // ── Update employee code (optional, set by employee after login) ──
  static Future<Map<String, dynamic>> updateEmployeeCode({
    required String employeeId,
    required String employeeCode,
  }) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/employees/$employeeId/code'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'employeeCode': employeeCode}),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body);
      } else {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['message'] ?? 'Update failed: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to update code: $e'};
    }
  }

  // ── Sync today's call log to backend ─────────────────────
  static Future<Map<String, dynamic>> syncCallLogs({
    required String companyCode,
    required String phone,
    required String date,
    required int incoming,
    required int outgoing,
    required int missed,
    required int rejected,
    required int incomingDuration,
    required int outgoingDuration,
    required int totalDuration,
    required List<Map<String, dynamic>> calls,
    String deviceModel = '',
    String appVersion = '1.0.0',
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/calllogs/sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'companyCode': companyCode,
          'phone': phone,
          'date': date,
          'incoming': incoming,
          'outgoing': outgoing,
          'missed': missed,
          'rejected': rejected,
          'incomingDuration': incomingDuration,
          'outgoingDuration': outgoingDuration,
          'totalDuration': totalDuration,
          'calls': calls,
          'deviceModel': deviceModel,
          'appVersion': appVersion,
        }),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body);
      } else {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['message'] ?? 'Sync failed: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Sync failed: $e'};
    }
  }

  // ── Bookmarks / Follow-Ups ─────────────────────────────────
  static Future<Map<String, dynamic>> addBookmark({
    required String companyCode,
    required String employeePhone,
    required String contactNumber,
    String contactName = '',
    String description = '',
    int callTimestamp = 0,
    String? reminderDate,
    bool brochuresSent = false,
    bool techMeet = false,
    bool meetingRemarks = false,
    bool quotationSent = false,
    bool proposalSent = false,
    bool whatsappGrp = false,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/bookmarks'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'companyCode': companyCode,
          'employeePhone': employeePhone,
          'contactNumber': contactNumber,
          'contactName': contactName,
          'description': description,
          'callTimestamp': callTimestamp,
          'reminderDate': reminderDate,
          'brochuresSent': brochuresSent,
          'techMeet': techMeet,
          'meetingRemarks': meetingRemarks,
          'quotationSent': quotationSent,
          'proposalSent': proposalSent,
          'whatsappGrp': whatsappGrp,
        }),
      );
      
      try {
        final body = jsonDecode(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return body;
        } else {
          return {'success': false, 'message': body['message'] ?? 'Failed: ${response.statusCode}'};
        }
      } catch (e) {
         return {'success': false, 'message': 'Server returned an invalid response (Status ${response.statusCode}).'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to add follow-up. Network error.'};
    }
  }

  static Future<Map<String, dynamic>> getBookmarks({
    required String companyCode,
    required String phone,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/bookmarks?companyCode=$companyCode&phone=$phone');
      final response = await http.get(uri, headers: {'Content-Type': 'application/json'});
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body);
      } else {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['message'] ?? 'Fetch failed: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to fetch follow-ups: $e'};
    }
  }

  static Future<Map<String, dynamic>> deleteBookmark(String id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/bookmarks/$id'),
        headers: {'Content-Type': 'application/json'},
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body);
      } else {
        final body = jsonDecode(response.body);
        return {'success': false, 'message': body['message'] ?? 'Delete failed: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to delete follow-up: $e'};
    }
  }

  static Future<Map<String, dynamic>> updateBookmark({
    required String id,
    String? description,
    String? newRemark,
    List<String>? remarks,
    String? reminderDate,
    bool? brochuresSent,
    bool? techMeet,
    bool? meetingRemarks,
    bool? quotationSent,
    bool? proposalSent,
    bool? whatsappGrp,
  }) async {
    try {
      final Map<String, dynamic> body = {
        if (description != null) 'description': description,
        if (newRemark != null) 'newRemark': newRemark,
        if (remarks != null) 'remarks': remarks,
        if (reminderDate != null) 'reminderDate': reminderDate,
        if (brochuresSent != null) 'brochuresSent': brochuresSent,
        if (techMeet != null) 'techMeet': techMeet,
        if (meetingRemarks != null) 'meetingRemarks': meetingRemarks,
        if (quotationSent != null) 'quotationSent': quotationSent,
        if (proposalSent != null) 'proposalSent': proposalSent,
        if (whatsappGrp != null) 'whatsappGrp': whatsappGrp,
      };

      final response = await http.patch(
        Uri.parse('$baseUrl/bookmarks/$id'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return jsonDecode(response.body);
      } else {
        final bodyRes = jsonDecode(response.body);
        return {'success': false, 'message': bodyRes['message'] ?? 'Update failed: ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to update follow-up: $e'};
    }
  }

  // ── Leads ─────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getLeads({
    required String companyCode,
    required String phone,
    String? setLabel,
  }) async {
    try {
      final queryParams = {'companyCode': companyCode, 'phone': phone};
      if (setLabel != null && setLabel.isNotEmpty) {
        queryParams['setLabel'] = setLabel;
      }
      final uri = Uri.https(
        'softrate-call.onrender.com', 
        '/api/leads/employee',
        queryParams,
      );
      final response = await http.get(uri, headers: {'Content-Type': 'application/json'});
      
      try {
        final body = jsonDecode(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return body;
        } else {
          return {'success': false, 'message': body['message'] ?? 'Fetch failed: ${response.statusCode}'};
        }
      } catch (e) {
        return {'success': false, 'message': 'Server returned an invalid response (Status ${response.statusCode}). Please ensure the backend is running.'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to fetch leads: $e'};
    }
  }

  static Future<Map<String, dynamic>> updateLeadStatus(String leadId, String status) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/leads/$leadId/status'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': status}),
      );
      
      try {
        final body = jsonDecode(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return body;
        } else {
          return {'success': false, 'message': body['message'] ?? 'Update failed: ${response.statusCode}'};
        }
      } catch (e) {
        return {'success': false, 'message': 'Server returned an invalid response (Status ${response.statusCode}).'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed to update lead status: $e'};
    }
  }
}
