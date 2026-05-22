import 'dart:convert';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';

class TodayAttendanceService {
  static Future<List<dynamic>> fetchTodayAttendance() async {
    try {
      final url = Uri.parse("${getBaseUrl()}/api/attendance/today/all");

      final response = await http
          .get(url)
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        if (data is Map && data.containsKey('attendance')) {
          return data['attendance'] ?? [];
        } else {
          return [];
        }
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  }
}

