import 'dart:convert';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';

class TodayEmployeeAttendanceService {
  static Future<List<dynamic>> fetchTodayAttendance() async {
    try {
      final url = Uri.parse(
        "${getBaseUrl()}/api/employeeAttanance/employee/today/all",
      );

      final response = await http
          .get(url)
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        if (data is Map && data.containsKey('attendance')) {
          final List<dynamic> list = data['attendance'] ?? [];
          return list.where((a) => a['status']?.toString().toLowerCase() != 'initial').toList();
        }
        return [];
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  }
}
