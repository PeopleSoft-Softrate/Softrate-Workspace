import 'package:flutter/material.dart';
import 'package:hrmappfrontend/manager/managerrecrument.dart';
import 'package:hrmappfrontend/manager/managerattendance.dart';
import 'package:hrmappfrontend/manager/managerleave.dart';
import 'package:hrmappfrontend/manager/managershift.dart';
import 'package:hrmappfrontend/manager/managerappraisal.dart';
import 'package:hrmappfrontend/manager/managerdocuments.dart';
import 'package:hrmappfrontend/manager/managerteam.dart';
import 'package:hrmappfrontend/manager/managerholiday.dart';
import 'package:hrmappfrontend/manager/manageroffboarding.dart';

class ManagerAccessSection extends StatelessWidget {
  final Map<String, dynamic> employeeData;

  const ManagerAccessSection({super.key, required this.employeeData});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Text(
            "Manager Access",
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
        ),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.5,
          children: [
            _buildOptionCard(
              context,
              "Team",
              "Management",
              Icons.people_rounded,
              const Color(0xFF818CF8),
              const ManagerTeamPage(),
            ),
            _buildOptionCard(
              context,
              "Attendance",
              "Team Records",
              Icons.how_to_reg_rounded,
              const Color(0xFFFBBF24),
              const ManagerAttendancePage(),
            ),
            _buildOptionCard(
              context,
              "Recruitment",
              "Hiring",
              Icons.person_search_rounded,
              const Color(0xFFA78BFA),
              const ManagerRecruitmentPage(),
            ),
            _buildOptionCard(
              context,
              "Leaves",
              "Approvals",
              Icons.event_note_rounded,
              const Color(0xFFF87171),
              const ManagerLeavePage(),
            ),
            _buildOptionCard(
              context,
              "Shifts",
              "Schedules",
              Icons.schedule_rounded,
              const Color(0xFF60A5FA),
              const ManagerShiftPage(),
            ),
            _buildOptionCard(
              context,
              "Appraisal",
              "Performance",
              Icons.reviews_rounded,
              const Color(0xFFC084FC),
              const ManagerAppraisalPage(),
            ),
            _buildOptionCard(
              context,
              "Details",
              "Team Mates",
              Icons.person_rounded,
              const Color(0xFFFB923C),
              const ManagerDocumentsPage(),
            ),
            _buildOptionCard(
              context,
              "Holiday",
              "Calendar",
              Icons.event_available_rounded,
              const Color(0xFF2DD4BF),
              const ManagerHolidayCalendarPage(),
            ),
            _buildOptionCard(
              context,
              "Offboarding",
              "Team Exits",
              Icons.person_off_rounded,
              const Color(0xFFF43F5E),
              const ManagerOffboardingPage(),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildOptionCard(
    BuildContext context,
    String title,
    String subtitle,
    IconData icon,
    Color color,
    Widget page,
  ) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => page),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 9,
                      color: Colors.grey.shade500,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
