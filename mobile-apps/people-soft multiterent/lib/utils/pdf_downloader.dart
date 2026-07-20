import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:open_filex/open_filex.dart';

class PdfDownloader {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initNotifications() async {
    if (_initialized) return;
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings();
    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _notificationsPlugin.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) async {
        if (response.payload != null) {
          try {
            await OpenFilex.open(response.payload!);
          } catch (e) {
            print("Could not open file: $e");
          }
        }
      },
    );
    _initialized = true;
  }

  static Future<bool> downloadPdf(String url, String fileName) async {
    try {
      await initNotifications();

      if (Platform.isAndroid) {
        if (await Permission.notification.isDenied) {
          await Permission.notification.request();
        }
        if (await Permission.storage.isDenied) {
          await Permission.storage.request();
        }
      }

      Directory? directory;
      if (Platform.isAndroid) {
        directory = Directory('/storage/emulated/0/Download');
        if (!await directory.exists()) {
          directory = await getExternalStorageDirectory();
        }
      } else {
        directory = await getApplicationDocumentsDirectory();
      }

      if (directory == null) return false;

      // Append a timestamp to make the file unique and force media scanner updates
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final uniqueFileName = fileName.replaceAll('.pdf', '_$timestamp.pdf');
      final savePath = '${directory.path}/$uniqueFileName';
      
      final dio = Dio();
      await dio.download(url, savePath);

      await _showNotification(uniqueFileName, savePath);
      return true;
    } catch (e) {
      print('Download error: $e');
      return false;
    }
  }

  static Future<void> _showNotification(String fileName, String filePath) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'download_channel',
      'Downloads',
      channelDescription: 'Notifications for downloaded files',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );
    const NotificationDetails platformDetails =
        NotificationDetails(android: androidDetails);

    await _notificationsPlugin.show(
      id: 0,
      title: 'Download Complete',
      body: '$fileName downloaded successfully.',
      notificationDetails: platformDetails,
      payload: filePath,
    );
  }
}
