import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/painting.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:http_parser/http_parser.dart';
import 'package:mime/mime.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ProfilePhotoService {
  static const _cacheKey = 'profile_photo_data_url';
  static final Map<String, ImageProvider> _imageProviderCache = {};

  static Future<String?> cachedPhotoUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_cacheKey);
  }

  static Future<void> cachePhotoFromUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    final url = _extractPhotoUrl(user);

    if (url == null || url.isEmpty) {
      await prefs.remove(_cacheKey);
      return;
    }

    await prefs.setString(_cacheKey, url);
  }

  static Future<String?> refreshPhotoUrl() async {
    final response = await http.get(Uri.parse('${getBaseUrl()}/api/auth/me'));
    if (response.statusCode != 200) return cachedPhotoUrl();

    final data = jsonDecode(response.body);
    final user = data['user'] as Map<String, dynamic>? ?? {};
    await cachePhotoFromUser(user);
    return _extractPhotoUrl(user);
  }

  static Future<String?> uploadProfilePhoto(String imagePath) async {
    final request = http.MultipartRequest(
      'PATCH',
      Uri.parse('${getBaseUrl()}/api/auth/me/profile-photo'),
    );
    final contentType = _contentTypeForPath(imagePath);
    request.files.add(
      await http.MultipartFile.fromPath(
        'profilePhoto',
        imagePath,
        contentType: contentType,
      ),
    );

    final streamed = await http.send(request);
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message =
          _messageFromBody(response.body) ?? 'Unable to update profile photo';
      throw Exception(message);
    }

    final data = jsonDecode(response.body);
    final user = data['user'] as Map<String, dynamic>? ?? {};
    final url = _extractPhotoUrl(user);

    final prefs = await SharedPreferences.getInstance();
    if (url != null && url.isNotEmpty) {
      await prefs.setString(_cacheKey, url);
    }
    return url;
  }

  static Future<void> removeProfilePhoto() async {
    final response = await http.delete(
      Uri.parse('${getBaseUrl()}/api/auth/me/profile-photo'),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message =
          _messageFromBody(response.body) ?? 'Unable to remove profile photo';
      throw Exception(message);
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey);
  }

  static ImageProvider? imageProvider(String? value) {
    if (value == null || value.isEmpty) return null;

    final cachedProvider = _imageProviderCache[value];
    if (cachedProvider != null) return cachedProvider;

    final bytes = _bytesFromDataUrl(value);
    final ImageProvider provider =
        bytes != null ? MemoryImage(bytes) : FileImage(File(value));

    if (_imageProviderCache.length > 4) {
      _imageProviderCache.remove(_imageProviderCache.keys.first);
    }
    _imageProviderCache[value] = provider;
    return provider;
  }

  static Uint8List? _bytesFromDataUrl(String value) {
    final commaIndex = value.indexOf(',');
    if (!value.startsWith('data:image/') || commaIndex == -1) return null;
    return base64Decode(value.substring(commaIndex + 1));
  }

  static String? _extractPhotoUrl(Map<String, dynamic> user) {
    final profilePhoto = user['profilePhoto'];
    if (user['profilePhotoUrl'] is String) {
      return user['profilePhotoUrl'] as String;
    }
    if (profilePhoto is Map && profilePhoto['url'] is String) {
      return profilePhoto['url'] as String;
    }
    return null;
  }

  static MediaType _contentTypeForPath(String imagePath) {
    final mimeType = lookupMimeType(imagePath) ?? 'image/jpeg';
    final parts = mimeType.split('/');
    if (parts.length != 2 || parts.first != 'image') {
      return MediaType('image', 'jpeg');
    }
    return MediaType(parts.first, parts.last);
  }

  static String? _messageFromBody(String body) {
    try {
      final data = jsonDecode(body);
      return data['message']?.toString();
    } catch (_) {
      return null;
    }
  }
}
