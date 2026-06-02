import 'dart:convert';
import 'package:http/http.dart' as http_base;
export 'package:http/http.dart' show MultipartRequest, MultipartFile, Response, StreamedResponse, ByteStream;
import 'package:shared_preferences/shared_preferences.dart';

class AuthClient extends http_base.BaseClient {
  final http_base.Client _inner = http_base.Client();

  @override
  Future<http_base.StreamedResponse> send(http_base.BaseRequest request) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    
    // Fallback for HR token if we didn't differentiate
    final hrToken = prefs.getString('hr_auth_token');
    if (token == null && hrToken != null) {
      request.headers['Authorization'] = 'Bearer $hrToken';
    }
    
    return _inner.send(request);
  }
}

final _client = AuthClient();

Future<http_base.Response> get(Uri url, {Map<String, String>? headers}) => _client.get(url, headers: headers);
Future<http_base.Response> post(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.post(url, headers: headers, body: body, encoding: encoding);
Future<http_base.Response> put(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.put(url, headers: headers, body: body, encoding: encoding);
Future<http_base.Response> delete(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.delete(url, headers: headers, body: body, encoding: encoding);
Future<http_base.Response> patch(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) => _client.patch(url, headers: headers, body: body, encoding: encoding);
Future<http_base.StreamedResponse> send(http_base.BaseRequest request) => _client.send(request);
