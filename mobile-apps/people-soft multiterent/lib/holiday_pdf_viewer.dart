import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:syncfusion_flutter_core/theme.dart';

class HolidayPdfViewer extends StatelessWidget {
  final String pdfPath;
  final String title;
  final bool isAsset;

  const HolidayPdfViewer({
    super.key,
    required this.pdfPath,
    required this.title,
    this.isAsset = true,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      body: SfPdfViewerTheme(
        data: SfPdfViewerThemeData(backgroundColor: Colors.white),
        child: isAsset
            ? SfPdfViewer.asset(
                pdfPath,
                canShowScrollHead: true,
                canShowPaginationDialog: true,
              )
            : SfPdfViewer.network(
                pdfPath,
                canShowScrollHead: true,
                canShowPaginationDialog: true,
              ),
      ),
    );
  }
}
