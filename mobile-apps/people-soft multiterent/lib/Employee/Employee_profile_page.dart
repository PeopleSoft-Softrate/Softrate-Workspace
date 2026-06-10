import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/Employee/EmployeeResignationPage.dart';
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path/path.dart' as p;
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:http_parser/http_parser.dart';

class EmployeeProfilePage extends StatefulWidget {
  final Map<String, dynamic>? employeeData;

  const EmployeeProfilePage({required this.employeeData, super.key});

  @override
  State<EmployeeProfilePage> createState() => _EmployeeProfilePageState();
}

class _EmployeeProfilePageState extends State<EmployeeProfilePage> {
  String? _profileImagePath;
  bool _isImageLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfileImage();
  }

  Future<void> _loadProfileImage() async {
    final String employeeId = widget.employeeData?['EmployeeId'] ?? 'unknown';
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _profileImagePath = prefs.getString('profile_pic_$employeeId');
      _isImageLoading = false;
    });
  }

  Future<void> _removeProfilePicture() async {
    final String employeeId = widget.employeeData?['EmployeeId'] ?? 'unknown';
    final prefs = await SharedPreferences.getInstance();

    if (_profileImagePath != null) {
      final file = File(_profileImagePath!);
      if (await file.exists()) {
        try {
          await file.delete();
        } catch (e) {
          debugPrint("Error deleting file: $e");
        }
      }
    }

    await prefs.remove('profile_pic_$employeeId');
    setState(() {
      _profileImagePath = null;
    });

    if (mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile picture removed')));
    }
  }

  Future<void> _saveImagePermanently(String imagePath) async {
    final String employeeId = widget.employeeData?['EmployeeId'] ?? 'unknown';
    final directory = await getApplicationDocumentsDirectory();

    if (_profileImagePath != null) {
      final oldFile = File(_profileImagePath!);
      if (await oldFile.exists()) {
        try {
          await oldFile.delete();
        } catch (e) {
          debugPrint("Error deleting old profile pic: $e");
        }
      }
    }

    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final fileName =
        'profile_emp_${employeeId}_$timestamp${p.extension(imagePath)}';
    final permanentPath = '${directory.path}/$fileName';

    final File imageFile = File(imagePath);
    await imageFile.copy(permanentPath);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('profile_pic_$employeeId', permanentPath);

    setState(() {
      _profileImagePath = permanentPath;
    });

    await _uploadProfilePhotoToBackend(permanentPath);
  }

  Future<void> _uploadProfilePhotoToBackend(String imagePath) async {
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator()),
      );

      // Manually read token and attach it to the multipart request
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? prefs.getString('hr_auth_token') ?? '';

      final url = Uri.parse("${getBaseUrl()}/api/auth/me/profile-photo");
      final request = http.MultipartRequest('PATCH', url);

      // Explicitly set Authorization before finalize/send
      if (token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      // Determine MIME type from file extension (avoids octet-stream fallback)
      final ext = imagePath.split('.').last.toLowerCase();
      final mimeSubtype = (ext == 'jpg' || ext == 'jpeg') ? 'jpeg' : (ext == 'png' ? 'png' : 'jpeg');

      request.files.add(await http.MultipartFile.fromPath(
        'profilePhoto',
        imagePath,
        contentType: MediaType('image', mimeSubtype),
      ));

      final streamedResponse = await http.send(request);
      final response = await http.Response.fromStream(streamedResponse);

      if (mounted) Navigator.pop(context); // close dialog

      debugPrint("Upload response: ${response.statusCode} — ${response.body}");

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile photo synced to server successfully!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to sync photo (${response.statusCode})'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) Navigator.pop(context); // close dialog
      debugPrint("Error uploading photo: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error uploading photo: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Future<void> _cropImage(String path) async {
    final croppedFile = await ImageCropper().cropImage(
      sourcePath: path,
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Align Profile Picture',
          toolbarColor: const Color(0xFFE0F2FE),
          toolbarWidgetColor: const Color(0xFF0F172A),
          activeControlsWidgetColor: const Color(0xFF0284C7),
          initAspectRatio: CropAspectRatioPreset.square,
          lockAspectRatio: true,
          cropStyle: CropStyle.circle,
        ),
        IOSUiSettings(
          title: 'Align Profile Picture',
          aspectRatioLockEnabled: true,
          resetAspectRatioEnabled: false,
          cropStyle: CropStyle.circle,
        ),
      ],
    );

    if (croppedFile != null) {
      await _saveImagePermanently(croppedFile.path);
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      if (source == ImageSource.camera) {
        var status = await Permission.camera.request();
        if (status.isDenied || status.isPermanentlyDenied) {
          if (mounted) _showPermissionDialog('Camera');
          return;
        }
      } else {
        if (Platform.isIOS) {
          var status = await Permission.photos.request();
          if (status.isDenied || status.isPermanentlyDenied) {
            if (mounted) _showPermissionDialog('Gallery');
            return;
          }
        } else if (Platform.isAndroid) {
          final androidInfo = await DeviceInfoPlugin().androidInfo;
          if (androidInfo.version.sdkInt < 33) {
            var status = await Permission.storage.request();
            if (status.isDenied || status.isPermanentlyDenied) {
              if (mounted) _showPermissionDialog('Storage');
              return;
            }
          }
        }
      }

      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 1000,
        maxHeight: 1000,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        await _cropImage(pickedFile.path);
        if (mounted) {
          Navigator.pop(context);
        }
      }
    } catch (e) {
      debugPrint("Error picking image: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString().split("\n").first}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  void _showPermissionDialog(String type) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$type Permission'),
        content: Text('Please allow $type access in settings.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              openAppSettings();
              Navigator.pop(context);
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  void _showImageSourceSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  "Profile Photo",
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF003648),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _ImageSourceOption(
                      icon: Icons.camera_alt_rounded,
                      label: "Camera",
                      onTap: () => _pickImage(ImageSource.camera),
                    ),
                    _ImageSourceOption(
                      icon: Icons.photo_library_rounded,
                      label: "Gallery",
                      onTap: () => _pickImage(ImageSource.gallery),
                    ),
                    if (_profileImagePath != null)
                      _ImageSourceOption(
                        icon: Icons.delete_outline_rounded,
                        label: "Remove",
                        color: Colors.redAccent,
                        onTap: _removeProfilePicture,
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> logout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF00657F).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.logout_rounded,
                  color: Color(0xFF00657F),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Logout',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                  color: Color(0xFF003648),
                ),
              ),
            ],
          ),
          content: const Text(
            'Are you sure you want to logout?',
            style: TextStyle(fontSize: 14, color: Color(0xFF424242)),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text(
                'Cancel',
                style: TextStyle(color: Color(0xFF00657F)),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00657F),
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Logout'),
            ),
          ],
        );
      },
    );

    if (shouldLogout != true) return;

    final prefs = await SharedPreferences.getInstance();
    final allKeys = prefs.getKeys();
    final profilePicData = <String, String>{};
    for (String key in allKeys) {
      if (key.startsWith('profile_pic_')) {
        profilePicData[key] = prefs.getString(key)!;
      }
    }
    await prefs.clear();
    profilePicData.forEach((key, value) async {
      await prefs.setString(key, value);
    });

    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => const homescreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.employeeData;
    if (data == null) {
      return const Scaffold(body: Center(child: Text("No Data Found")));
    }

    final String employeeId = data['EmployeeId'] ?? '';
    final String employeeName = data['fullName'] ?? '';
    final String role = data['role'] ?? '';
    final String status = data['status'] ?? '';
    final String email = data['email'] ?? '';
    final String phone = data['phone'] ?? '';
    final String emergencyPhone = data['emergencyPhone'] ?? '';
    final String linkedin = data['linkedin'] ?? '';
    final String designation = data['designation'] ?? 'Employee';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        centerTitle: true,
        title: const Text(
          "Employee Profile",
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 20,
            letterSpacing: -0.5,
          ),
        ),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF004E61), Color(0xFF00657F)],
            ),
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        foregroundColor: Colors.white,
        backgroundColor: Colors.transparent,
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Column(
                children: [
                  _FadeInWrapper(
                    delay: 0,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF00657F).withOpacity(0.08),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  employeeName.isEmpty
                                      ? 'Unknown Name'
                                      : employeeName,
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF001E26),
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                const SizedBox(height: 20),
                                _ContactItem(
                                  icon: Icons.email_outlined,
                                  value: email,
                                  onTap: () => _launchEmail(context, email),
                                ),
                                const SizedBox(height: 8),
                                _ContactItem(
                                  icon: Icons.phone_android_rounded,
                                  value: phone,
                                  onTap: () => _launchPhone(context, phone),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 100,
                                height: 100,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(
                                      0xFF0EA5E9,
                                    ).withOpacity(0.2),
                                    width: 4,
                                  ),
                                ),
                                child: _isImageLoading
                                    ? const Center(
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : CircleAvatar(
                                        radius: 46,
                                        backgroundColor: const Color(
                                          0xFF0EA5E9,
                                        ),
                                        backgroundImage:
                                            _profileImagePath != null
                                            ? FileImage(
                                                File(_profileImagePath!),
                                              )
                                            : null,
                                        child: _profileImagePath == null
                                            ? Text(
                                                employeeName.isNotEmpty
                                                    ? employeeName[0]
                                                          .toUpperCase()
                                                    : '?',
                                                style: const TextStyle(
                                                  fontSize: 36,
                                                  fontWeight: FontWeight.w800,
                                                  color: Colors.white,
                                                ),
                                              )
                                            : null,
                                      ),
                              ),
                              Positioned(
                                bottom: 0,
                                right: 0,
                                child: GestureDetector(
                                  onTap: _showImageSourceSheet,
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0E7490),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: Colors.white,
                                        width: 2,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.1),
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: const Icon(
                                      Icons.camera_alt_rounded,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  _FadeInWrapper(
                    delay: 200,
                    child: _SectionContainer(
                      children: [
                        const _SectionHeader(title: 'Basic Information'),
                        const SizedBox(height: 20),
                        _InfoRow(Icons.person_2, 'Employee ID', employeeId),
                        _InfoRow(Icons.business_rounded, 'Department', role),
                        _InfoRow(
                          Icons.work_outline_rounded,
                          'Designation',
                          designation,
                        ),
                        _InfoRow(
                          Icons.calendar_month_outlined,
                          'DOB',
                          formatDateTime(data['dob']),
                        ),
                        _InfoRow(
                          Icons.wc_rounded,
                          'Gender',
                          data['gender'] ?? '',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  _FadeInWrapper(
                    delay: 400,
                    child: _SectionContainer(
                      children: [
                        const _SectionHeader(title: 'Education & Professional'),
                        const SizedBox(height: 20),
                        _InfoRow(
                          Icons.school_outlined,
                          'Qualification',
                          data['qualification'] ?? '',
                        ),
                        _InfoRow(
                          Icons.history_edu_rounded,
                          'Experienced',
                          data['isExperienced'] == true ? 'Yes' : 'No',
                        ),
                        _InfoRow(
                          Icons.business_center_outlined,
                          'Previous Org',
                          data['previousOrg'] ?? '',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  _FadeInWrapper(
                    delay: 600,
                    child: _SectionContainer(
                      children: [
                        const _SectionHeader(title: 'Contact Details'),
                        const SizedBox(height: 20),
                        _InfoRow(
                          Icons.phone_iphone_rounded,
                          'Personal Phone',
                          phone,
                        ),
                        _InfoRow(
                          Icons.contact_emergency_outlined,
                          'Emergency Contact',
                          emergencyPhone,
                        ),
                        _LinkedInRow(
                          label: 'LinkedIn URL',
                          url: linkedin,
                          onTap: () => _launchLinkedIn(context, linkedin),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),

          SafeArea(
            top: true,
            bottom: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 12,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFD32F2F), Color(0xFFB00020)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => EmployeeResignationPage(
                                employeeId: employeeId,
                                fullName: employeeName,
                                department: role,
                                designation: designation,
                              ),
                            ),
                          );
                        },
                        icon: const Icon(
                          Icons.exit_to_app_rounded,
                          size: 22,
                          color: Colors.white,
                        ),
                        label: const Text(
                          "Apply Resignation",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: OutlinedButton.icon(
                      onPressed: logout,
                      icon: const Icon(Icons.logout_rounded, size: 20),
                      label: const Text(
                        "Logout Securely",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF00657F),
                        backgroundColor: const Color(
                          0xFF00657F,
                        ).withOpacity(0.05),
                        side: BorderSide(
                          color: const Color(0xFF00657F).withOpacity(0.3),
                          width: 1.5,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Future<void> _launchEmail(BuildContext context, String email) async {
    if (email.isEmpty) return;
    final Uri uri = Uri.parse('mailto:$email');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  static Future<void> _launchPhone(BuildContext context, String phone) async {
    if (phone.isEmpty) return;
    final Uri uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  static Future<void> _launchLinkedIn(BuildContext context, String url) async {
    if (url.isEmpty) return;
    final Uri uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status.toLowerCase()) {
      case 'active':
      case 'ongoing':
      case 'approved':
        color = const Color(0xFF059669);
        break;
      case 'rejected':
      case 'terminated':
        color = const Color(0xFFDC2626);
        break;
      default:
        color = const Color(0xFF0284C7);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3), width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            status.isEmpty ? 'N/A' : status.toUpperCase(),
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
        ],
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
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00657F).withOpacity(0.06),
            blurRadius: 20,
            offset: const Offset(0, 10),
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
          height: 18,
          decoration: BoxDecoration(
            color: const Color(0xFF0891B2),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
            letterSpacing: -0.3,
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final displayValue = (value.isEmpty || value == "null")
        ? 'Not provided'
        : value.toString().trim();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF0284C7).withOpacity(0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: const Color(0xFF0284C7)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[500],
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  displayValue,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E293B),
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
    final hasUrl = url.isNotEmpty && url != "null";
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF0077B5).withOpacity(0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.link_rounded,
              size: 18,
              color: Color(0xFF0077B5),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[500],
                  ),
                ),
                GestureDetector(
                  onTap: hasUrl ? onTap : null,
                  child: Text(
                    hasUrl ? 'View LinkedIn Profile' : 'Not provided',
                    style: TextStyle(
                      fontSize: 15,
                      color: hasUrl
                          ? const Color(0xFF0077B5)
                          : const Color(0xFF1E293B),
                      fontWeight: FontWeight.w700,
                    ),
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
    final isEnabled = label.isNotEmpty && label != "null";
    return GestureDetector(
      onTap: isEnabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isEnabled ? const Color(0xFF0F172A) : Colors.grey[100],
          borderRadius: BorderRadius.circular(16),
          boxShadow: isEnabled
              ? [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withOpacity(0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 20,
              color: isEnabled ? Colors.white : Colors.grey[400],
            ),
            const SizedBox(height: 4),
            Text(
              isEnabled ? 'Contact' : 'N/A',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: isEnabled ? Colors.white : Colors.grey[500],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ImageSourceOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _ImageSourceOption({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final textColor = color ?? const Color(0xFF003648);
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: textColor.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: textColor, size: 30),
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _FadeInWrapper extends StatelessWidget {
  final int delay;
  final Widget child;
  const _FadeInWrapper({required this.delay, required this.child});

  @override
  Widget build(BuildContext context) {
    return child; // Simplified for now
  }
}

class _ContactItem extends StatelessWidget {
  final IconData icon;
  final String value;
  final VoidCallback onTap;

  const _ContactItem({
    required this.icon,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bool hasValue = value.isNotEmpty && value != "null";
    return GestureDetector(
      onTap: hasValue ? onTap : null,
      child: Row(
        children: [
          Icon(
            icon,
            size: 16,
            color: hasValue ? const Color(0xFF00657F) : Colors.grey[400],
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              hasValue ? value : "Not provided",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: hasValue ? const Color(0xFF001E26) : Colors.grey[400],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String formatDateTime(dynamic raw) {
  if (raw == null || raw.toString().isEmpty || raw == "null") {
    return "Not provided";
  }
  try {
    DateTime dt;
    if (raw is Map) {
      final dateString = raw[r'$date']?.toString();
      if (dateString != null) {
        dt = DateTime.parse(dateString);
      } else {
        return "Not provided";
      }
    } else {
      dt = DateTime.parse(raw.toString());
    }
    return DateFormat('dd MMM yyyy').format(dt);
  } catch (e) {
    return "Not provided";
  }
}
