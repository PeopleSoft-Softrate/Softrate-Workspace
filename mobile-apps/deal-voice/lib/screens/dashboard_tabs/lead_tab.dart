import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../utils/ui_utils.dart';
import 'package:intl/intl.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

class LeadTab extends StatefulWidget {
  const LeadTab({super.key});

  @override
  State<LeadTab> createState() => _LeadTabState();
}

class _LeadTabState extends State<LeadTab> {
  List<dynamic> _leads = [];
  bool _isLoading = true;
  String? _error;
  String _companyCode = '';
  String _phone = '';

  // To group leads by company
  Map<String, List<dynamic>> _groupedLeads = {};
  List<String> _companyNames = [];
  String _searchQuery = '';

  // Set Label Filtering
  List<String> _leadSets = [];
  String _selectedSetLabel = '';
  String _selectedStatus = 'All';

  final List<String> _allStatuses = [
    'All',
    'New',
    'Contacted',
    'Interested',
    'Not Connected',
    'Converted',
    'Follow Up',
    'Rejected',
    'Wrong Number'
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();
    _companyCode = prefs.getString('companyCode') ?? '';
    _phone = prefs.getString('mobileNumber') ?? '';
    await _fetchLeads();
  }

  Future<void> _fetchLeads() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final res = await ApiService.getLeads(
        companyCode: _companyCode, 
        phone: _phone, 
        setLabel: _selectedSetLabel,
      );
      if (res['success']) {
        final leads = res['leads'] as List<dynamic>;
        _leads = leads;
        _groupLeads(leads);

        // Update available sets when we are fetching all
        if (res['sets'] != null) {
          _leadSets = (res['sets'] as List<dynamic>).map((e) => e.toString()).toList();
        }
      } else {
        _error = res['message'];
      }
    } catch (e) {
      _error = 'Failed to load leads. Please try again.';
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _selectSet(String setLabel) {
    setState(() {
      _selectedSetLabel = setLabel;
    });
    _fetchLeads();
  }

  void _showAllSetsSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return _AllSetsSheet(
          sets: _leadSets,
          selectedSet: _selectedSetLabel,
          onSelect: (val) {
            Navigator.pop(context);
            _selectSet(val);
          },
        );
      },
    );
  }

  Future<void> _markAsContacted(dynamic lead) async {
    // If it's already contacted or converted, ignore
    final currentStatus = lead['status'] ?? 'New';
    if (currentStatus != 'New') return;

    final leadId = lead['_id'];
    if (leadId == null) return;

    // Optimistically update UI
    setState(() {
      lead['status'] = 'Contacted';
    });

    try {
      await ApiService.updateLeadStatus(leadId, 'Contacted');
    } catch (e) {
      // Revert if failed (ignoring for simplicity or log error)
    }
  }

  Future<void> _showBookmarkDialog(dynamic lead) async {
    const primaryBlue = Color(0xFF3D7DFE);
    final name = (lead['contactName']?.isNotEmpty == true) ? lead['contactName'].toString() : 'Unknown';
    final number = lead['contactNumber']?.toString() ?? '';
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
          child: Container(
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
                            _buildCheckboxItem(
                              'Brochures', 
                              brochuresSent, 
                              (val) => setDialogState(() => brochuresSent = val!),
                            ),
                            _buildCheckboxItem(
                              'Tech Meet', 
                              techMeet, 
                              (val) => setDialogState(() => techMeet = val!),
                            ),
                            _buildCheckboxItem(
                              'Meeting Remarks', 
                              meetingRemarks, 
                              (val) => setDialogState(() => meetingRemarks = val!),
                            ),
                            _buildCheckboxItem(
                              'Quotation', 
                              quotationSent, 
                              (val) => setDialogState(() => quotationSent = val!),
                            ),
                            _buildCheckboxItem(
                              'Proposal', 
                              proposalSent, 
                              (val) => setDialogState(() => proposalSent = val!),
                            ),
                            _buildCheckboxItem(
                              'WhatsApp Grp', 
                              whatsappGrp, 
                              (val) => setDialogState(() => whatsappGrp = val!),
                            ),
                          ],
                        ),
                        
                        const SizedBox(height: 24),

                        // Remark Input
                        const Text(
                          'REMARK / NOTE',
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
                              hintText: 'Type follow-up details here...',
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
                                    employeePhone: _phone,
                                    contactNumber: number,
                                    contactName: name,
                                    description: descCtrl.text.trim(),
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

  void _groupLeads(List<dynamic> leads) {
    // 0. Filter by selected status locally
    final filteredByStatus = leads.where((l) {
      if (_selectedStatus == 'All') return true;
      return (l['status'] ?? 'New') == _selectedStatus;
    }).toList();

    final Map<String, List<dynamic>> grouped = {};
    final List<String> order = [];

    // 1. Group and keep first-appearance order
    for (var lead in filteredByStatus) {
      final comp = lead['leadCompanyName'] ?? 'Unknown Company';
      if (!grouped.containsKey(comp)) {
        grouped[comp] = [];
        order.add(comp);
      }
      grouped[comp]!.add(lead);
    }

    // 2. Separate into Active and Completed
    final List<String> active = [];
    final List<String> completed = [];

    for (var comp in order) {
      final list = grouped[comp]!;
      // Company is completed if every lead in it is not "New"
      final isAllContacted = list.every((l) => (l['status'] ?? 'New') != 'New');
      if (isAllContacted) {
        completed.add(comp);
      } else {
        active.add(comp);
      }
    }

    _groupedLeads = grouped;
    _companyNames = [...active, ...completed];
  }

  List<String> get _filteredCompanies {
    if (_searchQuery.isEmpty) return _companyNames;
    return _companyNames.where((c) => c.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Colors.black));
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchLeads,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        _buildSearchBar(),
        _buildStatusFilter(),
        _buildSetFilter(),
        Expanded(
          child: _leads.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _fetchLeads,
                  color: Colors.black,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    itemCount: _filteredCompanies.length,
                    itemBuilder: (context, index) {
                      final company = _filteredCompanies[index];
                      final leads = _groupedLeads[company]!;
                      return _buildCompanyCard(company, leads);
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      color: Colors.white,
      child: TextField(
        onChanged: (val) => setState(() => _searchQuery = val),
        decoration: InputDecoration(
          hintText: 'Search companies...',
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
          prefixIcon: Icon(Icons.search, color: Colors.grey.shade400, size: 20),
          fillColor: Colors.grey.shade100,
          filled: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(15),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 0),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF3D7DFE) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.black87,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildStatusFilter() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.only(bottom: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: _allStatuses.map((status) => Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _buildFilterChip(
              status, 
              status, 
              _selectedStatus == status, 
              () {
                setState(() {
                  _selectedStatus = status;
                  _groupLeads(_leads);
                });
              }
            ),
          )).toList(),
        ),
      ),
    );
  }

  Widget _buildSetFilter() {
    if (_leadSets.isEmpty) return const SizedBox.shrink();
    
    final int maxToShow = 3;
    final bool showMore = _leadSets.length > maxToShow;
    final itemsToShow = showMore ? _leadSets.take(maxToShow).toList() : _leadSets;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.only(bottom: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            _buildFilterChip('All Sets', '', _selectedSetLabel == '', () => _selectSet('')),
            const SizedBox(width: 8),
            ...itemsToShow.map((set) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _buildFilterChip(set, set, _selectedSetLabel == set, () => _selectSet(set)),
            )).toList(),
            if (showMore)
              GestureDetector(
                onTap: _showAllSetsSheet,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'Show all',
                    style: TextStyle(
                      color: Colors.black87,
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                    ),
                  ),
                ),
              )
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.assignment_ind_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text(
            'No leads assigned to you yet.',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Check back later or contact your admin.',
            style: TextStyle(color: Colors.black38),
          ),
        ],
      ),
    );
  }

  Widget _buildCompanyCard(String company, List<dynamic> leads) {
    final bool isCompleted = leads.every((l) => (l['status'] ?? 'New') != 'New');

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isCompleted ? Colors.grey.shade50 : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: isCompleted ? Colors.green.withOpacity(0.1) : Colors.grey.shade100),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(20))),
          collapsedShape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(20))),
          title: Row(
            children: [
              Expanded(
                child: Text(
                  company,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isCompleted ? Colors.grey.shade600 : Colors.black,
                    decoration: isCompleted ? TextDecoration.lineThrough : null,
                  ),
                ),
              ),
              if (isCompleted)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Text(
                    'COMPLETED',
                    style: TextStyle(
                      color: Colors.green.shade700,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
            ],
          ),
          subtitle: Text(
            '${leads.length} ${leads.length == 1 ? 'contact' : 'contacts'}',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
          ),
          leading: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isCompleted ? Colors.green.withOpacity(0.08) : const Color(0xFF3D7DFE).withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isCompleted ? Icons.check_circle_outline_rounded : Icons.business_rounded, 
              color: isCompleted ? Colors.green : const Color(0xFF3D7DFE), 
              size: 24
            ),
          ),
          children: leads.map((lead) => _buildLeadTile(lead)).toList(),
        ),
      ),
    );
  }

  Widget _buildLeadTile(dynamic lead) {
    final name = lead['contactName'];
    final displayName = (name == null || name.toString().isEmpty) ? 'No Name' : name;
    final number = lead['contactNumber'] ?? '';
    final status = lead['status'] ?? 'New';
    final setLabel = lead['setLabel'] ?? '';
    
    final bool isContacted = status != 'New';

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Colors.grey.shade50)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: Colors.grey.shade100,
            radius: 20,
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black54),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        displayName,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    // Status Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isContacted ? Colors.green.shade50 : Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: isContacted ? Colors.green.shade200 : Colors.orange.shade200,
                        ),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isContacted ? Colors.green.shade700 : Colors.orange.shade700,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  number,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
                if (setLabel.toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '🏷 $setLabel',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF3D7DFE), fontWeight: FontWeight.w500),
                    ),
                  )
              ],
            ),
          ),
          _actionIcon(Icons.call_rounded, const Color(0xFF10B981), () {
            _markAsContacted(lead);
            _makeCall(number);
          }),
          const SizedBox(width: 8),
          _actionIcon(FontAwesomeIcons.whatsapp, const Color(0xFF25D366), () {
            _markAsContacted(lead);
            _openWhatsApp(number);
          }),
          const SizedBox(width: 8),
          _actionIcon(Icons.bookmark_add_rounded, const Color(0xFFF59E0B), () {
            _showBookmarkDialog(lead);
          }),
        ],
      ),
    );
  }

  Widget _actionIcon(IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: color, size: 20),
      ),
    );
  }

  Future<void> _makeCall(String number) async {
    final Uri url = Uri(scheme: 'tel', path: number);
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  Future<void> _openWhatsApp(String number) async {
    final cleanNumber = number.replaceAll(RegExp(r'\D'), '');
    final Uri url = Uri.parse('https://wa.me/$cleanNumber');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }
}

