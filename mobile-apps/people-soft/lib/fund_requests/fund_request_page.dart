import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';

class FundRequestPage extends StatefulWidget {
  final String requesterId;
  final String requesterName;
  final String requesterType;

  const FundRequestPage({
    super.key,
    required this.requesterId,
    required this.requesterName,
    required this.requesterType,
  });

  @override
  State<FundRequestPage> createState() => _FundRequestPageState();
}

class _FundRequestPageState extends State<FundRequestPage> {
  static const Color primary = Color(0xFF00657F);
  static const Color bg = Color(0xFFF1F5F9);
  static const Color muted = Color(0xFF64748B);

  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _categories = const [
    'Petrol',
    'Snacks',
    'Travel',
    'Meals',
    'Office Supplies',
    'Other',
  ];

  String _category = 'Petrol';
  DateTime _expenseDate = DateTime.now();
  bool _isSubmitting = false;
  bool _isLoadingHistory = true;
  List<dynamic> _history = [];

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    final amount = double.tryParse(_amountController.text.trim());
    return amount != null &&
        amount > 0 &&
        _descriptionController.text.trim().isNotEmpty &&
        !_isSubmitting;
  }

  Future<void> _fetchHistory() async {
    setState(() => _isLoadingHistory = true);
    try {
      final response = await http.get(
        Uri.parse(
          '${getBaseUrl()}/api/fund-requests/user/${widget.requesterId}',
        ),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() => _history = data is List ? data : []);
        }
      }
    } catch (e) {
      debugPrint('Fund history error: $e');
    } finally {
      if (mounted) setState(() => _isLoadingHistory = false);
    }
  }

  Future<void> _pickExpenseDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _expenseDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
      builder:
          (context, child) => Theme(
            data: Theme.of(
              context,
            ).copyWith(colorScheme: const ColorScheme.light(primary: primary)),
            child: child!,
          ),
    );

    if (picked != null) {
      setState(() => _expenseDate = picked);
    }
  }

  Future<void> _submitRequest() async {
    if (!_canSubmit) return;

    setState(() => _isSubmitting = true);
    try {
      final response = await http.post(
        Uri.parse('${getBaseUrl()}/api/fund-requests/apply'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'requesterType': widget.requesterType,
          'requesterId': widget.requesterId,
          'requesterName': widget.requesterName,
          'category': _category,
          'amount': double.parse(_amountController.text.trim()),
          'expenseDate': DateFormat('yyyy-MM-dd').format(_expenseDate),
          'description': _descriptionController.text.trim(),
        }),
      );

      final body = response.body.isNotEmpty ? jsonDecode(response.body) : {};
      final success = response.statusCode == 200 || response.statusCode == 201;
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            body['message'] ??
                (success
                    ? 'Fund request submitted'
                    : 'Unable to submit request'),
          ),
          backgroundColor:
              success ? Colors.green.shade700 : Colors.red.shade700,
        ),
      );

      if (success) {
        _amountController.clear();
        _descriptionController.clear();
        setState(() {
          _category = 'Petrol';
          _expenseDate = DateTime.now();
        });
        _fetchHistory();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Unable to submit request: $e'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
      case 'approved':
        return Colors.green.shade700;
      case 'rejected':
        return Colors.red.shade700;
      default:
        return Colors.orange.shade700;
    }
  }

  String _formatDate(dynamic value) {
    if (value == null) return '-';
    try {
      return DateFormat(
        'd MMM yyyy',
      ).format(DateTime.parse(value.toString()).toLocal());
    } catch (_) {
      return value.toString();
    }
  }

  Widget _statusChip(String label, String status) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$label: ${status.toUpperCase()}',
        style: TextStyle(
          color: color,
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _historyCard(dynamic item) {
    final amount = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    ).format(NumberFormat().parse((item['amount'] ?? 0).toString()));

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item['category'] ?? 'Fund Request',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              Text(
                amount,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _formatDate(item['expenseDate']),
            style: const TextStyle(color: muted, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Text(
            item['description'] ?? '',
            style: const TextStyle(color: Color(0xFF334155), height: 1.4),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _statusChip('Manager', item['managerStatus'] ?? 'pending'),
              _statusChip('HR', item['hrStatus'] ?? 'pending'),
              _statusChip(
                'Finance',
                item['isFinanceTeamApprove'] == true ? 'accepted' : 'pending',
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        title: const Text(
          'Fund Request',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Company expense claim',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Submit reimbursements for petrol, snacks, travel, or other company expenses.',
                  style: TextStyle(color: muted),
                ),
                const SizedBox(height: 18),
                DropdownButtonFormField<String>(
                  value: _category,
                  items:
                      _categories
                          .map(
                            (c) => DropdownMenuItem(value: c, child: Text(c)),
                          )
                          .toList(),
                  onChanged:
                      (value) => setState(() => _category = value ?? _category),
                  decoration: _inputDecoration('Category'),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(
                      RegExp(r'^\d*\.?\d{0,2}'),
                    ),
                  ],
                  decoration: _inputDecoration(
                    'Amount',
                  ).copyWith(prefixText: '₹ '),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 14),
                InkWell(
                  onTap: _pickExpenseDate,
                  borderRadius: BorderRadius.circular(14),
                  child: InputDecorator(
                    decoration: _inputDecoration('Expense date'),
                    child: Text(DateFormat('d MMM yyyy').format(_expenseDate)),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _descriptionController,
                  maxLines: 4,
                  maxLength: 300,
                  decoration: _inputDecoration('Reason / details'),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _canSubmit ? _submitRequest : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey.shade300,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      _isSubmitting ? 'Submitting...' : 'Submit to manager',
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Request history',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          ),
          const SizedBox(height: 12),
          if (_isLoadingHistory)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: primary),
              ),
            )
          else if (_history.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text(
                  'No fund requests submitted yet.',
                  style: TextStyle(color: muted),
                ),
              ),
            )
          else
            ..._history.map(_historyCard),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: primary, width: 1.6),
      ),
    );
  }
}
