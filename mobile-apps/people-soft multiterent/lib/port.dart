import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

const bool useLocalBackend = true;
const bool isEmulator = false;

String getBaseUrl() {
  if (useLocalBackend) {
    if (kIsWeb) {
      return 'http://localhost:5001';
    }
    if (Platform.isAndroid) {
      if (isEmulator) {
        return 'http://192.168.29.43:5001';
      } else {
        return 'http://192.168.29.43:5001';
      }
    }
    return 'http://localhost:5001';
  }
  return 'https://peoplesoft-develop.onrender.com'; // Develop Backend
  // return 'https://peoplesoft-backend.onrender.com'; // Actual Backend
}
