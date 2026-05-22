import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'package:hrmappfrontend/port.dart'; // getBaseUrl()

class AddingEmployee extends StatefulWidget {
  const AddingEmployee({super.key});

  @override
  State<AddingEmployee> createState() => _AddingEmployeeState();
}

class _AddingEmployeeState extends State<AddingEmployee> {
  List<dynamic> employees = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    loadEmployees();
  }

  /// 🔹 FETCH PENDING EMPLOYEES
  Future<void> loadEmployees() async {
    setState(() => loading = true);

    try {
      final res = await http.get(
        Uri.parse("${getBaseUrl()}/api/employee/all/initial"),
      );

      if (res.statusCode == 200) {
        employees = jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Load employees error: $e");
    }

    if (mounted) {
      setState(() => loading = false);
    }
  }


  /// 🔹 ACCEPT EMPLOYEE
  Future<bool> acceptEmployee(String id, DateTime onboardingDate) async {
  try {
    final response = await http.put(
      Uri.parse("${getBaseUrl()}/api/employee/accept/$id"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "onboardingDate":
            "${onboardingDate.year}-${onboardingDate.month.toString().padLeft(2, '0')}-${onboardingDate.day.toString().padLeft(2, '0')}",
      }),
    );



    // ✅ Success only if status 200
    if (response.statusCode != 200) return false;

    return true;
  } catch (e) {
    debugPrint("Accept error: $e");
    return false;
  }
}




  /// 🔹 REJECT EMPLOYEE
  Future<void> deleteEmployee(String id) async {
  final response = await http.delete(
    Uri.parse("${getBaseUrl()}/api/employee/delete/$id"),
  );

  if (response.statusCode == 200) {
    print("Employee deleted successfully");
  } else {
    print("Failed to delete employee: ${response.body}");
  }
}


  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        title: const Text(
          "Pending Employee Approvals",
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : employees.isEmpty
              ? _emptyState(w)
              : _employeeList(w),
    );
  }

  Widget _emptyState(double w) {
    return Container(
      width: w,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: const Center(
        child: Text(
          "No employees waiting for approval",
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: Color(0xFF444444),
          ),
        ),
      ),
    );
  }

  Widget _employeeList(double w) {
    return Container(
      width: w,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        itemCount: employees.length,
        itemBuilder: (_, index) {
          final emp = employees[index];

          return Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                /// HEADER
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        emp["fullName"] ?? "-",
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF003648),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8ED1DC).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        emp["role"] ?? "Employee",
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF00657F),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                _info(
                  "Email",
                  emp["email"],
                  action: "mailto:${emp["email"]}",
                ),
                _info(
                  "Phone",
                  emp["phone"],
                  action: "tel:${emp["phone"]}",
                ),
                if ((emp["linkedin"] ?? "").toString().isNotEmpty)
                  _info(
                    "LinkedIn",
                    emp["linkedin"],
                    action: emp["linkedin"],
                  ),

                const SizedBox(height: 8),

                _info(
                  "Experience",
                  emp["isExperienced"] == true
                      ? "Experienced (${emp["experienceYears"] ?? "N/A"} yrs)"
                      : "Fresher",
                ),

                if (emp["isExperienced"] == true &&
                    (emp["previousOrg"] ?? "").toString().isNotEmpty)
                  _info("Previous Org", emp["previousOrg"]),

                const SizedBox(height: 12),

                /// ACTIONS
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF00657F)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: () {
                          _showAddEmployeeDialog(
                            context,
                            emp,
                            loadEmployees,
                            acceptEmployee,
                          );
                        },
                        child: const Text(
                          "Accept",
                          style: TextStyle(
                            color: Color(0xFF00657F),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextButton(
                        onPressed: () async {
                          await deleteEmployee(emp["_id"]);
                          if (mounted) loadEmployees();
                        },
                        child: const Text(
                          "Reject",
                          style: TextStyle(
                            color: Color(0xFFB00020),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                )
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _info(String label, String? value, {String? action}) {
    if (value == null || value.isEmpty) return const SizedBox();

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF607D8B),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: action == null
                  ? null
                  : () async {
                      final uri = Uri.parse(action);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(
                          uri,
                          mode: LaunchMode.externalApplication,
                        );
                      }
                    },
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 13,
                  color: action != null
                      ? const Color(0xFF00657F)
                      : Colors.black87,
                  
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 🔹 APPROVAL DIALOG
void _showAddEmployeeDialog(
  
  BuildContext context,
  Map<String, dynamic> emp,
  Function refresh,
  Function(String, DateTime) acceptEmployee,
) {
  DateTime? onboardingDate;
  bool approving = false;

  showDialog(

    context: context,
    builder: (_) => Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: StatefulBuilder(
          builder: (context, setStateSB) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  "Add Employee",
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF00657F),
                  ),
                ),
                const SizedBox(height: 24),

                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2035),
                    );
                    if (picked != null) {
                      setStateSB(() => onboardingDate = picked);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 14),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade400),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          onboardingDate == null
                              ? "Select Onboarding Date"
                              : "${onboardingDate!.day}-${onboardingDate!.month}-${onboardingDate!.year}",
                        ),
                        const Icon(Icons.calendar_month,
                            color: Color(0xFF00657F)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00657F),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: onboardingDate == null || approving
                      ? null
                      : () async {
                          setStateSB(() => approving = true);

                          final success = await acceptEmployee(
                            emp["_id"],
                            onboardingDate!,
                          );

                          setStateSB(() => approving = false);

                          if (success) {
                            refresh();
                            Navigator.pop(context);

                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("Employee approved successfully"),
                                backgroundColor: Colors.green,
                              ),
                            );
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("Failed to approve employee"),
                                backgroundColor: Colors.red,
                              ),
                            );
                          }
                        },
                        child: approving
                            ? const SizedBox(
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Text(
                                "Approve Employee",
                                style: TextStyle(color: Colors.white, fontSize: 16),
                              ),

                  ),
                ),
              ],
            );
          },
        ),
      ),
    ),
  );
}
