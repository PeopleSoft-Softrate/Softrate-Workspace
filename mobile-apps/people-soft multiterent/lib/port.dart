import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

// Set to true during local development to hit your local server.
const bool useLocalBackend = true;

/// The local network IP of your dev machine (used when useLocalBackend = true).
const String _localIp = '192.168.29.43';
const int _localPort = 5001;

String getBaseUrl() {
  if (useLocalBackend) {
    if (kIsWeb) return 'http://localhost:$_localPort';
    if (Platform.isAndroid || Platform.isIOS) return 'http://$_localIp:$_localPort';
    return 'http://localhost:$_localPort';
  }
  return 'https://workspace.softrateglobal.com/hrms-api';
}

