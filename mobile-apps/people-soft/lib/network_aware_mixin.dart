import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/network_service.dart';

mixin NetworkAwareMixin<T extends StatefulWidget> on State<T> {
  bool _isOnline = true;
  bool _isSlow = false;
  bool _showBackOnline = false;
  late StreamSubscription _connectivitySubscription;
  Timer? _slowCheckTimer;
  Timer? _backOnlineTimer;

  @override
  void initState() {
    super.initState();
    _checkInitialStatus();
    _connectivitySubscription = NetworkService().onConnectivityChanged.listen((
      results,
    ) {
      _updateStatus(results);
    });

    // Periodically check for slow network if online
    _slowCheckTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (_isOnline) {
        _checkSlowNetwork();
      }
    });
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    _slowCheckTimer?.cancel();
    _backOnlineTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkInitialStatus() async {
    final online = await NetworkService().isOnline();
    if (mounted) {
      setState(() {
        _isOnline = online;
      });
      if (online) {
        _checkSlowNetwork();
      }
    }
  }

  void _updateStatus(List<ConnectivityResult> results) {
    final online = results.any((r) => r != ConnectivityResult.none);
    if (mounted) {
      if (!_isOnline && online) {
        // Became online after being offline
        setState(() {
          _showBackOnline = true;
        });
        _backOnlineTimer?.cancel();
        _backOnlineTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) {
            setState(() {
              _showBackOnline = false;
            });
          }
        });
      }

      setState(() {
        _isOnline = online;
        if (!online) {
          _isSlow = false;
          _showBackOnline = false;
          _backOnlineTimer?.cancel();
        }
      });
      if (online) {
        _checkSlowNetwork();
      }
    }
  }

  Future<void> _checkSlowNetwork() async {
    if (!_isOnline) return;
    final slow = await NetworkService().isSlowNetwork();
    if (mounted) {
      setState(() {
        _isSlow = slow;
      });
    }
  }

  Widget buildNetworkStatusBanner() {
    if (!_isOnline) {
      return Container(
        width: double.infinity,
        color: Colors.red.shade600,
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.signal_wifi_connected_no_internet_4,
              color: Colors.white,
              size: 16,
            ),
            SizedBox(width: 8),
            Text(
              "No Network Connection",
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    if (_showBackOnline) {
      return Container(
        width: double.infinity,
        color: Colors.green.shade600,
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.wifi_2_bar_outlined, color: Colors.white, size: 16),
            SizedBox(width: 8),
            Text(
              "Back to online",
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    if (_isSlow) {
      return Container(
        width: double.infinity,
        color: Colors.orange.shade600,
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.network_check_rounded, color: Colors.white, size: 16),
            SizedBox(width: 8),
            Text(
              "Connecting to server...",
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
