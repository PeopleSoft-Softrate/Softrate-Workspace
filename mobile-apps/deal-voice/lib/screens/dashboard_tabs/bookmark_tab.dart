import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../utils/ui_utils.dart';
import '../../services/api_service.dart';
import 'notification_tab.dart';

class BookmarkTab extends StatefulWidget {
  const BookmarkTab({super.key});
  @override
  State<BookmarkTab> createState() => _BookmarkTabState();
}

class _BookmarkTabState extends State<BookmarkTab> {
  String _companyCode = '';
  String _mobileNumber = '';
  String _whatsappTemplate = 'Hi {name}!';
  String _smsTemplate = 'Hi {name}!';
  List<Map<String, dynamic>> _bookmarks = [];
  bool _loading = true;
  String _error = '';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadAndFetch();
  }

  Future<void> _loadAndFetch() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _companyCode = prefs.getString('companyCode') ?? '';
      _mobileNumber = prefs.getString('mobileNumber') ?? '';
      _whatsappTemplate = prefs.getString('whatsappTemplate') ?? 'Hi {name}!';
      _smsTemplate = prefs.getString('smsTemplate') ?? 'Hi {name}!';
    });
    await _fetchBookmarks();
  }

  Future<void> _fetchBookmarks() async {
    if (_companyCode.isEmpty || _mobileNumber.isEmpty) {
      setState(() { _loading = false; _error = 'Not logged in. (code: "$_companyCode", phone: "$_mobileNumber")'; });
      return;
    }
    setState(() { _loading = true; _error = ''; });
    final res = await ApiService.getBookmarks(companyCode: _companyCode, phone: _mobileNumber);
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _bookmarks = List<Map<String, dynamic>>.from(res['bookmarks'] ?? []);
        _loading = false;
      });
    } else {
      setState(() { _loading = false; _error = res['message'] ?? 'Failed to load bookmarks.'; });
    }
  }

  Future<void> _deleteBookmark(String id) async {
    final confirm = await UIUtils.showSmoothDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.15),
                blurRadius: 30,
                offset: const Offset(0, 15),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header Section
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 30),
                decoration: BoxDecoration(
                  color: Colors.red.shade50.withOpacity(0.5),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                ),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.delete_sweep_rounded, color: Colors.red.shade700, size: 36),
                  ),
                ),
              ),
              
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
                child: Column(
                  children: [
                    const Text(
                      'Remove Bookmark?',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF111827),
                        fontFamily: 'Inter',
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Are you sure you want to remove this bookmark? This action cannot be undone.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade500,
                        fontFamily: 'Inter',
                        height: 1.5,
                      ),
                    ),
                    
                    const SizedBox(height: 32),
                    
                    Row(
                      children: [
                        Expanded(
                          child: TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            child: Text(
                              'Keep it',
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Inter',
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red.shade600,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            child: const Text(
                              'Remove',
                              style: TextStyle(fontWeight: FontWeight.bold, fontFamily: 'Inter'),
                            ),
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
    );

    if (confirm == true) {
      await ApiService.deleteBookmark(id);
      if (mounted) {
        UIUtils.showPremiumSnackBar(context, '🗑️ Bookmark removed', isError: true);
        _fetchBookmarks();
      }
    }
  }

  String _formatTime(int? ms) {
    if (ms == null || ms == 0) return '';
    return DateFormat('hh:mm a').format(DateTime.fromMillisecondsSinceEpoch(ms));
  }

  List<Map<String, dynamic>> get _filteredBookmarks {
    if (_searchQuery.isEmpty) return _bookmarks;
    final q = _searchQuery.toLowerCase();
    return _bookmarks.where((b) {
      final name = (b['contactName'] ?? '').toString().toLowerCase();
      final num  = (b['contactNumber'] ?? '').toString().toLowerCase();
      return name.contains(q) || num.contains(q);
    }).toList();
  }

  int get _todayFollowUpCount {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return _bookmarks.where((b) {
      if (b['reminderDate'] == null) return false;
      final rd = DateTime.parse(b['reminderDate']);
      return DateTime(rd.year, rd.month, rd.day).isAtSameMomentAs(today);
    }).length;
  }

  @override
  Widget build(BuildContext context) {
    const primaryBlue = Color(0xFF3D7DFE);
    return Column(
      children: [
        // Sticky Header: Search Bar + Notification Icon
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
          child: Row(
            children: [
              Expanded(child: _buildSearchBar()),
              const SizedBox(width: 12),
              _buildNotificationBtn(),
            ],
          ),
        ),

        // Scrollable Content
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: primaryBlue))
              : _error.isNotEmpty
                  ? _buildErrorView()
                  : _filteredBookmarks.isEmpty
                      ? _buildEmptyView()
                      : RefreshIndicator(
                          onRefresh: _fetchBookmarks,
                          color: primaryBlue,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(20, 10, 20, 100),
                            itemCount: _filteredBookmarks.length,
                            itemBuilder: (ctx, i) => _bookmarkCard(_filteredBookmarks[i]),
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _buildNotificationBtn() {
    final count = _todayFollowUpCount;
    return GestureDetector(
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (ctx) => const Scaffold(
            body: SafeArea(child: NotificationTab()),
          )),
        );
        _fetchBookmarks();
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Icon(Icons.notifications_none_rounded, color: Colors.black87, size: 22),
            if (count > 0)
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                ),
              ),
          ],
        ),
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
          hintText: 'Search bookmarks…',
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

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
            const SizedBox(height: 12),
            Text(_error, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600, fontFamily: 'Inter')),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _fetchBookmarks, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.bookmark_outline_rounded, size: 64, color: Colors.grey.shade200),
          const SizedBox(height: 16),
          Text(_searchQuery.isEmpty ? 'No bookmarks saved' : 'No matches found',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF111827), fontFamily: 'Inter')),
          const SizedBox(height: 6),
          Text(_searchQuery.isEmpty ? 'Tap 🔖 on any call to save it here.' : 'Try a different search term.',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade500, fontFamily: 'Inter')),
        ],
      ),
    );
  }

  Widget _bookmarkCard(Map<String, dynamic> b) {
    const primaryBlue = Color(0xFF3D7DFE);
    final name = (b['contactName'] ?? '').toString().isNotEmpty ? b['contactName'] as String : 'Unknown';
    final number = b['contactNumber'] as String? ?? '';
    final remarks = List<String>.from(b['remarks'] ?? []);
    final ts = (b['callTimestamp'] as num?)?.toInt() ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: primaryBlue,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.history_edu_rounded, color: primaryBlue, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
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
                          if (b['reminderDate'] != null)
                            Text(
                              'Remind: ${DateFormat('MMM dd').format(DateTime.parse(b['reminderDate']))}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.white.withOpacity(0.9),
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Inter',
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (ts != 0)
                      Text(
                        _formatTime(ts),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withOpacity(0.8),
                          fontFamily: 'Inter',
                        ),
                      ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => _deleteBookmark(b['_id'] as String),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 12),
                // Phone Number (now below name and date)
                Text(
                  number,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white.withOpacity(0.9),
                    fontWeight: FontWeight.w500,
                    fontFamily: 'Inter',
                  ),
                ),
                
                // Client Requirement (Description)
                if ((b['description'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('CLIENT REQUIREMENT', style: TextStyle(color: Colors.white54, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                  const SizedBox(height: 4),
                  Text(
                    b['description'],
                    style: const TextStyle(fontSize: 14, color: Colors.white, fontWeight: FontWeight.bold, height: 1.4, fontFamily: 'Inter'),
                  ),
                ],

                // Remarks Timeline
                if (remarks.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('HISTORY / REMARKS', style: TextStyle(color: Colors.white54, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                        const SizedBox(height: 8),
                        ...remarks.map((r) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('• ', style: TextStyle(color: Colors.white70, fontSize: 14)),
                              Expanded(child: Text(r, style: const TextStyle(fontSize: 12, color: Colors.white, height: 1.4))),
                            ],
                          ),
                        )),
                      ],
                    ),
                  ),
                ],

                // Status Badges at the bottom
                const SizedBox(height: 16),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (b['brochuresSent'] == true) _statusBadge('Brochures'),
                    if (b['techMeet'] == true) _statusBadge('Tech Meet'),
                    if (b['meetingRemarks'] == true) _statusBadge('Meeting Done'),
                    if (b['quotationSent'] == true) _statusBadge('Quotation'),
                    if (b['proposalSent'] == true) _statusBadge('Proposal'),
                    if (b['whatsappGrp'] == true) _statusBadge('WA Group'),
                  ],
                ),
              ],
            ),
          ),

          // Action bar
          Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _actionBtn(
                  icon: Icons.call_rounded,
                  color: Colors.white,
                  onTap: () async {
                    final uri = Uri(scheme: 'tel', path: number);
                    if (await canLaunchUrl(uri)) launchUrl(uri);
                  },
                ),
                _actionBtn(
                  icon: FontAwesomeIcons.whatsapp,
                  color: const Color(0xFF25D366),
                  onTap: () async {
                    final cleaned = number.replaceAll(RegExp(r'[^\d]'), '');
                    final message = _whatsappTemplate.replaceAll('{name}', name);
                    final uri = Uri.parse('https://wa.me/$cleaned?text=${Uri.encodeComponent(message)}');
                    if (await canLaunchUrl(uri)) launchUrl(uri, mode: LaunchMode.externalApplication);
                  },
                ),
                _actionBtn(
                  icon: Icons.edit_note_rounded,
                  color: Colors.amber.shade400,
                  onTap: () => _showEditDialog(b),
                ),
                _actionBtn(
                  icon: Icons.copy_rounded,
                  color: Colors.grey.shade400,
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: number));
                    UIUtils.showPremiumSnackBar(context, 'Number copied');
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white.withOpacity(0.3)),
      ),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
    );
  }

  Future<void> _showEditDialog(Map<String, dynamic> b) async {
    const primaryBlue = Color(0xFF3D7DFE);
    final descCtrl = TextEditingController(text: b['description'] ?? '');
    final newRemarkCtrl = TextEditingController();
    
    // List of controllers for existing remarks
    final List<String> oldRemarks = List<String>.from(b['remarks'] ?? []);
    final List<TextEditingController> remarkCtrls = oldRemarks.map((r) => TextEditingController(text: r)).toList();

    DateTime? selectedDate = b['reminderDate'] != null ? DateTime.parse(b['reminderDate']) : null;
    bool saving = false;

    // Checkbox states
    bool brochuresSent = b['brochuresSent'] == true;
    bool techMeet = b['techMeet'] == true;
    bool meetingRemarks = b['meetingRemarks'] == true;
    bool quotationSent = b['quotationSent'] == true;
    bool proposalSent = b['proposalSent'] == true;
    bool whatsappGrp = b['whatsappGrp'] == true;

    await UIUtils.showSmoothDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20),
          child: SafeArea(
            child: Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Update Follow Up', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Inter')),
                    const SizedBox(height: 20),

                    const Text('CLIENT REQUIREMENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: descCtrl,
                      maxLines: 2,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                      decoration: InputDecoration(
                        hintText: 'Initial requirement...',
                        filled: true,
                        fillColor: const Color(0xFFF3F4F6),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      ),
                    ),

                    const SizedBox(height: 20),
                    
                    // Checkboxes
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _buildEditCheckbox('Brochures', brochuresSent, (v) => setDialogState(() => brochuresSent = v!)),
                        _buildEditCheckbox('Tech Meet', techMeet, (v) => setDialogState(() => techMeet = v!)),
                        _buildEditCheckbox('Meeting Done', meetingRemarks, (v) => setDialogState(() => meetingRemarks = v!)),
                        _buildEditCheckbox('Quotation', quotationSent, (v) => setDialogState(() => quotationSent = v!)),
                        _buildEditCheckbox('Proposal', proposalSent, (v) => setDialogState(() => proposalSent = v!)),
                        _buildEditCheckbox('WA Group', whatsappGrp, (v) => setDialogState(() => whatsappGrp = v!)),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Existing Remarks Timeline (Editable)
                    if (remarkCtrls.isNotEmpty) ...[
                      const Text('EDIT HISTORY REMARKS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                      const SizedBox(height: 8),
                      ...List.generate(remarkCtrls.length, (index) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            const Text('• ', style: TextStyle(color: Colors.grey)),
                            Expanded(
                              child: TextField(
                                controller: remarkCtrls[index],
                                style: const TextStyle(fontSize: 12),
                                decoration: InputDecoration(
                                  isDense: true,
                                  border: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey.shade300)),
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, size: 16, color: Colors.red),
                              onPressed: () => setDialogState(() => remarkCtrls.removeAt(index)),
                            ),
                          ],
                        ),
                      )),
                      const SizedBox(height: 16),
                    ],

                    const Text('ADD NEW REMARK / UPDATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: newRemarkCtrl,
                      maxLines: 2,
                      style: const TextStyle(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Add latest progress here...',
                        filled: true,
                        fillColor: const Color(0xFFF3F4F6),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text('NEXT FOLLOW UP DATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: selectedDate ?? DateTime.now().add(const Duration(days: 1)),
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (picked != null) setDialogState(() => selectedDate = picked);
                      },
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(16)),
                        child: Row(
                          children: [
                            Icon(Icons.calendar_today_rounded, size: 18, color: selectedDate != null ? primaryBlue : Colors.grey),
                            const SizedBox(width: 12),
                            Text(selectedDate == null ? 'Set Date' : DateFormat('MMM dd, yyyy').format(selectedDate!), 
                                 style: TextStyle(fontFamily: 'Inter', color: selectedDate != null ? primaryBlue : Colors.black87, fontWeight: selectedDate != null ? FontWeight.bold : FontWeight.normal)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 30),
                    Row(
                      children: [
                        Expanded(child: TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: Colors.grey)))),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: primaryBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), elevation: 0),
                            onPressed: saving ? null : () async {
                              setDialogState(() => saving = true);
                              
                              // Collect modified remarks
                              final List<String> updatedRemarks = remarkCtrls.map((c) => c.text.trim()).where((t) => t.isNotEmpty).toList();

                              final res = await ApiService.updateBookmark(
                                id: b['_id'],
                                description: descCtrl.text.trim(),
                                remarks: updatedRemarks,
                                newRemark: newRemarkCtrl.text.trim().isNotEmpty ? newRemarkCtrl.text.trim() : null,
                                reminderDate: selectedDate?.toIso8601String(),
                                brochuresSent: brochuresSent,
                                techMeet: techMeet,
                                meetingRemarks: meetingRemarks,
                                quotationSent: quotationSent,
                                proposalSent: proposalSent,
                                whatsappGrp: whatsappGrp,
                              );
                              if (res['success'] == true) {
                                if (ctx.mounted) Navigator.pop(ctx);
                                _fetchBookmarks();
                              }
                            },
                            child: saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Update', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
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

  Widget _buildEditCheckbox(String label, bool value, Function(bool?) onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
      decoration: BoxDecoration(
        color: value ? const Color(0xFF3D7DFE).withOpacity(0.05) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: value ? const Color(0xFF3D7DFE).withOpacity(0.2) : Colors.grey.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Transform.scale(
            scale: 0.7,
            child: Checkbox(value: value, onChanged: onChanged, activeColor: const Color(0xFF3D7DFE), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
          ),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: value ? FontWeight.bold : FontWeight.normal, color: value ? const Color(0xFF3D7DFE) : Colors.black87)),
          const SizedBox(width: 4),
        ],
      ),
    );
  }

  Widget _actionBtn({required IconData icon, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Icon(icon, size: 22, color: color),
    );
  }
}

  Widget _actionBtn({required IconData icon, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Icon(icon, size: 22, color: color),
    );
  }

