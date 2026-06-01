import 'dart:io';
import 'dart:math';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DeviceInfoHelper {
  static const String _deviceIdKey = "app_unique_device_id";

  static Future<String> getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    
    // 1. Check if we already generated a unique ID for this installation
    String? existingId = prefs.getString(_deviceIdKey);
    if (existingId != null && existingId.isNotEmpty) {
      return existingId;
    }

    // 2. If not, generate a new one
    final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    String prefix = "unknown";
    
    try {
      if (Platform.isAndroid) {
        AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
        // androidInfo.id is just the OS Build string, so we use it as a prefix
        prefix = "android_${androidInfo.model.replaceAll(' ', '_')}";
      } else if (Platform.isIOS) {
        IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
        // identifierForVendor is usually unique on iOS
        prefix = "ios_${iosInfo.identifierForVendor ?? 'unknown'}";
      }
    } catch (e) {
      print("Failed to get device info: $e");
    }

    // Generate a random 16-character string to ensure uniqueness across identical phones
    final random = Random();
    const chars = 'abcdef0123456789';
    final randomSuffix = String.fromCharCodes(
      Iterable.generate(16, (_) => chars.codeUnitAt(random.nextInt(chars.length)))
    );

    final uniqueId = "${prefix}_$randomSuffix".toLowerCase();
    
    // Save it so it never changes for this app installation
    await prefs.setString(_deviceIdKey, uniqueId);
    
    return uniqueId;
  }
}
