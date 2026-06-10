import 'dart:io';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:hrmappfrontend/intern/RESIGNATION.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path/path.dart' as p;
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:http_parser/http_parser.dart';

class InternProfilepage extends StatefulWidget {
  final Map<String, dynamic>? internData;

  const InternProfilepage({required this.internData, super.key});

  @override
  State<InternProfilepage> createState() => _InternProfilepageState();
}

class _InternProfilepageState extends State<InternProfilepage> {
  String? _profileImagePath;
  bool _isImageLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfileImage();
  }

  Future<void> _loadProfileImage() async {
    final String internId = widget.internData?['internid'] ?? 'unknown';
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _profileImagePath = prefs.getString('profile_pic_$internId');
      _isImageLoading = false;
    });
  }

  Future<void> _removeProfilePicture() async {
    final String internId = widget.internData?['internid'] ?? 'unknown';
    final prefs = await SharedPreferences.getInstance();

    // Optionally delete the file if it exists
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

    await prefs.remove('profile_pic_$internId');
    setState(() {
      _profileImagePath = null;
    });

    if (mounted) {
      Navigator.pop(context); // Close the sheet
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile picture removed')),
      );
    }
  }

  Future<void> _saveImagePermanently(String imagePath) async {
    final String internId = widget.internData?['internid'] ?? 'unknown';
    final directory = await getApplicationDocumentsDirectory();

    // 1. Delete old profile images for this user to save space and avoid conflicts
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

    // 2. Generate a unique filename using timestamp to bust the image cache
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final fileName = 'profile_${internId}_$timestamp${p.extension(imagePath)}';
    final permanentPath = '${directory.path}/$fileName';

    // 3. Copy the new image to the application directory
    final File imageFile = File(imagePath);
    await imageFile.copy(permanentPath);

    // 4. Save the new path to SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('profile_pic_$internId', permanentPath);

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

      // Manually read token from SharedPreferences and attach it
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
      // Permission Handling
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
          // Android 13+ (SDK 33) doesn't use READ_EXTERNAL_STORAGE for media
          if (androidInfo.version.sdkInt < 33) {
            var status = await Permission.storage.request();
            if (status.isDenied || status.isPermanentlyDenied) {
              if (mounted) _showPermissionDialog('Storage');
              return;
            }
          }
          // Note: Android 13+ handles photo picking via system picker, 
          // usually doesn't need manual Permission.photos.request() for image_picker.
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
          Navigator.pop(context); // Close the source sheet
        }
      }
    } catch (e) {
      debugPrint("Error picking image: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error picking image: ${e.toString().split("\n").first}'),
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
        content: Text(
          'Please allow $type access in settings to update your profile picture.',
        ),
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
                    letterSpacing: -0.5,
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
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 10,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Cancel',
                style: TextStyle(
                  color: Color(0xFF00657F),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00657F),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 22,
                  vertical: 10,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text(
                'Logout',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        );
      },
    );

    if (shouldLogout != true) return;

    final prefs = await SharedPreferences.getInstance();

    // Preserve profile picture paths for all users if they exist
    // Get all keys starting with profile_pic_
    final allKeys = prefs.getKeys();
    final profilePicData = <String, String>{};
    for (String key in allKeys) {
      if (key.startsWith('profile_pic_')) {
        profilePicData[key] = prefs.getString(key)!;
      }
    }

    await prefs.clear();

    // Restore profile picture data
    profilePicData.forEach((key, value) async {
      await prefs.setString(key, value);
    });

    if (!mounted) return;

    // Clear the stack and go to home screen
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => homescreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.internData;
    if (data == null) {
      return const Scaffold(body: Center(child: Text("No Data Found")));
    }

    final String internId = data['internid'] ?? '';
    final String internName = data['fullName'] ?? '';
    final String department = data['role'] ?? '';
    final String status = data['status'] ?? '';
    final String email = data['email'] ?? '';
    final String contact = data['contact'] ?? '';
    final String emergencyContact = data['emergencyContact'] ?? '';
    final String linkedin = data['linkedin'] ?? '';
    final String internshipType = data['internshipType'] ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        centerTitle: true,
        title: const Text(
          "Personal Profile",
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
                                  internName.isEmpty ? 'Unknown Name' : internName,
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
                                  value: contact,
                                  onTap: () => _launchPhone(context, contact),
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
                                    color: const Color(0xFF0EA5E9).withOpacity(0.2),
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
                                        backgroundColor: const Color(0xFF0EA5E9),
                                        backgroundImage: _profileImagePath != null
                                            ? FileImage(File(_profileImagePath!))
                                            : null,
                                        child: _profileImagePath == null
                                            ? Text(
                                                internName.isNotEmpty
                                                    ? internName[0].toUpperCase()
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

                  // Basic Information
                  _FadeInWrapper(
                    delay: 200,
                    child: _SectionContainer(
                      children: [
                        const _SectionHeader(title: 'Basic Information'),
                        const SizedBox(height: 20),
                        _InfoRow(Icons.person_2, 'Intern ID', internId),
                        _InfoRow(
                          Icons.business_rounded,
                          'Department',
                          data['department'] ?? '',
                        ),
                        _InfoRow(
                          Icons.work_outline_rounded,
                          'Role',
                          department,
                        ),
                        _InfoRow(
                          Icons.school_outlined,
                          'College',
                          data['college'] ?? '',
                        ),
                        _InfoRow(
                          Icons.calendar_month_outlined,
                          'Year',
                          data['year'] ?? '',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Timeline
                  _FadeInWrapper(
                    delay: 400,
                    child: _SectionContainer(
                      children: [
                        const _SectionHeader(title: 'Professional Timeline'),
                        const SizedBox(height: 20),
                        _InfoRow(
                          Icons.event_available_outlined,
                          'Onboarding Date',
                          formatDateTime(data['onboardingDate']),
                        ),
                        _InfoRow(
                          Icons.event_busy_outlined,
                          'End Date',
                          formatDateTime(data['endDate']),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Contact Details
                  _FadeInWrapper(
                    delay: 600,
                    child: _SectionContainer(
                      children: [
                        const _SectionHeader(title: 'Contact Details'),
                        const SizedBox(height: 20),
                        _InfoRow(
                          Icons.phone_iphone_rounded,
                          'Contact',
                          contact,
                        ),
                        _InfoRow(
                          Icons.contact_emergency_outlined,
                          'Emergency Contact',
                          emergencyContact,
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

          // Bottom buttons (kept, design polished)
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
                        gradient: status.toLowerCase() == 'ongoing'
                            ? const LinearGradient(
                                colors: [Color(0xFFD32F2F), Color(0xFFB00020)],
                              )
                            : null,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: ElevatedButton.icon(
                        onPressed: status.toLowerCase() == 'ongoing'
                            ? () {
                                Navigator.pushReplacement(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => TerminationForm(
                                      internName: internName,
                                      internId: internId,
                                      department: department,
                                    ),
                                  ),
                                );
                              }
                            : null,
                        icon: Icon(
                          Icons.person_remove_rounded,
                          size: 22,
                          color: status.toLowerCase() == 'ongoing'
                              ? Colors.white
                              : Colors.grey[500],
                        ),
                        label: Text(
                          "Request Offboarding",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                            color: status.toLowerCase() == 'ongoing'
                                ? Colors.white
                                : Colors.grey[500],
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          disabledBackgroundColor: Colors.grey[200],
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

  // Launch helpers (same behaviour as in InternFullDetails)

  static Future<void> _launchEmail(BuildContext context, String email) async {
    if (email.isEmpty) return;
    final Uri uri = Uri.parse('mailto:$email');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not launch email app')),
          );
        }
      }
    } catch (e) {
      debugPrint('Error launching email: $e');
    }
  }

  static Future<void> _launchPhone(BuildContext context, String phone) async {
    if (phone.isEmpty) return;
    // Remove spaces and special characters for tel URI
    final String cleanPhone = phone.replaceAll(RegExp(r'\s+'), '');
    final Uri uri = Uri.parse('tel:$cleanPhone');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not launch phone app')),
          );
        }
      }
    } catch (e) {
      debugPrint('Error launching phone: $e');
    }
  }

  static Future<void> _launchLinkedIn(BuildContext context, String url) async {
    if (url.isEmpty) return;

    String normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') &&
        !normalizedUrl.startsWith('https://')) {
      if (normalizedUrl.contains('linkedin.com')) {
        normalizedUrl = 'https://$normalizedUrl';
      } else {
        // Assume it's a profile handle if it's just a username
        normalizedUrl = 'https://www.linkedin.com/in/$normalizedUrl';
      }
    }

    final Uri? uri = Uri.tryParse(normalizedUrl);
    if (uri == null) return;

    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        // Fallback: try launching directly as external application
        bool launched = await launchUrl(
          uri,
          mode: LaunchMode.externalApplication,
        );
        if (!launched && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open LinkedIn profile')),
          );
        }
      }
    } catch (e) {
      debugPrint('Error launching LinkedIn: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Error opening LinkedIn')));
      }
    }
  }
}

