import 'package:call_log/call_log.dart';
import 'package:intl/intl.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class CallLogService {
  static const _lastSyncKey = 'lastCallLogSyncTimestamp';

  static Future<void> resetSyncTimestampIfNewDay() async {
    final prefs = await SharedPreferences.getInstance();
    final now = DateTime.now();
    final startOfToday =
        DateTime(now.year, now.month, now.day).millisecondsSinceEpoch;

    final lastSync = prefs.getInt(_lastSyncKey) ?? 0;

    // Only reset if no sync has happened yet today (avoids re-sending all
    // today's calls every time the app is opened).
    if (lastSync < startOfToday) {
      await prefs.setInt(_lastSyncKey, startOfToday);
      debugPrint(
          'CallLog: New day detected — reset sync timestamp to start of today');
    } else {
      debugPrint('CallLog: Sync timestamp already set for today, keeping it');
    }
  }

  static Future<Map<String, dynamic>> syncNewEntries({
    required String companyCode,
    required String phone,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();

    final selectedCarrier = prefs.getString('selectedSimCarrier') ?? '';
    final selectedDisplayName =
        prefs.getString('selectedSimDisplayName') ?? '';
    final selectedSlot = prefs.getInt('selectedSimSlot') ?? 0;
    final selectedSubId =
        prefs.getString('selectedSimSubscriptionId') ?? '';
    final isManualEntry = prefs.getBool('isManualEntry') ?? false;

    debugPrint(
        'CallLog: Syncing for SIM: $selectedDisplayName ($selectedCarrier)');

    final now = DateTime.now();
    final queryTo = now.millisecondsSinceEpoch;
    final lastSync = prefs.getInt(_lastSyncKey) ??
        DateTime(now.year, now.month, now.day).millisecondsSinceEpoch;

    final Iterable<CallLogEntry> entries =
        await CallLog.query(dateFrom: lastSync, dateTo: queryTo);
    final all = entries.toList();
    debugPrint(
        'CallLogSync: Fetched ${all.length} entries from system between $lastSync and $queryTo');

    final relevant = all
        .where((e) => _isCallFromSelectedSim(
              e,
              selectedCarrier,
              selectedDisplayName,
              selectedSlot,
              selectedSubId,
              isManualEntry,
            ))
        .toList();
    debugPrint(
        'CallLogSync: ${relevant.length} entries remain after SIM filtering');

    if (relevant.isEmpty) return {'success': true, 'hasNew': false};

    final groupedCalls = <String, List<CallLogEntry>>{};

    for (final e in relevant) {
      final timestamp = e.timestamp ?? 0;
      final dateStr = timestamp == 0
          ? DateFormat('yyyy-MM-dd').format(now)
          : DateFormat('yyyy-MM-dd')
              .format(DateTime.fromMillisecondsSinceEpoch(timestamp));

      if (!groupedCalls.containsKey(dateStr)) {
        groupedCalls[dateStr] = [];
      }
      groupedCalls[dateStr]!.add(e);
    }

    bool allSuccess = true;
    String? lastErrorMsg;

    for (final dateStr in groupedCalls.keys) {
      final entriesForDate = groupedCalls[dateStr]!;

      int incoming = 0, outgoing = 0, missed = 0, rejected = 0;
      int incomingDur = 0, outgoingDur = 0, totalDur = 0;
      final callsList = <Map<String, dynamic>>[];

      for (final e in entriesForDate) {
        final dur = e.duration ?? 0;
        String typeStr = 'unknown';

        final effective = (e.callType == CallType.incoming && dur == 0)
            ? CallType.rejected
            : e.callType;

        switch (effective) {
          case CallType.incoming:
            incoming++;
            incomingDur += dur;
            totalDur += dur;
            typeStr = 'incoming';
            break;
          case CallType.outgoing:
            outgoing++;
            outgoingDur += dur;
            totalDur += dur;
            typeStr = 'outgoing';
            break;
          case CallType.missed:
            missed++;
            typeStr = 'missed';
            break;
          case CallType.rejected:
            rejected++;
            typeStr = 'rejected';
            break;
          default:
            break;
        }

        callsList.add({
          'number': e.number ?? '',
          'name': e.name ?? '',
          'callType': typeStr,
          'duration': dur,
          'timestamp': e.timestamp ?? 0,
        });
      }

      final res = await ApiService.syncCallLogs(
        companyCode: companyCode,
        phone: phone,
        date: dateStr,
        incoming: incoming,
        outgoing: outgoing,
        missed: missed,
        rejected: rejected,
        incomingDuration: incomingDur,
        outgoingDuration: outgoingDur,
        totalDuration: totalDur,
        calls: callsList,
        deviceModel: 'Android Device',
        appVersion: '1.0.0',
      );

      if (res['success'] != true) {
        allSuccess = false;
        lastErrorMsg = res['message'];
      }
    }

    if (allSuccess) {
      await prefs.setInt(_lastSyncKey, queryTo);
      return {'success': true, 'hasNew': true};
    }
    return {'success': false, 'message': lastErrorMsg, 'hasNew': true};
  }

  static Future<List<CallLogEntry>> fetchLogsForPeriod(
      int from, int to) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();

    final selectedCarrier = prefs.getString('selectedSimCarrier') ?? '';
    final selectedDisplayName =
        prefs.getString('selectedSimDisplayName') ?? '';
    final selectedSlot = prefs.getInt('selectedSimSlot') ?? 0;
    final selectedSubId =
        prefs.getString('selectedSimSubscriptionId') ?? '';
    final isManualEntry = prefs.getBool('isManualEntry') ?? false;

    final entries = await CallLog.query(dateFrom: from, dateTo: to);

    final all = entries.toList();
    debugPrint(
        'CallLog UI: Verifying SIM for ${all.length} entries in period...');

    final filtered = all.where((e) {
      return _isCallFromSelectedSim(
        e,
        selectedCarrier,
        selectedDisplayName,
        selectedSlot,
        selectedSubId,
        isManualEntry,
      );
    }).toList();

    return filtered;
  }

  static Future<List<CallLogEntry>> fetchTodayLogs() async {
    final now = DateTime.now();
    final startOfToday = DateTime(now.year, now.month, now.day);
    return fetchLogsForPeriod(
        startOfToday.millisecondsSinceEpoch, now.millisecondsSinceEpoch);
  }

  // ---------------------------------------------------------------------------
  // Samsung stores phoneAccountId in various non-numeric formats:
  //   "com.android.phone/1"                      → slot-based handle
  //   "com.samsung.android.app.telephony/2"       → Samsung-specific handle
  //   "1" or "2"                                  → plain slot on some models
  //   "tel:+91XXXXXXXXXX"                         → phone-number handle (rare)
  //
  // Vi (Vodafone Idea) simDisplayName variants: "Vi", "Vodafone", "Idea", "Vi SIM 1"
  // Jio simDisplayName variants:               "Jio", "Reliance Jio", "JIO", "Jio 4G"
  //
  // Strategy:
  //   0. Direct exact subId match (standard Android).
  //   1. Extract trailing slot digit from Samsung account handles (1-based).
  //   2. Display-name match (case-insensitive).
  //   3. Carrier fuzzy match with alias table (word-boundary safe).
  //   4. Fallback — allow when device exposes no SIM metadata at all.
  // ---------------------------------------------------------------------------

  /// Known carrier aliases — covers Vi/Vodafone/Idea and Jio variants
  /// reported across Samsung One UI versions. Add more as needed.
  static const Map<String, List<String>> _carrierAliases = {
    'vi': ['vi', 'vodafone', 'idea', 'vi sim', 'vodafone idea'],
    'vodafone': ['vi', 'vodafone', 'idea', 'vi sim', 'vodafone idea'],
    'idea': ['vi', 'vodafone', 'idea', 'vi sim', 'vodafone idea'],
    'jio': ['jio', 'reliance jio', 'jio 4g', 'jio sim', 'r-jio'],
    'reliance jio': ['jio', 'reliance jio', 'jio 4g', 'jio sim', 'r-jio'],
    'airtel': ['airtel', 'bharti airtel', 'airtel 4g'],
    'bsnl': ['bsnl', 'bharat sanchar'],
  };

  /// Try to extract a numeric slot digit from Samsung-style account handles.
  ///
  ///   "com.android.phone/1"                 → "1"
  ///   "com.samsung.android.app.telephony/2" → "2"
  ///   "1"                                   → "1"  (already plain)
  ///   "tel:+91XXXXXXXXXX"                   → null (phone-number handle)
  static String? _extractSlotFromAccountId(String accountId) {
    if (accountId.isEmpty) return null;

    // Already a plain number (e.g. "1" or "2")
    if (RegExp(r'^\d+$').hasMatch(accountId)) return accountId;

    // Samsung handle like "com.xxx.yyy/1"
    final slashIndex = accountId.lastIndexOf('/');
    if (slashIndex != -1) {
      final afterSlash = accountId.substring(slashIndex + 1).trim();
      if (RegExp(r'^\d+$').hasMatch(afterSlash)) return afterSlash;
    }

    // Phone-number handle or unknown format — cannot determine slot
    return null;
  }

  /// Returns true if [simName] matches [selectedCarrier] considering
  /// known carrier aliases (Vi = Vodafone = Idea, Jio = Reliance Jio, etc.)
  ///
  /// FIX: uses word-boundary regex instead of bare contains() to prevent
  /// false positives like "airtel idea" matching the idea/Vi group.
  static bool _carrierMatches(String simName, String selectedCarrier) {
    final simLow = simName.toLowerCase().trim();
    final carrierLow = selectedCarrier.toLowerCase().trim();

    if (simLow == carrierLow) return true;

    // Word-boundary safe alias check — prevents "airtel idea" from matching
    // both airtel and idea groups simultaneously.
    bool aliasMatches(String sim, String alias) {
      if (sim == alias) return true;
      return RegExp(r'(^|\s)' + RegExp.escape(alias) + r'(\s|$)')
          .hasMatch(sim);
    }

    // Check aliases for the selected carrier
    final aliases = _carrierAliases[carrierLow];
    if (aliases != null) {
      for (final alias in aliases) {
        if (aliasMatches(simLow, alias)) return true;
      }
    }

    // Reverse check: find which alias group simName belongs to,
    // then see if selectedCarrier is in the same group.
    for (final entry in _carrierAliases.entries) {
      final simInGroup = entry.value.any((a) => aliasMatches(simLow, a));
      if (simInGroup) {
        final selectedInGroup =
            entry.value.any((a) => aliasMatches(carrierLow, a));
        if (selectedInGroup) return true;
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Unified SIM filtering — works across stock Android, Samsung One UI,
  // Vivo, Oppo, Realme, and old Android 8/9 devices.
  //
  // Changes vs original:
  //   • Samsung handles are 1-based; selectedSimSlot is 0-based.
  //     We compare slotFromHandle against (selectedSlot + 1).
  //   • Slot mismatch no longer hard-rejects when simName is available —
  //     falls through to name/carrier checks.
  //   • Display name comparison is case-insensitive.
  //   • Carrier fuzzy match uses word-boundary regex (no false positives).
  //   • Step 4 passes through on old Android when carrier is the only saved
  //     preference and the call log entry has zero metadata.
  // ---------------------------------------------------------------------------
  static bool _isCallFromSelectedSim(
    CallLogEntry e,
    String selectedCarrier,
    String selectedDisplayName,
    int selectedSlot, // 0-based index stored during SIM selection
    String selectedSubId,
    bool isManualEntry,
  ) {
    // ── Guard: nothing saved → allow all calls ──────────────────────────────
    if (selectedCarrier.isEmpty &&
        selectedSubId.isEmpty &&
        selectedDisplayName.isEmpty &&
        !isManualEntry) {
      return true;
    }

    // ── Guard: manual SIM entry → no reliable metadata, allow all ───────────
    if (isManualEntry) return true;

    final accountId = (e.phoneAccountId ?? '').trim();
    final simName = (e.simDisplayName ?? '').trim();

    debugPrint(
      'SIMFilter → accountId="$accountId" simName="$simName" | '
      'selected: carrier="$selectedCarrier" subId="$selectedSubId" '
      'slot=$selectedSlot displayName="$selectedDisplayName"',
    );

    // ── Step 1: Subscription ID / account handle match ──────────────────────
    if (accountId.isNotEmpty) {
      // 1a. Direct exact subId match (standard Android)
      if (selectedSubId.isNotEmpty && accountId == selectedSubId) {
        debugPrint('SIMFilter → PASS via exact subId match');
        return true;
      }

      final slotFromHandle = _extractSlotFromAccountId(accountId);
      if (slotFromHandle != null) {
        // 1b. Handle digit matches savedSubId (when subId is slot-style "1","2")
        if (selectedSubId.isNotEmpty && slotFromHandle == selectedSubId) {
          debugPrint('SIMFilter → PASS via slotFromHandle == selectedSubId');
          return true;
        }

        // 1c. Samsung handles are 1-based; selectedSlot is 0-based → add 1.
        final expectedSlot1Based = (selectedSlot + 1).toString();
        if (slotFromHandle == expectedSlot1Based) {
          debugPrint(
              'SIMFilter → PASS via slotFromHandle ($slotFromHandle) == selectedSlot+1 ($expectedSlot1Based)');
          return true;
        }

        // Slot extracted but doesn't match — do NOT hard-reject yet.
        // Fall through to name/carrier checks even when simName is empty,
        // because some devices populate accountId but not simDisplayName.
        debugPrint(
            'SIMFilter → slot mismatch, continuing to name/carrier checks');
      }
      // accountId in unrecognised format (e.g. tel: URI) — fall through.
    }

    // ── Step 2: Display name comparison (case-insensitive) ──────────────────
    if (selectedDisplayName.isNotEmpty && simName.isNotEmpty) {
      final nameMatch =
          simName.toLowerCase() == selectedDisplayName.toLowerCase();
      if (nameMatch) {
        debugPrint('SIMFilter → PASS via case-insensitive displayName match');
        return true;
      }
      // Name mismatch — try carrier fuzzy match as last resort.
      if (selectedCarrier.isNotEmpty) {
        final fuzzy = _carrierMatches(simName, selectedCarrier);
        debugPrint('SIMFilter → displayName mismatch, carrier fuzzy=$fuzzy');
        return fuzzy;
      }
      debugPrint(
          'SIMFilter → FAIL via displayName mismatch, no carrier to fuzzy-match');
      return false;
    }

    // ── Step 3: Carrier fuzzy match ──────────────────────────────────────────
    if (simName.isNotEmpty && selectedCarrier.isNotEmpty) {
      final fuzzy = _carrierMatches(simName, selectedCarrier);
      debugPrint('SIMFilter → carrier fuzzy=$fuzzy');
      return fuzzy;
    }

    // ── Step 4: No-metadata fallback (old Android 8/9 devices) ───────────────
    //
    // Old devices often expose accountId="" and simDisplayName="" for every
    // call log entry. We cannot confirm SIM identity, so:
    //   • If no preference is saved at all → pass (single-SIM / no filtering).
    //   • If carrier is the ONLY saved preference (subId and displayName both
    //     empty) → pass leniently. The user selected this SIM; we have no
    //     metadata to contradict it.
    //   • If subId or displayName is also saved → reject to avoid leaking
    //     the other SIM's calls.
    if (accountId.isEmpty && simName.isEmpty) {
      final hasPreference = selectedCarrier.isNotEmpty ||
          selectedDisplayName.isNotEmpty ||
          selectedSubId.isNotEmpty;

      if (!hasPreference) {
        debugPrint(
            'SIMFilter → PASS via no-metadata fallback (no preference set)');
        return true;
      }

      // FIX: carrier-only preference on a metadata-less device — be lenient.
      if (selectedCarrier.isNotEmpty &&
          selectedDisplayName.isEmpty &&
          selectedSubId.isEmpty) {
        debugPrint(
            'SIMFilter → PASS via carrier-only leniency on metadata-less device');
        return true;
      }

      debugPrint(
          'SIMFilter → FAIL via no-metadata entry but SIM preference exists');
      return false;
    }

    debugPrint('SIMFilter → FAIL (no match found)');
    return false;
  }
}