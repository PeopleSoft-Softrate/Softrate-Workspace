import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/employee_termination.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';

class EmployeeFullDetails extends StatefulWidget {
  final String employeeId;

  const EmployeeFullDetails({super.key, required this.employeeId});

  @override
  State<EmployeeFullDetails> createState() => _EmployeeFullDetailsState();
}

class _EmployeeFullDetailsState extends State<EmployeeFullDetails> {
  Employee? employee;
  bool isLoading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    fetchEmployeeDetails();
  }

  Future<void> fetchEmployeeDetails() async {
    try {
      final url = Uri.parse('${getBaseUrl()}/api/employee/get/${widget.employeeId}');
      final response = await http.get(url, headers: {'Content-Type': 'application/json'});

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['employee'] ?? jsonDecode(response.body);
        if (mounted) {
          setState(() {
            employee = Employee.fromJson(data);
            isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            error = 'Failed to fetch employee data';
            isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = 'Network error occurred';
          isLoading = false;
        });
      }
    }
  }

  Future<void> _refresh() async {
    setState(() => isLoading = true);
    await fetchEmployeeDetails();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        title: Text(employee?.fullName ?? 'Employee Details'),
        centerTitle: true,
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        actions: [
          if (employee != null)
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _refresh,
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: const Color(0xFF00657F),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: isLoading
              ? const _ShimmerContent()
              : error != null
                  ? _ErrorContent(error: error!, onRetry: fetchEmployeeDetails)
                  : employee == null
                      ? const _EmptyContent()
                      : _ProfileContent(employee: employee!),
        ),
      ),
    );
  }
}

class _ProfileContent extends StatelessWidget {
  final Employee employee;

