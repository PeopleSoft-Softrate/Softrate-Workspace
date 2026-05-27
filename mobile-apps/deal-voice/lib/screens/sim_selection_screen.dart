import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';
import '../utils/ui_utils.dart';

class SimSelectionScreen extends StatefulWidget {
  const SimSelectionScreen({super.key});

  @override
  State<SimSelectionScreen> createState() => _SimSelectionScreenState();
}

class _SimSelectionScreenState extends State<SimSelectionScreen> {
  static const platform = MethodChannel('com.example.mobile/sim');

  bool _isLoading = true;
  String _statusMessage = 'Checking device SIMs...';
  List<Map<String, dynamic>> _simCards = [];

  @override
  void initState() {
    super.initState();
    _checkSetupAndFetch();
  }

  Future<void> _checkSetupAndFetch() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString('companyCode') ?? '';
    if (code.isEmpty) {
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/company-code');
      }
      return;
    }
    await _fetchSimData();
  }

  Future<void> _fetchSimData() async {
    final phoneStatus = await Permission.phone.request();

    if (phoneStatus.isGranted) {
      try {
        final List<dynamic> result = await platform.invokeMethod('getSimCards');

        setState(() {
          _simCards = result.map((e) => Map<String, dynamic>.from(e)).toList();
          _isLoading = false;
        });

        if (_simCards.isEmpty) {
          setState(() {
            _statusMessage =
                'No SIM cards detected or permission denied natively.';
          });
        } else if (_simCards.length == 1) {
          // Auto select if only 1 SIM
          _loginWithSim(_simCards.first);
        } else {
          setState(() {
            _statusMessage = 'Multiple SIMs detected. Please select one:';
          });
        }
      } on PlatformException catch (e) {
        setState(() {
          _isLoading = false;
          _statusMessage = 'Failed to fetch SIM data from native. ${e.message}';
        });
      }
    } else {
      setState(() {
        _isLoading = false;
        _statusMessage =
            'Phone permission is required to detect mobile number.';
      });
    }
  }

  Future<void> _loginWithSim(Map<String, dynamic> sim) async {
    final carrier = sim['carrierName']?.toString() ?? '';
    final displayName = sim['displayName']?.toString() ?? '';

    // FIX Bug B: Normalise slotIndex to 0-based.
    // Some native plugins return 0-based (0,1), some return 1-based (1,2).
    // Detect which by finding the minimum slot value across all SIM cards.
    final rawSlot = sim['slotIndex'];
    int slot =
        rawSlot is int ? rawSlot : int.tryParse(rawSlot.toString()) ?? 0;

    if (_simCards.length > 1) {
      final allSlots = _simCards
          .map((s) => s['slotIndex'] is int
              ? s['slotIndex'] as int
              : int.tryParse(s['slotIndex'].toString()) ?? 0)
          .toList();
      final minSlot = allSlots.fold<int>(999, (a, b) => b < a ? b : a);
      // If minimum slot is 1, the plugin is 1-based — convert to 0-based
      if (minSlot == 1) slot = slot - 1;
    }

    final simLabel = carrier.isNotEmpty ? carrier : 'SIM ${slot + 1}';

    setState(() {
      _isLoading = true;
      _statusMessage = 'Logging in with $simLabel...';
    });

    final prefs = await SharedPreferences.getInstance();
    final companyCode = prefs.getString('companyCode') ?? '';

    String rawNumber = sim['number']?.toString() ?? '';

    // Strip common country code prefixes (e.g. +91, 0091) to get bare local number
    if (rawNumber.startsWith('+')) rawNumber = rawNumber.substring(1);
    if (rawNumber.length > 10 && rawNumber.startsWith('91')) {
      rawNumber = rawNumber.substring(2);
    }
    rawNumber = rawNumber.replaceAll(RegExp(r'[\s\-]'), '');

    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _statusMessage = rawNumber.isEmpty
          ? 'Number not found on SIM.'
          : 'Please confirm your number.';
    });

    final confirmedNumber = await _showManualNumberDialog(
      simLabel,
      slot,
      prefill: rawNumber,
    );
    if (confirmedNumber == null || confirmedNumber.isEmpty) {
      setState(() => _statusMessage = 'Login cancelled.');
      return;
    }
    rawNumber = confirmedNumber;

    setState(() {
      _isLoading = true;
      _statusMessage = 'Logging in with $simLabel...';
    });

    // FIX Bug A: Save subscriptionId as the raw value from the platform
    // (may be a large int like "100001" or a small slot digit like "1").
    // The filter's Step 1a does exact accountId == selectedSubId match,
    // which works correctly when both sides hold the same raw value.
    final subscriptionId = sim['subscriptionId']?.toString().trim() ?? '';

    // FIX Bug C: isManualEntry must NOT be set just because the phone number
    // is empty. On Samsung, the carrier blocks number read — but subId,
    // carrier name, and displayName are still available and reliable for
    // filtering. Only mark as manual when we truly have NO SIM identity at all.
    final hasIdentity = subscriptionId.isNotEmpty ||
        carrier.isNotEmpty ||
        displayName.isNotEmpty;
    final isManualEntry = !hasIdentity;

    // Use carrierName; fall back to displayName if carrierName is blank.
    final effectiveCarrier =
        carrier.isNotEmpty ? carrier : (displayName.isNotEmpty ? displayName : '');

    debugPrint(
      'SIMSave → slot=$slot subId="$subscriptionId" carrier="$effectiveCarrier" '
      'displayName="$displayName" isManual=$isManualEntry',
    );

    await prefs.setBool('isManualEntry', isManualEntry);
    await prefs.setString('selectedSimCarrier', effectiveCarrier);
    await prefs.setString('selectedSimDisplayName', displayName);
    await prefs.setString('selectedSimSubscriptionId', subscriptionId);
    await prefs.setInt('selectedSimSlot', slot);

    // Force-reset sync timestamp when a new SIM is selected so the next
    // sync captures all of today's calls on the new SIM from the start.
    final now = DateTime.now();
    await prefs.setInt(
      'lastCallLogSyncTimestamp',
      DateTime(now.year, now.month, now.day).millisecondsSinceEpoch,
    );

    final response = await ApiService.loginEmployee(companyCode, rawNumber);

    if (!mounted) return;

    if (response['success'] == true) {
      final employee = response['employee'];
      await prefs.setBool('isLoggedIn', true);
      await prefs.setString('employeeName', employee['name'] ?? '');
      await prefs.setString('mobileNumber', rawNumber);

      final existingCode = employee['employeeCode'] ?? '';
      if (existingCode.isNotEmpty) {
        await prefs.setString('employeeCode', existingCode);
      }

      if (existingCode.isEmpty && mounted) {
        await _showEmployeeCodeDialog(employee['_id'] ?? '');
      }

      if (mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } else {
      setState(() {
        _isLoading = false;
      });
      UIUtils.showPremiumSnackBar(
        context,
        response['message'] ?? 'Login failed',
        isError: true,
      );
    }
  }

  /// Shows an optional dialog where the employee can set their employee code.
  Future<void> _showEmployeeCodeDialog(String employeeId) async {
    final codeController = TextEditingController();
    String errorText = '';

    await UIUtils.showSmoothDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => PremiumDialog(
          icon: Icons.badge_outlined,
          iconColor: Colors.indigo,
          title: 'Employee Code',
          subtitle:
              'Your manager may assign you a code. Enter it below, or skip for now.',
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: codeController,
                textCapitalization: TextCapitalization.characters,
                style: const TextStyle(fontSize: 14, fontFamily: 'Inter'),
                decoration: InputDecoration(
                  labelText: 'Company Code',
                  hintText: 'e.g. EMP-001',
                  prefixIcon: const Icon(Icons.pin_outlined, size: 20),
                  errorText: errorText.isNotEmpty ? errorText : null,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16)),
                  contentPadding: const EdgeInsets.all(16),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: Text('Skip for now',
                  style: TextStyle(
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Inter')),
            ),
            ElevatedButton(
              onPressed: () async {
                final code = codeController.text.trim();
                if (code.isEmpty) {
                  setDialogState(() => errorText = 'Enter code or tap Skip.');
                  return;
                }
                final res = await ApiService.updateEmployeeCode(
                  employeeId: employeeId,
                  employeeCode: code,
                );
                if (res['success'] == true) {
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setString('employeeCode', code);
                  if (ctx.mounted) Navigator.pop(ctx);
                } else {
                  setDialogState(
                      () => errorText = res['message'] ?? 'Failed to save.');
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text('Save Code',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontFamily: 'Inter')),
            ),
          ],
        ),
      ),
    );
  }

  Future<String?> _showManualNumberDialog(String carrier, int slotIndex,
      {String prefill = ''}) async {
    final numberController = TextEditingController(text: prefill);
    String errorText = '';
    final hasDetected = prefill.isNotEmpty;

    return await UIUtils.showSmoothDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => PremiumDialog(
          icon: hasDetected
              ? Icons.verified_user_rounded
              : Icons.phone_android_rounded,
          iconColor: Colors.indigo,
          title: hasDetected ? 'Verify Number' : 'Enter Number',
          subtitle: hasDetected
              ? 'SIM ${slotIndex + 1} ($carrier) number detected. Please confirm.'
              : 'Could not detect number for SIM ${slotIndex + 1}. Please enter manually.',
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: numberController,
                keyboardType: TextInputType.phone,
                style: const TextStyle(fontSize: 14, fontFamily: 'Inter'),
                decoration: InputDecoration(
                  labelText: 'Mobile Number',
                  hintText: 'e.g. 9876543210',
                  prefixIcon: const Icon(Icons.phone, size: 20),
                  errorText: errorText.isNotEmpty ? errorText : null,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16)),
                  contentPadding: const EdgeInsets.all(16),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: Text('Cancel',
                  style: TextStyle(
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Inter')),
            ),
            ElevatedButton(
              onPressed: () {
                final num = numberController.text.trim();
                if (num.isEmpty || num.length < 8) {
                  setDialogState(() => errorText = 'Enter a valid number.');
                  return;
                }
                Navigator.pop(ctx, num);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text('Continue',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontFamily: 'Inter')),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detect Mobile Number')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.sim_card, size: 64, color: Colors.indigo),
            const SizedBox(height: 24),
            Text(
              _statusMessage,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            if (_isLoading) const Center(child: CircularProgressIndicator()),
            if (!_isLoading && _simCards.length > 1)
              ..._simCards.map((sim) {
                final rawSlot = sim['slotIndex'];
                final slotInt = rawSlot is int
                    ? rawSlot
                    : int.tryParse(rawSlot.toString()) ?? 0;
                final allSlots = _simCards
                    .map((s) => s['slotIndex'] is int
                        ? s['slotIndex'] as int
                        : int.tryParse(s['slotIndex'].toString()) ?? 0)
                    .toList();
                final minSlot =
                    allSlots.fold<int>(999, (a, b) => b < a ? b : a);
                final displaySlot =
                    minSlot == 1 ? slotInt : slotInt + 1; // always show 1-based
                final carrierLabel =
                    sim['carrierName']?.toString() ?? 'Unknown';

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: ElevatedButton.icon(
                    onPressed: () => _loginWithSim(sim),
                    icon: const Icon(Icons.sim_card),
                    label: Text('Use SIM $displaySlot ($carrierLabel)'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.indigo,
                      side: const BorderSide(color: Colors.indigo),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}