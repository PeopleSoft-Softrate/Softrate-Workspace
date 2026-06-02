import 'dart:io';
import 'dart:math';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DeviceInfoHelper {
  static const String _deviceIdKey = "app_unique_device_id_v2";

  static Future<String> getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Check if we already generated a unique ID
    String? existingId = prefs.getString(_deviceIdKey);
    if (existingId != null && existingId.isNotEmpty) {
      return existingId;
    }

    final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    String uniqueId = "unknown_device";
    
    try {
      if (Platform.isAndroid) {
        AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
        String model = androidInfo.model.replaceAll(' ', '_');
        String brand = androidInfo.brand.replaceAll(' ', '_');
        uniqueId = "android_${model}_$brand";
      } else if (Platform.isIOS) {
        IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
        String model = iosInfo.utsname.machine.replaceAll(' ', '_');
        uniqueId = "ios_${model}_apple";
      }
    } catch (e) {
      print("Failed to get device info: $e");
    }

    uniqueId = uniqueId.toLowerCase();
    
    // Save it
    await prefs.setString(_deviceIdKey, uniqueId);
    
    return uniqueId;
  }
}
