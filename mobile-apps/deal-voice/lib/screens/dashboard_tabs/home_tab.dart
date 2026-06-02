import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../utils/ui_utils.dart';
import 'package:call_log/call_log.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import '../../services/api_service.dart';
import '../../services/call_log_service.dart';
import 'package:permission_handler/permission_handler.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> with SingleTickerProviderStateMixin {
  // Unused fields from header removed
  String _companyCode = '';
  String _mobileNumber = '';
  String _whatsappTemplate = 'Hi {name}!';
  String _smsTemplate = 'Hi {name}!';
  bool _showFloatingActions = true;
  String? _expandedCardKey;

  List<CallLogEntry> _allCallLogs = [];
  bool _isLoadingLogs = true;
  bool _isSyncing = false;
  String _searchQuery = '';
  int _selectedTab = 0; // 0=All, 1=Incoming, 2=Outgoing, 3=Missed, 4=Rejected
  DateTime? _lastSyncTime;
  bool _isServiceRunning = false;
  StreamSubscription? _serviceSubscription;

  final TextEditingController _searchController = TextEditingController();
  late AnimationController _syncRotateController;

  final _tabs = [
    _TabItem(label: 'All Calls', icon: Icons.phone),
    _TabItem(label: 'Incoming', icon: Icons.call_received),
    _TabItem(label: 'Outgoing', icon: Icons.call_made),
    _TabItem(label: 'Missed', icon: Icons.call_missed),
    _TabItem(label: 'Rejected', icon: Icons.call_end),
  ];

  @override
  void initState() {
    super.initState();
    _syncRotateController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );
    _loadProfile().then((_) {
      // Reset sync timestamp only if it's a new day (not on every app open)
      CallLogService.resetSyncTimestampIfNewDay();
      // First full load
      _fetchAllAndSync();
      // Monitor background service status
      _monitorService();
    });
  }

  void _monitorService() {
    _serviceSubscription = FlutterBackgroundService().on('update').listen((event) {
      if (mounted) {
        setState(() {
          _isServiceRunning = true;
          _lastSyncTime = DateTime.now();
        });
        // Optionally refresh logs if new calls were detected
        if (event?['hasNew'] == true) {
          _fetchAllAndSync();
        }
      }
    });

    // Check initial status
    FlutterBackgroundService().isRunning().then((running) {
      if (mounted) setState(() => _isServiceRunning = running);
    });
  }

  @override
  void dispose() {
    _serviceSubscription?.cancel();
    _searchController.dispose();
    _syncRotateController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _companyCode = prefs.getString('companyCode') ?? 'XXXX';
      _mobileNumber = prefs.getString('mobileNumber') ?? 'N/A';
      _whatsappTemplate = prefs.getString('whatsappTemplate') ?? 'Hi {name}!';
      _smsTemplate = prefs.getString('smsTemplate') ?? 'Hi {name}!';
      _showFloatingActions = prefs.getBool('showFloatingActions') ?? true;
    });
  }

  /// Full load on app open — fetches today's SIM-filtered logs for UI display only.
  /// DB sync is handled exclusively by syncNewEntries / background service
  /// to avoid re-pushing the full day's log (including other SIM calls) on every open.
  Future<void> _fetchAllAndSync() async {
    setState(() => _isLoadingLogs = true);
    try {
      final logs = await CallLogService.fetchTodayLogs();
      if (mounted) {
        setState(() {
          _allCallLogs = logs;
          _isLoadingLogs = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingLogs = false);
    }
  }

  /// Called every 30s — only syncs NEW entries since the last sync.
  Future<void> _syncNewCalls() async {
    if (_companyCode.isEmpty || _mobileNumber.isEmpty) return;
    if (mounted) {
      setState(() => _isSyncing = true);
      _syncRotateController.repeat();
    }
    try {
      final res = await CallLogService.syncNewEntries(
        companyCode: _companyCode,
        phone: _mobileNumber,
      );
      
      if (res['success'] == false) {
        if (mounted) {
          UIUtils.showPremiumSnackBar(context, 'Sync failed: ${res['message']}', isError: true);
        }
      } else if (res['hasNew'] == true) {
        // Refresh the displayed list if new calls were found and synced
        final logs = await CallLogService.fetchTodayLogs();
        if (mounted) {
          setState(() {
            _allCallLogs = logs;
            _lastSyncTime = DateTime.now();
          });
        }
      } else {
        if (mounted) setState(() => _lastSyncTime = DateTime.now());
      }
    } catch (e) {
      if (mounted) {
        UIUtils.showPremiumSnackBar(context, 'Sync error: $e', isError: true);
      }
    } finally {
      if (mounted) {
        setState(() => _isSyncing = false);
        _syncRotateController.stop();
      }
    }
  }

  /// Low-level: pushes a list of entries to the backend (used by _fetchAllAndSync).
  Future<void> _pushLogsToBackend(List<CallLogEntry> list) async {
    int incoming = 0, outgoing = 0, missed = 0, rejected = 0;
    int incomingDur = 0, outgoingDur = 0, totalDur = 0;
    final callsList = <Map<String, dynamic>>[];

    for (final e in list) {
      final dur = e.duration ?? 0;
      // totalDur calculation moved inside switch to only include answered calls
      String typeStr;
      final effective = (e.callType == CallType.incoming && dur == 0)
          ? CallType.rejected
          : e.callType;

      switch (effective) {
        case CallType.incoming:
          incoming++; incomingDur += dur; totalDur += dur; typeStr = 'incoming'; break;
        case CallType.outgoing:
          outgoing++; outgoingDur += dur; totalDur += dur; typeStr = 'outgoing'; break;
        case CallType.missed:
          missed++; typeStr = 'missed'; break;
        case CallType.rejected:
          rejected++; typeStr = 'rejected'; break;
        default:
          typeStr = 'unknown';
      }

      callsList.add({
        'number': e.number ?? '',
        'name': e.name ?? '',
        'callType': typeStr,
        'duration': dur,
        'timestamp': e.timestamp ?? 0,
      });
    }

    String deviceModel = '';
    try {
      final di = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final info = await di.androidInfo;
        deviceModel = '${info.manufacturer} ${info.model}';
      } else if (Platform.isIOS) {
        final info = await di.iosInfo;
        deviceModel = info.utsname.machine;
      }
    } catch (_) {}

    final dateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await ApiService.syncCallLogs(
      companyCode: _companyCode,
      phone: _mobileNumber,
      date: dateStr,
      incoming: incoming,
      outgoing: outgoing,
      missed: missed,
      rejected: rejected,
      incomingDuration: incomingDur,
      outgoingDuration: outgoingDur,
      totalDuration: totalDur,
      calls: callsList,
      deviceModel: deviceModel,
      appVersion: '1.0.0',
    );
  }

  List<CallLogEntry> get _filteredLogs {
    List<CallLogEntry> logs = _allCallLogs;

    // Tab filter
    if (_selectedTab == 1) {
      logs = logs.where((e) => _getEffectiveCallType(e) == CallType.incoming).toList();
    } else if (_selectedTab == 2) {
      logs = logs.where((e) => _getEffectiveCallType(e) == CallType.outgoing).toList();
    } else if (_selectedTab == 3) {
      logs = logs.where((e) => _getEffectiveCallType(e) == CallType.missed).toList();
    } else if (_selectedTab == 4) {
      logs = logs.where((e) => _getEffectiveCallType(e) == CallType.rejected).toList();
    }

    // Search filter
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      logs = logs.where((e) {
        final name = (e.name ?? '').toLowerCase();
        final number = (e.number ?? '').toLowerCase();
        return name.contains(q) || number.contains(q);
      }).toList();
    }

    return logs;
  }

  CallType? _getEffectiveCallType(CallLogEntry e) {
    if (e.callType == CallType.incoming && (e.duration ?? 0) == 0) {
      return CallType.rejected;
    }
    return e.callType;
  }

  String _formatDuration(int? seconds) {
    final s = seconds ?? 0;
    if (s == 0) return '0s';
    final h = s ~/ 3600;
    final m = (s % 3600) ~/ 60;
    final sec = s % 60;
    if (h > 0) return '${h}h ${m}m ${sec}s';
    if (m > 0) return '${m}m ${sec}s';
    return '${sec}s';
  }

  String _formatTime(int? timestamp) {
    if (timestamp == null) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch(timestamp);
    return DateFormat('hh:mm a').format(dt);
  }


  IconData _callTypeIcon(CallType? type) {
    switch (type) {
      case CallType.incoming:
        return Icons.call_received;
      case CallType.outgoing:
        return Icons.call_made;
      case CallType.missed:
        return Icons.call_missed;
      case CallType.rejected:
        return Icons.call_end;
      default:
        return Icons.phone;
    }
  }

  @override
  Widget build(BuildContext context) {
    final logs = _filteredLogs;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Fixed Top Section: Only the Tab Filters
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: _buildTabRow(),
        ),

        // Scrollable Section: Search bar + Call Logs
        Expanded(
          child: _isLoadingLogs
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: CircularProgressIndicator(color: Color(0xFF3D7DFE)),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                  itemCount: logs.isEmpty ? 2 : logs.length + 1, // +1 for the search bar
                  itemBuilder: (context, index) {
                    // First item is always the search and sync bar
                    if (index == 0) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 20, top: 4),
                        child: Row(
                          children: [
                            Expanded(child: _buildSearchBar()),
                            const SizedBox(width: 12),
                            _buildSyncIndicator(),
                          ],
                        ),
                      );
                    }

                    // For index > 0, we show the list content or empty state
                    if (logs.isEmpty) {
                      return _buildEmptyState();
                    }

                    return _buildCallCard(logs[index - 1]);
                  },  
                ),
        ),
      ],
    );
  }

  Widget _buildTabRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(_tabs.length, (i) {
          final isSelected = _selectedTab == i;
          final tab = _tabs[i];
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOutCubic,
                padding: EdgeInsets.symmetric(
                  horizontal: isSelected ? 16 : 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.black : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.15),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          )
                        ]
                      : [],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      tab.icon,
                      size: 19,
                      color: isSelected ? Colors.white : Colors.black54,
                    ),
                    ClipRect(
                      child: AnimatedSize(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                        child: !isSelected
                            ? const SizedBox.shrink()
                            : Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const SizedBox(width: 8),
                                  AnimatedOpacity(
                                    duration: const Duration(milliseconds: 200),
                                    opacity: isSelected ? 1.0 : 0.0,
                                    child: Text(
                                      tab.label,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        fontFamily: 'Inter',
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(14),
      ),
      child: TextField(
        controller: _searchController,
        onChanged: (v) => setState(() => _searchQuery = v),
        style: const TextStyle(fontSize: 14, fontFamily: 'Inter'),
        decoration: InputDecoration(
          hintText: 'Search…',
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13, fontFamily: 'Inter'),
          prefixIcon: Icon(Icons.search, color: Colors.grey.shade400, size: 20),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  color: Colors.grey.shade400,
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildSyncIndicator() {
    const primaryBlue = Color(0xFF3D7DFE);
    const successGreen = Color(0xFF10B981);

    return GestureDetector(
      onTap: _isSyncing ? null : _syncNewCalls,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: 75,
        height: 48,
        decoration: BoxDecoration(
          color: _isServiceRunning 
              ? successGreen.withOpacity(0.08)
              : (_isSyncing ? primaryBlue.withOpacity(0.15) : primaryBlue.withOpacity(0.08)),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: _isServiceRunning ? successGreen.withOpacity(0.2) : primaryBlue.withOpacity(0.1),
            width: 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _isServiceRunning 
              ? Icon(Icons.sync, size: 20, color: successGreen)
              : RotationTransition(
                  turns: _syncRotateController,
                  child: Icon(Icons.sync, size: 20, color: primaryBlue),
                ),
            const SizedBox(height: 2),
            Text(
              _isServiceRunning 
                ? 'Auto-Sync' 
                : (_isSyncing 
                    ? 'Syncing' 
                    : (_lastSyncTime != null 
                        ? DateFormat('h:mm a').format(_lastSyncTime!) 
                        : 'Manual')),
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: _isServiceRunning ? successGreen : primaryBlue,
                fontFamily: 'Inter',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCallCard(CallLogEntry entry) {
    final String name = entry.name ?? 'Unknown';
    final String number = entry.number ?? '';
    final effectiveType = _getEffectiveCallType(entry);
    final typeIcon = _callTypeIcon(effectiveType);
    final time = _formatTime(entry.timestamp);
    
    final String duration;
    if (effectiveType == CallType.missed) {
      duration = 'Missed';
    } else if (effectiveType == CallType.rejected) {
      duration = 'Rejected';
    } else {
      duration = _formatDuration(entry.duration);
    }

    final cardKey = '${entry.number}_${entry.timestamp}';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF3D7DFE),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () {
              if (!_showFloatingActions) {
                setState(() {
                  _expandedCardKey = (_expandedCardKey == cardKey) ? null : cardKey;
                });
              }
            },
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.only(top: 16,left: 20, right: 20,bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Row: Profile Icon, Name, Status Icon, Time
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.9),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.person_outline,
                          color: Color(0xFF3D7DFE),
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontFamily: 'Inter',
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          typeIcon,
                          color: Colors.white,
                          size: 14,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        time,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withOpacity(0.8),
                          fontFamily: 'Inter',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 9),
                  // Bottom Row: Phone and Duration
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        number,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white.withOpacity(0.9),
                          fontWeight: FontWeight.w500,
                          fontFamily: 'Inter',
                        ),
                      ),
                      Text(
                        duration,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withOpacity(0.7),
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Inter',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Black bottom bar for actions (Floating Look)
          AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: (_showFloatingActions || _expandedCardKey == cardKey)
                ? Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildActionBtn(
                  icon: Icons.call_rounded,
                  // label: 'Call',
                  color: Colors.white,
                  onTap: () async {
                    final uri = Uri(scheme: 'tel', path: number);
                    if (await canLaunchUrl(uri)) await launchUrl(uri);
                  },
                ),
                _buildActionBtn(
                  icon: FontAwesomeIcons.whatsapp,
                  // label: 'WhatsApp',
                  color: const Color(0xFF25D366),
                  onTap: () async {
                    final cleaned = number.replaceAll(RegExp(r'[^\d]'), '');
                    final contactName = entry.name?.isNotEmpty == true ? entry.name! : number;
                    final message = _whatsappTemplate.replaceAll('{name}', contactName);
                    final uri = Uri.parse('https://wa.me/$cleaned?text=${Uri.encodeComponent(message)}');
                    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
                  },
                ),
                _buildActionBtn(
                  icon: Icons.chat_bubble_outline_rounded,
                  // label: 'SMS',
                  color: const Color.fromARGB(255, 227, 229, 255),
                  onTap: () async {
                    final cleaned = number.replaceAll(RegExp(r'[^\d]'), '');
                    final contactName = entry.name?.isNotEmpty == true ? entry.name! : number;
                    final message = _smsTemplate.replaceAll('{name}', contactName);
                    final uri = Uri.parse('sms:$cleaned;body=${Uri.encodeComponent(message)}');
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri);
                    } else {
                      // Fallback to ? syntax
                      final uriFallback = Uri.parse('sms:$cleaned?body=${Uri.encodeComponent(message)}');
                      if (await canLaunchUrl(uriFallback)) await launchUrl(uriFallback);
                    }
                  },
                ),
                _buildActionBtn(
                  icon: Icons.copy_rounded,
                  // label: 'Copy',
                  color: Colors.grey.shade400,
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: number));
                    UIUtils.showPremiumSnackBar(context, 'Number copied!');
                  },
                ),
                _buildActionBtn(
                  icon: Icons.bookmark_border_rounded,
                  // label: 'Save',
                  color: Colors.amber.shade400,
                  onTap: () => _showBookmarkDialog(entry),
                ),
              ],
            ),
          ) : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBtn({
    required dynamic icon,
    // required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          (icon is IconData ? Icon(icon as IconData, color: color, size: 20) : FaIcon(icon, color: color, size: 20)),
          // const SizedBox(height: 6),
          // Text(
          //   label,
          //   style: const TextStyle(
          //     color: Colors.white70,
          //     fontSize: 10,
          //     fontWeight: FontWeight.w500,
          //     fontFamily: 'Inter',
          //   ),
          // ),
        ],
      ),
    );
  }

  Future<void> _showBookmarkDialog(dynamic entry) async {
    const primaryBlue = Color(0xFF3D7DFE);
    final name = (entry.name?.isNotEmpty == true) ? entry.name! : 'Unknown';
    final number = entry.number ?? '';
    final ts = entry.timestamp;
    final descCtrl = TextEditingController();
    bool saving = false;
    String errorMsg = '';
    DateTime? selectedReminderDate;

    // Checkbox states
    bool brochuresSent = false;
    bool techMeet = false;
    bool meetingRemarks = false;
    bool quotationSent = false;
    bool proposalSent = false;
    bool whatsappGrp = false;

    await UIUtils.showSmoothDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20),
          child: SafeArea(
            child: Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      decoration: BoxDecoration(
                        color: primaryBlue.withOpacity(0.05),
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                      ),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: primaryBlue.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.history_edu_rounded, color: primaryBlue, size: 28),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Save Follow Up',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF1F2937)),
                          ),
                        ],
                      ),
                    ),

                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Contact Info
                          Text(
                            'CONTACT: $name ($number)',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade400, letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 16),

                          // Checkbox Grid
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              _buildCheckboxItem('Brochures', brochuresSent, (val) => setDialogState(() => brochuresSent = val!)),
                              _buildCheckboxItem('Tech Meet', techMeet, (val) => setDialogState(() => techMeet = val!)),
                              _buildCheckboxItem('Meeting Done', meetingRemarks, (val) => setDialogState(() => meetingRemarks = val!)),
                              _buildCheckboxItem('Quotation', quotationSent, (val) => setDialogState(() => quotationSent = val!)),
                              _buildCheckboxItem('Proposal', proposalSent, (val) => setDialogState(() => proposalSent = val!)),
                              _buildCheckboxItem('WA Group', whatsappGrp, (val) => setDialogState(() => whatsappGrp = val!)),
                            ],
                          ),
                          
                          const SizedBox(height: 24),

                          // Remark Input
                          const Text(
                            'CLIENT REQUIREMENT / NOTE',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF6B7280)),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF9FAFB),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE5E7EB)),
                            ),
                            child: TextField(
                              controller: descCtrl,
                              maxLines: 3,
                              style: const TextStyle(fontSize: 14),
                              decoration: const InputDecoration(
                                hintText: 'Type requirement or details here...',
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.all(16),
                              ),
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Reminder Date
                          InkWell(
                            onTap: () async {
                              final now = DateTime.now();
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: selectedReminderDate ?? now.add(const Duration(days: 1)),
                                firstDate: now,
                                lastDate: now.add(const Duration(days: 365)),
                              );
                              if (picked != null) setDialogState(() => selectedReminderDate = picked);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              decoration: BoxDecoration(
                                color: selectedReminderDate != null ? primaryBlue.withOpacity(0.05) : Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: selectedReminderDate != null ? primaryBlue : const Color(0xFFE5E7EB)),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.calendar_today_rounded, size: 18, color: selectedReminderDate != null ? primaryBlue : Colors.grey),
                                  const SizedBox(width: 12),
                                  Text(
                                    selectedReminderDate == null 
                                      ? 'Set Follow-up Date' 
                                      : 'Remind on: ${DateFormat('MMM dd, yyyy').format(selectedReminderDate!)}',
                                    style: TextStyle(
                                      fontSize: 14, 
                                      color: selectedReminderDate == null ? Colors.grey.shade600 : primaryBlue,
                                      fontWeight: selectedReminderDate == null ? FontWeight.normal : FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          if (errorMsg.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text(errorMsg, style: const TextStyle(color: Colors.red, fontSize: 12)),
                          ],

                          const SizedBox(height: 32),

                          // Buttons
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: saving ? null : () => Navigator.pop(ctx),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                  child: const Text('Cancel', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: saving ? null : () async {
                                    setDialogState(() { saving = true; errorMsg = ''; });
                                    final res = await ApiService.addBookmark(
                                      companyCode: _companyCode,
                                      employeePhone: _mobileNumber,
                                      contactNumber: number,
                                      contactName: name,
                                      description: descCtrl.text.trim(),
                                      callTimestamp: ts is int ? ts : 0,
                                      reminderDate: selectedReminderDate?.toIso8601String(),
                                      brochuresSent: brochuresSent,
                                      techMeet: techMeet,
                                      meetingRemarks: meetingRemarks,
                                      quotationSent: quotationSent,
                                      proposalSent: proposalSent,
                                      whatsappGrp: whatsappGrp,
                                    );
                                    if (res['success'] == true) {
                                      if (ctx.mounted) Navigator.pop(ctx);
                                      if (mounted) UIUtils.showPremiumSnackBar(context, '✅ Follow-up saved!');
                                    } else {
                                      setDialogState(() { saving = false; errorMsg = res['message'] ?? 'Failed to save.'; });
                                    }
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: primaryBlue,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    elevation: 0,
                                  ),
                                  child: saving
                                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : const Text('Save Details', style: TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCheckboxItem(String label, bool value, Function(bool?) onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
      decoration: BoxDecoration(
        color: value ? const Color(0xFF3D7DFE).withOpacity(0.05) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: value ? const Color(0xFF3D7DFE).withOpacity(0.2) : Colors.grey.shade100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Transform.scale(
            scale: 0.8,
            child: Checkbox(
              value: value, 
              onChanged: onChanged,
              activeColor: const Color(0xFF3D7DFE),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            ),
          ),
          Text(
            label, 
            style: TextStyle(
              fontSize: 12, 
              fontWeight: value ? FontWeight.bold : FontWeight.normal,
              color: value ? const Color(0xFF3D7DFE) : Colors.grey.shade700,
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            Icon(Icons.phone_missed_outlined, size: 56, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            Text(
              'No calls found',
              style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey.shade400,
                  fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }
}

class _TabItem {
  final String label;
  final dynamic icon;
  const _TabItem({required this.label, required this.icon});
}
