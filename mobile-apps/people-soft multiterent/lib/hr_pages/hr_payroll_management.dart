import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'dart:convert';
import 'package:hrmappfrontend/auth_client.dart' as http;

class HrPayrollManagement extends StatefulWidget {
  const HrPayrollManagement({super.key});

  @override
  State<HrPayrollManagement> createState() => _HrPayrollManagementState();
}

class _HrPayrollManagementState extends State<HrPayrollManagement> {
  // Theme Colors
  static const Color primaryColor = Color(0xFF00657F);
  static const Color accentColor = Color(0xFF0284C7);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;

  bool _isLoading = false;
  List<dynamic> _people = [];
  List<dynamic> _filteredPeople = [];
  String _searchQuery = "";
  int _selectedType = 0; // 0 for Interns, 1 for Employees

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final endpoint = _selectedType == 0 ? "intern" : "employee";
      final response = await http.get(Uri.parse("${getBaseUrl()}/api/$endpoint/all"));
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _people = _selectedType == 0 ? data['interns'] : data['employees'];
          _filteredPeople = _people;
        });
      }
    } catch (e) {
      debugPrint("Fetch error: $e");
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _filterPeople(String query) {
    setState(() {
      _searchQuery = query;
      _filteredPeople = _people.where((person) {
        final name = person['fullName']?.toString().toLowerCase() ?? '';
        final id = person['internId']?.toString().toLowerCase() ?? person['employeeId']?.toString().toLowerCase() ?? '';
        return name.contains(query.toLowerCase()) || id.contains(query.toLowerCase());
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [primaryColor, Color(0xFF004D61)],
            ),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "Payroll Management",
          style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 20),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          _buildSearchAndFilter(),
          Expanded(
            child: _isLoading 
              ? const Center(child: CircularProgressIndicator(color: primaryColor))
              : _buildPeopleList(),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilter() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 4))],
      ),
      child: Column(
        children: [
          TextField(
            onChanged: _filterPeople,
            decoration: InputDecoration(
              hintText: "Search by name or ID...",
              prefixIcon: const Icon(Icons.search_rounded, color: primaryColor),
              filled: true,
              fillColor: backgroundColor,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildTypeTab("Interns", 0),
              const SizedBox(width: 12),
              _buildTypeTab("Employees", 1),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTypeTab(String title, int index) {
    final bool isSelected = _selectedType == index;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _selectedType = index;
            _searchQuery = "";
          });
          _fetchData();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? primaryColor : backgroundColor,
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Text(
            title,
            style: TextStyle(
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
              color: isSelected ? Colors.white : Colors.grey.shade700,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPeopleList() {
    if (_filteredPeople.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_search_rounded, size: 64, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text("No results found", style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: _filteredPeople.length,
      itemBuilder: (context, index) {
        final person = _filteredPeople[index];
        return _buildPersonCard(person);
      },
    );
  }

  Widget _buildPersonCard(Map<String, dynamic> person) {
    final name = person['fullName'] ?? 'Unknown';
    final id = person['internId'] ?? person['employeeId'] ?? 'N/A';
    final role = person['role'] ?? person['department'] ?? 'Staff';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: () => _showEditPayrollDialog(person),
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: primaryColor.withOpacity(0.1),
                  child: Text(name[0], style: const TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 20)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF1E293B))),
                      const SizedBox(height: 4),
                      Text("ID: $id • $role", style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                    ],
                  ),
                ),
                const Icon(Icons.edit_note_rounded, color: accentColor),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showEditPayrollDialog(Map<String, dynamic> person) {
    final name = person['fullName'] ?? 'User';
    final basicController = TextEditingController(text: "45000");
    final hraController = TextEditingController(text: "15000");
    final allowancesController = TextEditingController(text: "5000");
    final deductionsController = TextEditingController(text: "2000");

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        decoration: const BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text("Edit Payroll", style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: primaryColor)),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded)),
              ],
            ),
            const SizedBox(height: 8),
            Text("Updating salary for $name", style: TextStyle(color: Colors.grey.shade600)),
            const SizedBox(height: 24),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    _buildSalaryInputField("Basic Salary", basicController),
                    const SizedBox(height: 16),
                    _buildSalaryInputField("HRA", hraController),
                    const SizedBox(height: 16),
                    _buildSalaryInputField("Allowances", allowancesController),
                    const SizedBox(height: 16),
                    _buildSalaryInputField("Deductions", deductionsController),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Payroll updated successfully")));
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text("Save Structure", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildSalaryInputField(String label, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF1E293B))),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            prefixText: "₹ ",
            filled: true,
            fillColor: backgroundColor,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }
}
