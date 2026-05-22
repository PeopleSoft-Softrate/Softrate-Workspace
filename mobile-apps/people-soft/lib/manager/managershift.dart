import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ManagerShiftPage extends StatefulWidget {
  const ManagerShiftPage({super.key});

  @override
  State<ManagerShiftPage> createState() => _ManagerShiftPageState();
}

class _ManagerShiftPageState extends State<ManagerShiftPage> {
  // Sophisticated Teal Management Palette
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  // Demo Data for Team Shifts
  final List<Map<String, dynamic>> _teamShifts = [
    {
      "name": "Alex Johnson",
      "shift": "Morning (09:00 - 18:00)",
      "type": "Fixed",
    },
    {
      "name": "Sarah Williams",
      "shift": "General (10:00 - 19:00)",
      "type": "Fixed",
    },
    {
      "name": "Michael Chen",
      "shift": "Evening (14:00 - 23:00)",
      "type": "Rotating",
    },
    {"name": "Emily Davis", "shift": "Night (22:00 - 07:00)", "type": "Fixed"},
  ];

  final List<String> _availableShifts = [
    "Morning (09:00 - 18:00)",
    "General (10:00 - 19:00)",
    "Evening (14:00 - 23:00)",
    "Night (22:00 - 07:00)",
  ];

  void _showAssignShiftDialog(int index) {
    String selectedShift = _teamShifts[index]["shift"];

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: surfaceColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            "Assign Shift: ${_teamShifts[index]["name"]}",
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16.5, color: primaryColor),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: _availableShifts.map((shift) {
              return RadioListTile<String>(
                title: Text(shift, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500, color: primaryColor)),
                value: shift,
                groupValue: selectedShift,
                activeColor: primaryColor,
                contentPadding: EdgeInsets.zero,
                onChanged: (value) {
                  if (value != null) {
                    setDialogState(() => selectedShift = value);
                  }
                },
              );
            }).toList(),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel", style: TextStyle(color: subtitleColor, fontWeight: FontWeight.w600)),
            ),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _teamShifts[index]["shift"] = selectedShift;
                });
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: primaryColor,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    content: const Text("Shift Updated successfully", style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text("Update Shift", style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildProfessionalHeader(),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 32, 20, 12),
                child: Text(
                  "TEAM SHIFT ASSIGNMENTS",
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                    color: subtitleColor,
                    letterSpacing: 1.1,
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: _teamShifts.length,
                  itemBuilder: (context, index) {
                    final member = _teamShifts[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: surfaceColor,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: borderColor.withValues(alpha: 0.8)),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 10, offset: const Offset(0, 4)),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: primaryColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Text(
                                member["name"][0],
                                style: const TextStyle(color: primaryColor, fontWeight: FontWeight.w600, fontSize: 16),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(member["name"], style: const TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 14.5)),
                                const SizedBox(height: 4),
                                Text(member["shift"], style: const TextStyle(color: subtitleColor, fontSize: 11, fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ),
                          _buildModernIconButton(Icons.edit_calendar_rounded, () => _showAssignShiftDialog(index)),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfessionalHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildModernIconButton(Icons.arrow_back_ios_new_rounded, () => Navigator.pop(context)),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Shifts",
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontSize: 24,
                        letterSpacing: -1.0,
                      ),
                    ),
                    Text(
                      "SCHEDULES & ROSTER MANAGEMENT",
                      style: TextStyle(
                        color: subtitleColor,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          Row(
            children: [
              _buildActionBtn("Rotate Shifts", Icons.sync_rounded, const Color(0xFF6366F1), () {}),
              const SizedBox(width: 12),
              _buildActionBtn("Weekly Roster", Icons.calendar_view_week_rounded, const Color(0xFF10B981), () {}),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.1)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: color)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModernIconButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Icon(icon, color: primaryColor, size: 20),
      ),
    );
  }
}