  const _ProfileContent({required this.employee});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Profile Header
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.08),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 50,
                backgroundColor: const Color(0xFF00657F).withOpacity(0.1),
                child: Text(
                  employee.fullName.isNotEmpty ? employee.fullName[0].toUpperCase() : '?',
                  style: const TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF00657F),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                employee.fullName,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1A1A1A),
                ),
              ),
              const SizedBox(height: 8),
              _StatusBadge(status: employee.status),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _ContactButton(
                      icon: Icons.email_outlined,
                      label: employee.email,
                      onTap: () => _launchEmail(employee.email),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ContactButton(
                      icon: Icons.phone_outlined,
                      label: employee.phone,
                      onTap: () => _launchPhone(employee.phone),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Termination Button
        if (employee.status.toLowerCase() != 'terminated')
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => EmployeeTerminationPage(
                      employeeId: employee.employeeId,
                      fullName: employee.fullName,
                      department: employee.role,
                      designation: employee.designation,
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.work_off_rounded, size: 20, color: Colors.white),
              label: const Text(
                "Apply Termination",
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFB00020),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 2,
              ),
            ),
          ),
        const SizedBox(height: 24),

        // Personal Information
        _SectionContainer(
          children: [
            const _SectionHeader(title: 'Personal Information'),
            const SizedBox(height: 16),
            _InfoRow('Employee ID', employee.employeeId),
            _InfoRow('Date of Birth', _formatDate(employee.dob)),
            _InfoRow('Gender', employee.gender),
            _InfoRow('Nationality', employee.nationality),
            _InfoRow('Marital Status', employee.maritalStatus),
            _InfoRow('Address', employee.address),
          ],
        ),
        const SizedBox(height: 20),

        // Professional Information
        _SectionContainer(
          children: [
            const _SectionHeader(title: 'Professional Information'),
            const SizedBox(height: 16),
            _InfoRow('Role', employee.role),
            _InfoRow('Designation', employee.designation),
            _InfoRow('College', employee.college),
            _InfoRow('Qualification', employee.qualification),
            _InfoRow('Specialization', employee.specialization),
            _InfoRow('Passing Year', employee.passingYear),
            if (employee.ugCgpa != null && employee.ugCgpa! > 0)
              _InfoRow('UG CGPA', employee.ugCgpa!.toStringAsFixed(2)),
            if (employee.pgCgpa != null && employee.pgCgpa! > 0)
              _InfoRow('PG CGPA', employee.pgCgpa!.toStringAsFixed(2)),
          ],
        ),
        const SizedBox(height: 20),

        // Experience & Emergency
        _SectionContainer(
          children: [
            const _SectionHeader(title: 'Experience & Emergency'),
            const SizedBox(height: 16),
            if (employee.isExperienced)
              Column(
                children: [
                  _InfoRow('Experience', '${employee.experienceYears} years'),
                  _InfoRow('Previous Org', employee.previousOrg),
                  const SizedBox(height: 8),
                ],
              )
            else
              _InfoRow('Experience', 'Fresher'),
            _InfoRow('Emergency Contact', employee.emergencyName),
            _InfoRow('Emergency Phone', employee.emergencyPhone),
            if (employee.linkedin.isNotEmpty)
              _LinkedInRow(
                label: 'LinkedIn',
                url: employee.linkedin,
                onTap: () => _launchLinkedIn(employee.linkedin),
              ),
          ],
        ),
        const SizedBox(height: 20),

        // Consents & Submission
        _SectionContainer(
          children: [
            const _SectionHeader(title: 'Documents & Consents'),
            const SizedBox(height: 16),
            _ConsentRow('Background Check Consent', employee.bgConsent),
            _ConsentRow('WhatsApp Consent', employee.whatsappConsent),
            _ConsentRow('Declaration Signed', employee.declaration),
            _InfoRow('Submitted At', _formatDate(employee.submittedAt)),
          ],
        ),
      ],
    );
  }

  static String _formatDate(dynamic date) {
    if (date == null || date.toString().isEmpty) return 'Not provided';
    try {
      final dt = DateTime.parse(date.toString());
      return DateFormat('dd MMM yyyy').format(dt);
    } catch (_) {
      return date.toString();
    }
  }

  static Future<void> _launchEmail(String email) async {
    if (email.isEmpty) return;
    final Uri emailUri = Uri(scheme: 'mailto', path: email);
    if (!await launchUrl(emailUri, mode: LaunchMode.externalApplication)) {
      debugPrint('Could not launch email');
    }
  }

  static Future<void> _launchPhone(String phone) async {
    if (phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  static Future<void> _launchLinkedIn(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }
}

class _ContactButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ContactButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isEnabled = label.isNotEmpty;

    return GestureDetector(
      onTap: isEnabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isEnabled ? Colors.white : Colors.grey[100],
          borderRadius: BorderRadius.circular(25),
          border: Border.all(
            color: isEnabled
                ? const Color(0xFF00657F).withOpacity(0.2)
                : Colors.grey[300]!,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.max,
          children: [
            Icon(
              icon,
              size: 18,
              color: isEnabled ? const Color(0xFF00657F) : Colors.grey[400],
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label.isEmpty ? 'Not set' : label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isEnabled ? const Color(0xFF00657F) : Colors.grey[500],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status.toLowerCase()) {
      case 'approved':
        color = const Color(0xFF2E7D32);
        break;
      case 'pending':
        color = const Color(0xFFFFA726);
        break;
      case 'rejected':
        color = const Color(0xFFD32F2F);
        break;
      default:
        color = const Color(0xFF00657F);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _SectionContainer extends StatelessWidget {
  final List<Widget> children;

  const _SectionContainer({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 20,
          decoration: BoxDecoration(
            color: const Color(0xFF00657F),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value.isEmpty ? 'Not provided' : value,
              style: const TextStyle(fontSize: 15, color: Color(0xFF212121)),
            ),
          ),
        ],
      ),
    );
  }
}

class _LinkedInRow extends StatelessWidget {
  final String label;
  final String url;
  final VoidCallback onTap;

  const _LinkedInRow({
    required this.label,
    required this.url,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasUrl = url.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GestureDetector(
              onTap: hasUrl ? onTap : null,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    hasUrl ? 'View profile' : 'Not provided',
                    style: TextStyle(
                      fontSize: 15,
                      color: hasUrl ? const Color(0xFF00657F) : Colors.grey[500],
                      fontWeight: hasUrl ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  if (hasUrl) ...[
                    const SizedBox(width: 6),
                    const Icon(
                      Icons.open_in_new_rounded,
                      size: 18,
                      color: Color(0xFF00657F),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsentRow extends StatelessWidget {
  final String label;
  final bool value;

  const _ConsentRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Row(
              children: [
                Icon(
                  value ? Icons.check_circle : Icons.cancel,
                  color: value ? Colors.green.shade400 : Colors.red.shade400,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  value ? 'Yes' : 'No',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: value ? Colors.green.shade700 : Colors.red.shade700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// State widgets (Shimmer, Error, Empty)
class _ShimmerContent extends StatelessWidget {
  const _ShimmerContent();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(height: 24),
          Container(
            width: 200,
            height: 20,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: 120,
            height: 16,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorContent extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorContent({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 20),
            const Text(
              'Failed to load profile',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: TextStyle(color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00657F),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyContent extends StatelessWidget {
  const _EmptyContent();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 20),
            const Text(
              'Employee not found',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'The requested employee profile could not be located',
              style: TextStyle(color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class Employee {
  final String id;
  final String employeeId;
  final String fullName;
  final String email;
  final String phone;
  final String emergencyName;
  final String emergencyPhone;
  final String dob;
  final String address;
  final String role;
  final String linkedin;
  final String gender;
  final String nationality;
  final String maritalStatus;
  final String qualification;
  final String specialization;
  final String college;
  final String passingYear;
  final double? ugCgpa;
  final double? pgCgpa;
  final bool isExperienced;
  final String experienceYears;
  final String previousOrg;
  final String designation;
  final bool declaration;
  final bool bgConsent;
  final bool whatsappConsent;
  final String submittedAt;
  final String status;

  Employee({
    required this.id,
    required this.employeeId,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.emergencyName,
    required this.emergencyPhone,
    required this.dob,
    required this.address,
    required this.role,
    required this.linkedin,
    required this.gender,
    required this.nationality,
    required this.maritalStatus,
    required this.qualification,
    required this.specialization,
    required this.college,
    required this.passingYear,
    this.ugCgpa,
    this.pgCgpa,
    required this.isExperienced,
    required this.experienceYears,
    required this.previousOrg,
    required this.designation,
    required this.declaration,
    required this.bgConsent,
    required this.whatsappConsent,
    required this.submittedAt,
    required this.status,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['_id']?.toString() ?? '',
      employeeId: json['EmployeeId'] ?? '',
      fullName: json['fullName'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      emergencyName: json['emergencyName'] ?? '',
      emergencyPhone: json['emergencyPhone'] ?? '',
      dob: json['dob']?.toString() ?? '',
      address: json['address'] ?? '',
      role: json['role'] ?? '',
      linkedin: json['linkedin'] ?? '',
      gender: json['gender'] ?? '',
      nationality: json['nationality'] ?? '',
      maritalStatus: json['maritalStatus'] ?? '',
      qualification: json['qualification'] ?? '',
      specialization: json['specialization'] ?? '',
      college: json['college'] ?? '',
      passingYear: json['passingYear'] ?? '',
      ugCgpa: json['ugCgpa']?.toDouble(),
      pgCgpa: json['pgCgpa']?.toDouble(),
      isExperienced: json['isExperienced'] ?? false,
      experienceYears: json['experienceYears'] ?? '',
      previousOrg: json['previousOrg'] ?? '',
      designation: json['designation'] ?? '',
      declaration: json['declaration'] ?? false,
      bgConsent: json['bgConsent'] ?? false,
      whatsappConsent: json['whatsappConsent'] ?? false,
      submittedAt: json['submittedAt']?.toString() ?? '',
      status: json['status'] ?? '',
    );
  }
}