// ===== UI helpers (replicated) =====
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
        icon = Icons.account_balance_wallet_sharp;
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
        border: Border.all(
          color: const Color(0xFF00657F).withOpacity(0.08),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
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
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00657F).withOpacity(0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.link_rounded,
              size: 20,
              color: Color(0xFF00657F),
            ),
          ),
          const SizedBox(width: 14),
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
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 2),
                GestureDetector(
                  onTap: hasUrl ? onTap : null,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          hasUrl ? 'View Profile' : 'Not provided',
                          style: TextStyle(
                            fontSize: 15,
                            color: hasUrl
                                ? const Color(0xFF00657F)
                                : Colors.grey[400],
                            fontWeight: hasUrl
                                ? FontWeight.w700
                                : FontWeight.w400,
                          ),
                        ),
                      ),
                      if (hasUrl) ...[
                        const SizedBox(width: 4),
                        const Icon(
                          Icons.open_in_new_rounded,
                          size: 14,
                          color: Color(0xFF00657F),
                        ),
                      ],
                    ],
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

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final displayValue = value.isEmpty
        ? 'Not provided'
        : value.toString().trim();
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00657F).withOpacity(0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: const Color(0xFF00657F)),
          ),
          const SizedBox(width: 14),
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
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  displayValue,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Color(0xFF001E26),
                    fontWeight: FontWeight.w600,
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

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    IconData icon;

    switch (status.toLowerCase()) {
      case 'approved':
      case 'ongoing':
        color = const Color(0xFF2E7D32);
        icon = Icons.check_circle_rounded;
        break;
      case 'completed':
        color = const Color(0xFF00657F);
        icon = Icons.verified_rounded;
        break;
      case 'drop':
      case 'rejected':
        color = const Color(0xFFB00020);
        icon = Icons.cancel_rounded;
        break;
      default:
        color = const Color(0xFFFFA726);
        icon = Icons.pending_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            status.isEmpty ? 'N/A' : status.toUpperCase(),
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.8,
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
    final isEnabled = label.isNotEmpty;

    return GestureDetector(
      onTap: isEnabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isEnabled ? Colors.white : Colors.grey[50],
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isEnabled
                ? const Color(0xFF00657F).withOpacity(0.12)
                : Colors.grey[200]!,
          ),
          boxShadow: isEnabled
              ? [
                  BoxShadow(
                    color: const Color(0xFF00657F).withOpacity(0.06),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 20,
              color: isEnabled ? const Color(0xFF00657F) : Colors.grey[400],
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label.isEmpty ? 'N/A' : label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isEnabled ? const Color(0xFF001E26) : Colors.grey[400],
                ),
              ),
            ),
          ],
        ),
      ),
    );
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
  if (raw == null) return "Not provided";
  try {
    final dt = DateTime.parse(raw.toString());
    return DateFormat('dd MMM yyyy').format(dt);
  } catch (_) {
    return raw.toString();
  }
}

class _FadeInWrapper extends StatefulWidget {
  final Widget child;
  final int delay;

  const _FadeInWrapper({required this.child, required this.delay});

  @override
  State<_FadeInWrapper> createState() => _FadeInWrapperState();
}

class _FadeInWrapperState extends State<_FadeInWrapper> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) {
        setState(() {
          _visible = true;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeOut,
      opacity: _visible ? 1.0 : 0.0,
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(top: _visible ? 0 : 20),
        child: widget.child,
      ),
    );
  }
}

// ===== Image Picker Option Widget =====
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
    final themeColor = color ?? const Color(0xFF0EA5E9);

    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: themeColor.withOpacity(0.1),
              shape: BoxShape.circle,
              border: Border.all(
                color: themeColor.withOpacity(0.2),
                width: 1,
              ),
            ),
            child: Icon(icon, color: themeColor, size: 28),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: themeColor,
            ),
          ),
        ],
      ),
    );
  }
}
