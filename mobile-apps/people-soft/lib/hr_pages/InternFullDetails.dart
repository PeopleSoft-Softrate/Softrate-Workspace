import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:url_launcher/url_launcher.dart';

class InternFullDetails extends StatefulWidget {
  final String internId;

  const InternFullDetails({super.key, required this.internId});

  @override
  State<InternFullDetails> createState() => _InternFullDetailsState();
}

class _InternFullDetailsState extends State<InternFullDetails> {
  Intern? intern;
  bool isLoading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    fetchInternDetails();
  }

  Future<void> fetchInternDetails() async {
    try {
      final url = Uri.parse(
        '${getBaseUrl()}/api/intern/get/${widget.internId}',
      );
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['intern'];
        if (mounted) {
          setState(() {
            intern = Intern.fromJson(data);
            isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            error = 'Failed to fetch intern data';
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
    await fetchInternDetails();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        title: Text(intern?.fullName ?? 'Intern Details'),
        centerTitle: true,
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        actions: [
          if (intern != null)
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
              ? _ErrorContent(error: error!, onRetry: fetchInternDetails)
              : intern == null
              ? const _EmptyContent()
              : _ProfileContent(intern: intern!),
        ),
      ),
    );
  }
}

class _ProfileContent extends StatelessWidget {
  final Intern intern;

  const _ProfileContent({required this.intern});

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
                  intern.fullName.isNotEmpty
                      ? intern.fullName[0].toUpperCase()
                      : '?',
                  style: const TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF00657F),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                intern.fullName,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1A1A1A),
                ),
              ),
              const SizedBox(height: 8),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _StatusBadge(status: intern.status),
                  SizedBox(width: 20),
                  _InternshipTypeBadge(type: intern.internshipType),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _ContactButton(
                      icon: Icons.email_outlined,
                      label: intern.email,
                      onTap: () => _launchEmail(intern.email),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ContactButton(
                      icon: Icons.phone_outlined,
                      label: intern.contact,
                      onTap: () => _launchPhone(intern.contact),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Details Section
        _SectionContainer(
          children: [
            _SectionHeader(title: 'Basic Information'),
            const SizedBox(height: 16),
            _InfoRow('ID', intern.internId),
            _InfoRow('Department', intern.department),
            _InfoRow('Role', intern.role),
            _InfoRow('College', intern.college),
            _InfoRow('Year', intern.year),
          ],
        ),
        const SizedBox(height: 20),

        // Dates Section
        _SectionContainer(
          children: [
            _SectionHeader(title: 'Timeline'),
            const SizedBox(height: 16),
            _InfoRow('Onboarding Date', _formatDate(intern.onboardingDate)),
            _InfoRow('End Date', _formatDate(intern.endDate)),
            // _InfoRow('Created At', _formatDate(intern.createdAt)),
          ],
        ),
        const SizedBox(height: 20),

        // Contact Section
        _SectionContainer(
          children: [
            _SectionHeader(title: 'Contact Details'),
            const SizedBox(height: 16),
            _InfoRow('Emergency Contact', intern.emergencyContact),
            if (intern.linkedin.isNotEmpty)
              _LinkedInRow(
                label: 'LinkedIn',
                url: intern.linkedin,
                onTap: () => _launchLinkedIn(intern.linkedin),
              ),
          ],
        ),
      ],
    );
  }

  static String _formatDate(dynamic date) {
    if (date == null || date.toString().isEmpty) return 'Not provided';
    try {
      final dt = DateTime.parse(date.toString());
      return '${dt.day.toString().padLeft(2, '0')}-${dt.month.toString().padLeft(2, '0')}-${dt.year}';
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

  static void _launchPhone(String phone) async {
    if (phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  static void _launchLinkedIn(String url) async {
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
      case 'ongoing':
        color = const Color(0xFF2E7D32);
        break;
      case 'completed':
        color = const Color(0xFF00657F);
        break;
      default:
        color = const Color(0xFFFFA726);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        status,
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
class _InternshipTypeBadge extends StatelessWidget {
  final String type;

  const _InternshipTypeBadge({required this.type});

  @override
  Widget build(BuildContext context) {
    Color color;
    IconData icon;
    
    switch (type.toLowerCase()) {
      case 'paid':
        color = const Color(0xFF2E7D32); // Green for Paid
        icon = Icons.payments_outlined;
        break;
      case 'stipend':
        color = const Color(0xFF00657F); // Teal for Stipend
        icon = Icons.account_balance_wallet_outlined;
        break;
      default:
        color = const Color(0xFF757575);
        icon = Icons.category_outlined;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 4),
          Text(
            type.isEmpty ? 'N/A' : type,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
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
                      color: hasUrl
                          ? const Color(0xFF00657F)
                          : Colors.grey[500],

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

class _InfoRowClickable extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;

  const _InfoRowClickable(this.label, this.value, this.onTap);

  @override
  Widget build(BuildContext context) {
    final isEnabled = value.isNotEmpty;
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
              onTap: isEnabled ? onTap : null,
              child: Text(
                value.isEmpty ? 'Not provided' : value,
                style: TextStyle(
                  fontSize: 15,
                  color: isEnabled ? const Color(0xFF00657F) : Colors.grey[500],
                  decoration: isEnabled ? TextDecoration.underline : null,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// States
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
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
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
              'Intern not found',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'The requested intern profile could not be located',
              style: TextStyle(color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class Intern {
  final String internId;
  final String fullName;
  final String department;
  final String role;
  final String college;
  final String year;
  final String email;
  final String contact;
  final String emergencyContact;
  final String onboardingDate;
  final String endDate;
  final String linkedin;
  final String status;
  final String createdAt;
  final String internshipType;

  Intern({
    required this.internId,
    required this.fullName,
    required this.department,
    required this.role,
    required this.college,
    required this.year,
    required this.email,
    required this.contact,
    required this.emergencyContact,
    required this.onboardingDate,
    required this.endDate,
    required this.linkedin,
    required this.status,
    required this.createdAt,
    required this.internshipType
  });

  factory Intern.fromJson(Map<String, dynamic> json) {
    return Intern(
      internId: json['internid'] ?? '',
      fullName: json['fullName'] ?? '',
      department: json['department'] ?? '',
      role: json['role'] ?? '',
      college: json['college'] ?? '',
      year: json['year'] ?? '',
      email: json['email'] ?? '',
      contact: json['contact'] ?? '',
      emergencyContact: json['emergencyContact'] ?? '',
      onboardingDate: json['onboardingDate'] ?? '',
      endDate: json['endDate'] ?? '',
      linkedin: json['linkedin'] ?? '',
      status: json['status'] ?? '',
      createdAt: json['createdAt'] ?? '',
      internshipType: json['internshipType'] ?? ''
    );
  }
}
