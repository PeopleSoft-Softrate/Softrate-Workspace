import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';

class NetworkService {
  static final NetworkService _instance = NetworkService._internal();
  factory NetworkService() => _instance;
  NetworkService._internal();

  final Connectivity _connectivity = Connectivity();
  
  Stream<List<ConnectivityResult>> get onConnectivityChanged => _connectivity.onConnectivityChanged;

  Future<bool> isOnline() async {
    final result = await _connectivity.checkConnectivity();
    return result.any((r) => r != ConnectivityResult.none);
  }

  /// Tests latency by pinging the backend. 
  /// Returns true if latency is high (> 3 seconds) or if offline.
  Future<bool> isSlowNetwork() async {
    final startTime = DateTime.now();
    try {
      final response = await http.get(
        Uri.parse("${getBaseUrl()}/health-check"), // Need a light endpoint
      ).timeout(const Duration(seconds: 5));
      
      final endTime = DateTime.now();
      final duration = endTime.difference(startTime).inMilliseconds;
      
      // If it takes more than 2.5 seconds to get a response from a simple health check, it's slow.
      return duration > 2500;
    } catch (_) {
      return true; // Error or timeout usually means slow/offline
    }
  }
}