class _AllSetsSheet extends StatefulWidget {
  final List<String> sets;
  final String selectedSet;
  final ValueChanged<String> onSelect;

  const _AllSetsSheet({
    required this.sets,
    required this.selectedSet,
    required this.onSelect,
  });

  @override
  State<_AllSetsSheet> createState() => _AllSetsSheetState();
}

class _AllSetsSheetState extends State<_AllSetsSheet> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final filteredSets = widget.sets.where((s) => s.toLowerCase().contains(_searchQuery.toLowerCase())).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        top: 20, 
        left: 20, 
        right: 20, 
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('All Batches / Sets', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            onChanged: (val) => setState(() => _searchQuery = val),
            decoration: InputDecoration(
              hintText: 'Search batches...',
              prefixIcon: const Icon(Icons.search, color: Colors.grey),
              filled: true,
              fillColor: Colors.grey.shade100,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(15),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: ListView.builder(
              itemCount: filteredSets.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _buildTile('All', '');
                }
                final setStr = filteredSets[index - 1];
                return _buildTile(setStr, setStr);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTile(String title, String value) {
    final isSelected = widget.selectedSet == value;
    return ListTile(
      onTap: () => widget.onSelect(value),
      title: Text(title, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
      trailing: isSelected ? const Icon(Icons.check, color: Color(0xFF3D7DFE)) : null,
    );
  }
}
