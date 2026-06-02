import 'dart:convert';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:dio/dio.dart';





class InternService {
  static final String baseUrls = getBaseUrl();
  static String get baseUrl => "$baseUrls/api/intern";

  static Future<List<dynamic>> fetchInitialInterns() async {
    final url = Uri.parse("$baseUrl/all/initial");
    final res = await http.get(url);

    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    } else {
      return [];
    }
  }

static Future<bool> approveIntern(
  String internId,
  DateTime onboardingDate,
  DateTime endDate,
  List<int> pdfBytes,
  List<int> pdfBytes1,
  String name,
) async {
  // String baseUrl = getBaseUrl();
  Dio dio = Dio();

  final formData = FormData.fromMap({
    "internId": internId,
    "onboardingDate": onboardingDate.toIso8601String(),
    "endDate": endDate.toIso8601String(),
    "pdf": MultipartFile.fromBytes(pdfBytes, filename: "$name-Offer.pdf"),
    "pdf_1": MultipartFile.fromBytes(pdfBytes1, filename: "$name-Offer_1.pdf"),
  });
  
  final res = await dio.put(
    "$baseUrl/accept/$internId",
    data: formData,
  );

  return res.statusCode == 200;
}

  static Future<bool> rejectIntern(String id) async {
  final res = await http.delete(
    Uri.parse("$baseUrl/reject/$id"),
  );

  return res.statusCode == 200;
}

}
