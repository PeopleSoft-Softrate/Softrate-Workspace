import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../utils/ui_utils.dart';
import '../../services/api_service.dart';

class NotificationTab extends StatefulWidget {
  final bool isPopable;
  const NotificationTab({super.key, this.isPopable = false});
  @override
  State<NotificationTab> createState() => _NotificationTabState();
}

class _NotificationTabState extends State<NotificationTab> {
  String _companyCode = '';
  String _mobileNumber = '';
  String _whatsappTemplate = 'Hi {name}!';
  String _smsTemplate = 'Hi {name}!';
  List<Map<String, dynamic>> _allBookmarks = [];
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
    await _fetchFollowUps();
  }

  Future<void> _fetchFollowUps() async {
    if (_companyCode.isEmpty || _mobileNumber.isEmpty) {
      setState(() { _loading = false; _error = 'Not logged in.'; });
      return;
    }
    setState(() { _loading = true; _error = ''; });
    final res = await ApiService.getBookmarks(companyCode: _companyCode, phone: _mobileNumber);
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _allBookmarks = List<Map<String, dynamic>>.from(res['bookmarks'] ?? []);
        _loading = false;
      });
    } else {
      setState(() { _loading = false; _error = res['message'] ?? 'Failed to load follow-ups.'; });
    }
  }

  Future<void> _deleteBookmark(String id) async {
    final confirm = await UIUtils.showSmoothDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Remove Follow-up?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, fontFamily: 'Inter')),
              const SizedBox(height: 12),
              const Text('This will remove the reminder.', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Inter')),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(child: TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep'))),
                  const SizedBox(width: 12),
                  Expanded(child: ElevatedButton(onPressed: () => Navigator.pop(ctx, true), style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white), child: const Text('Remove'))),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm == true) {
      await ApiService.deleteBookmark(id);
      if (mounted) {
        UIUtils.showPremiumSnackBar(context, '🗑️ Follow-up removed', isError: true);
        _fetchFollowUps();
      }
    }
  }

  Future<void> _showEditDialog(Map<String, dynamic> b) async {
    const primaryBlue = Color(0xFF3D7DFE);
    final descCtrl = TextEditingController(text: b['description'] ?? '');
    DateTime? selectedDate = b['reminderDate'] != null ? DateTime.parse(b['reminderDate']) : null;
    bool saving = false;

    await UIUtils.showSmoothDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Dialog(
          backgroundColor: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Edit Follow-up', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, fontFamily: 'Inter')),
                const SizedBox(height: 20),
                TextField(
                  controller: descCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'Description',
                    filled: true,
                    fillColor: const Color(0xFFF3F4F6),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 20),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: selectedDate ?? DateTime.now(),
                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setDialogState(() => selectedDate = picked);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        Icon(Icons.notifications_active_outlined, size: 20, color: selectedDate != null ? primaryBlue : Colors.grey),
                        const SizedBox(width: 12),
                        Text(selectedDate == null ? 'Set Reminder' : DateFormat('MMM dd, yyyy').format(selectedDate!), style: const TextStyle(fontFamily: 'Inter')),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                Row(
                  children: [
                    Expanded(child: TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: primaryBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                        onPressed: saving ? null : () async {
                          setDialogState(() => saving = true);
                          final res = await ApiService.updateBookmark(
                            id: b['_id'],
                            description: descCtrl.text.trim(),
                            reminderDate: selectedDate?.toIso8601String(),
                          );
                          if (res['success'] == true) {
                            if (ctx.mounted) Navigator.pop(ctx);
                            _fetchFollowUps();
                          }
                        },
                        child: saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Save'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Map<String, dynamic>> get _followUps {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    List<Map<String, dynamic>> list = _allBookmarks.where((b) {
      if (b['reminderDate'] == null) return false;
      final rDate = DateTime.parse(b['reminderDate']);
      final rDay = DateTime(rDate.year, rDate.month, rDate.day);
      return rDay.isAtSameMomentAs(today);
    }).toList();
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      list = list.where((b) {
        final name = (b['contactName'] ?? '').toString().toLowerCase();
        final num  = (b['contactNumber'] ?? '').toString().toLowerCase();
        return name.contains(q) || num.contains(q);
      }).toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    const primaryBlue = Color(0xFF3D7DFE);
    final followUps = _followUps;

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
            child: Row(
              children: [
                if (Navigator.canPop(context))
                  IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => Navigator.pop(context)),
                Expanded(child: const Text('Today\'s Follow-ups', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, fontFamily: 'Inter'))),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: _buildSearchBar(),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: primaryBlue))
                : _error.isNotEmpty
                    ? Center(child: Text(_error))
                    : followUps.isEmpty
                        ? _buildEmptyView()
                        : RefreshIndicator(
                        onRefresh: _fetchFollowUps,
                        color: primaryBlue,
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(20, 10, 20, 100),
                          itemCount: followUps.length,
                          itemBuilder: (ctx, i) => _followUpCard(followUps[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(14)),
      child: TextField(
        controller: _searchController,
        onChanged: (v) => setState(() => _searchQuery = v),
        style: const TextStyle(fontSize: 14, fontFamily: 'Inter'),
        decoration: InputDecoration(
          hintText: 'Search follow-ups…',
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13, fontFamily: 'Inter'),
          prefixIcon: Icon(Icons.search, color: Colors.grey.shade400, size: 20),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.notifications_none_rounded, size: 64, color: Colors.grey.shade200),
          const SizedBox(height: 16),
          Text(_searchQuery.isEmpty ? "No follow-ups for today" : 'No matches found', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF111827), fontFamily: 'Inter')),
        ],
      ),
    );
  }

  Widget _followUpCard(Map<String, dynamic> b) {
    const primaryBlue = Color(0xFF3D7DFE);
    final name = (b['contactName'] ?? '').toString().isNotEmpty ? b['contactName'] as String : 'Unknown';
    final number = b['contactNumber'] as String? ?? '';
    final desc = b['description'] as String? ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(color: primaryBlue, borderRadius: BorderRadius.circular(24)),
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
                      width: 40, height: 40,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: const Icon(Icons.notifications_active_rounded, color: primaryBlue, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'Inter'), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    GestureDetector(onTap: () => _deleteBookmark(b['_id']), child: Icon(Icons.close, size: 18, color: Colors.white.withOpacity(0.7))),
                  ],
                ),
                if (desc.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                    child: Text(desc, style: const TextStyle(fontSize: 13, color: Colors.white, height: 1.4, fontFamily: 'Inter')),
                  ),
                ],
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
            decoration: BoxDecoration(color: const Color(0xFF1E1E1E), borderRadius: BorderRadius.circular(20)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _actionBtn(icon: Icons.call_rounded, color: Colors.white, onTap: () async {
                  final uri = Uri(scheme: 'tel', path: number);
                  if (await canLaunchUrl(uri)) launchUrl(uri);
                }),
                _actionBtn(icon: FontAwesomeIcons.whatsapp, color: const Color(0xFF25D366), onTap: () async {
                  final cleaned = number.replaceAll(RegExp(r'[^\d]'), '');
                  final message = _whatsappTemplate.replaceAll('{name}', name);
                  final uri = Uri.parse('https://wa.me/$cleaned?text=${Uri.encodeComponent(message)}');
                  if (await canLaunchUrl(uri)) launchUrl(uri, mode: LaunchMode.externalApplication);
                }),
                _actionBtn(icon: Icons.chat_bubble_outline_rounded, color: const Color.fromARGB(255, 227, 229, 255), onTap: () async {
                  final cleaned = number.replaceAll(RegExp(r'[^\d]'), '');
                  final message = _smsTemplate.replaceAll('{name}', name);
                  final uri = Uri.parse('sms:$cleaned;body=${Uri.encodeComponent(message)}');
                  if (await canLaunchUrl(uri)) launchUrl(uri);
                }),
                _actionBtn(icon: Icons.copy_rounded, color: Colors.grey.shade400, onTap: () {
                  Clipboard.setData(ClipboardData(text: number));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Number copied!'), duration: Duration(seconds: 1)));
                }),
                _actionBtn(icon: Icons.edit_note_rounded, color: Colors.amber.shade400, onTap: () => _showEditDialog(b)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionBtn({required dynamic icon, required Color color, required VoidCallback onTap}) {
    return GestureDetector(onTap: onTap, child: (icon is IconData ? Icon(icon as IconData, size: 22, color: color) : FaIcon(icon, size: 22, color: color)));
  }
}
