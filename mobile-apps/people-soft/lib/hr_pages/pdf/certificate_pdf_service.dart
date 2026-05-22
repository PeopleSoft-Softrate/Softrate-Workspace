import 'dart:io';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/hr_pages/intern_resignation.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart' show Printing, PdfRaster;

String formatDate(String isoDate) {
  final dateTime = DateTime.parse(isoDate);
  final formatter = DateFormat('dd MMM yyyy');
  return formatter.format(dateTime);
}

String capitalizeFullName(String name) {
  return name
      .trim()
      .split(RegExp(r'\s+')) // split by spaces
      .map((word) {
        if (word.isEmpty) return word;
        return word[0].toUpperCase() + word.substring(1).toLowerCase();
      })
      .join(' ');
}

String getInternshipTitle(String role) {
  final Map<String, String> roleMap = {
    'Web developer Intern': 'Web Development',
    'App developer Intern': 'App Development',
    'Artificial Intelligence Intern': 'Artificial Intelligence',
    'Data Analyst Intern': 'Data Analysis',
    'Cybersecurity Analyst Intern': 'Cybersecurity',
    'Networking Analyst Intern': 'Networking',
    'Graphics Designer Intern': 'Graphic Design',
    'Digital marketing Intern': 'Digital Marketing',
    'Business developer (Sales) Intern': 'Business Development (Sales)',
    'Research & Development (R&D) Intern': 'Research & Development (R&D)',
    'HR Analyst Intern': 'Human Resources',
  };

  final baseTitle =
      roleMap[role] ??
      role.replaceAll(RegExp(r'\bIntern\b', caseSensitive: false), '').trim();

  return baseTitle;
}

class CertificatePdfService {
  static Future<void> internship(
    ResignationRequest req,
    String title,
    InternDetails intern,
  ) async {
    final pdf = pw.Document();

    // ───────────── ASSETS ─────────────
    final logo = pw.MemoryImage(
      (await rootBundle.load(
        'assets/images/pdf_logo.png',
      )).buffer.asUint8List(),
    );

    final qr = pw.MemoryImage(
      (await rootBundle.load('assets/images/qr.png')).buffer.asUint8List(),
    );

    final signature = pw.MemoryImage(
      (await rootBundle.load(
        'assets/images/signature.png',
      )).buffer.asUint8List(),
    );

    final roman = pw.Font.ttf(
      await rootBundle.load('assets/fonts/Canterbury.ttf'),
    );

    final regular = pw.Font.ttf(
      await rootBundle.load('assets/fonts/TimesNewRoman.ttf'),
    );

    final bold = pw.Font.ttf(
      await rootBundle.load('assets/fonts/TimesNewRomanBold.ttf'),
    );

    const double v = 14;

    pdf.addPage(
      pw.Page(
        margin: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        build: (context) {
          final titleColor = PdfColor.fromInt(0xFF222222);
          final headerColor = PdfColor.fromInt(0xFF444444);
          final footerColor = PdfColor.fromInt(0xFF555555);

          return pw.Container(
            decoration: pw.BoxDecoration(
              border: pw.Border.all(
                width: 2,
                color: PdfColor.fromHex('#A0BBB5'),
              ),
            ),
            padding: const pw.EdgeInsets.all(24),
            child: pw.Stack(
              children: [
                /// ================= MAIN =================
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                  /// HEADER
                  pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Image(logo, width: 180),

                      pw.Spacer(),

                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.end,
                        children: [
                          pw.SizedBox(height: 30),
                          pw.Text(
                            "SOFTRATE  TECHNOLOGIES  (P)  LTD",
                            style: pw.TextStyle(
                              font: bold,
                              fontSize: 14.5,
                              letterSpacing: 2,
                              color: headerColor,
                            ),
                          ),
                          pw.SizedBox(height: 3),
                          pw.Text(
                            "SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122",
                            style: pw.TextStyle(
                              font: regular,
                              fontSize: 11,
                              height: 1.4,
                              color: headerColor,
                            ),
                          ),
                          pw.SizedBox(height: 3),
                          pw.Text(
                            "(+91) 8148633580  |  helpdesk@softrateglobal.com",
                            style: pw.TextStyle(
                              font: regular,
                              fontSize: 11,
                              color: headerColor,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  pw.SizedBox(height: 90),

                  /// TITLE
                  pw.Center(
                    child: pw.Text(
                      "Certificate Of Internship Completion",
                      style: pw.TextStyle(
                        font: roman,
                        fontSize: 33.5,
                        letterSpacing: 0.8,
                        color: titleColor,
                      ),
                    ),
                  ),

                  pw.SizedBox(height: v * 3),

                  /// BODY (FIXED WIDTH = VISUAL CENTER)
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      /// Line 1
                      pw.Row(
                        children: [
                          pw.Text(
                            "This  is  to  certify  that  ",
                            style: pw.TextStyle(
                              font: regular,
                              fontSize: 14,
                              letterSpacing: 0.8,
                            ),
                          ),
                          pw.Expanded(
                            child: pw.Container(
                              padding: const pw.EdgeInsets.only(bottom: 2),
                              alignment: pw.Alignment.center,
                              decoration: const pw.BoxDecoration(
                                border: pw.Border(
                                  bottom: pw.BorderSide(width: 0.5),
                                ),
                              ),
                              child: pw.Text(
                                capitalizeFullName(intern.fullName),
                                textAlign: pw.TextAlign.center,
                                style: pw.TextStyle(
                                  font: bold,
                                  fontSize: 18,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                          ),
                          pw.Text(
                            "   has",
                            style: pw.TextStyle(
                              font: regular,
                              fontSize: 14,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),

                      pw.SizedBox(height: 14),

                      /// Line 2
                      pw.Row(
                        children: [
                          pw.Text(
                            "successfully  completed  a/an  ",
                            style: pw.TextStyle(
                              font: regular,
                              fontSize: 14,
                              letterSpacing: 0.8,
                            ),
                          ),
                          pw.Expanded(
                            child: pw.Container(
                              margin: const pw.EdgeInsets.only(bottom: 2),
                              alignment: pw.Alignment.center,
                              decoration: const pw.BoxDecoration(
                                border: pw.Border(
                                  bottom: pw.BorderSide(width: 0.5),
                                ),
                              ),
                              child: pw.Text(
                                getInternshipTitle(intern.role),
                                style: pw.TextStyle(
                                  font: bold,
                                  fontSize: 14,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),

                      pw.SizedBox(height: 14),

                      /// Line 3
                      pw.Text(
                        "internship   at   Softrate   Technologies  (Softrate   Tech   Park,  Chennai)   from",
                        style: pw.TextStyle(
                          font: regular,
                          fontSize: 14,
                          letterSpacing: 0.85,
                        ),
                      ),

                      pw.SizedBox(height: 14),

                      /// Line 4
                      pw.Row(
                        children: [
                          pw.Expanded(
                            child: pw.Container(
                              margin: const pw.EdgeInsets.only(bottom: 2),
                              alignment: pw.Alignment.center,
                              decoration: const pw.BoxDecoration(
                                border: pw.Border(
                                  bottom: pw.BorderSide(width: 0.5),
                                ),
                              ),
                              child: pw.Text(
                                formatDate(
                                  intern.joiningDate,
                                ), // formatted here
                                style: pw.TextStyle(
                                  font: regular,
                                  fontSize: 14,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                          ),
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(
                              horizontal: 10,
                            ),
                            child: pw.Text(
                              "  to  ",
                              style: pw.TextStyle(
                                font: regular,
                                fontSize: 14,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ),
                          pw.Expanded(
                            child: pw.Container(
                              margin: const pw.EdgeInsets.only(bottom: 2),
                              alignment: pw.Alignment.center,
                              decoration: const pw.BoxDecoration(
                                border: pw.Border(
                                  bottom: pw.BorderSide(width: 0.5),
                                ),
                              ),
                              child: pw.Text(
                                formatDate(
                                  intern.lastWorkingDay,
                                ), // formatted here
                                style: pw.TextStyle(
                                  font: regular,
                                  fontSize: 14,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                          ),
                          pw.Text(
                            ".  During  this   period,  he/she  ",
                            style: pw.TextStyle(
                              font: regular,
                              fontSize: 14,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),

                      pw.SizedBox(height: 14),

                      /// Line 5
                      pw.Text(
                        "demonstrated  dedication,  professionalism,  willingness  to  learn,  and  contributed",
                        style: pw.TextStyle(
                          font: regular,
                          fontSize: 14,
                          letterSpacing: 0.5,
                        ),
                      ),

                      pw.SizedBox(height: 14),

                      /// Line 6
                      pw.Text(
                        "to  various  projects  at  our  organization.",
                        style: pw.TextStyle(
                          font: regular,
                          fontSize: 14,
                          letterSpacing: 0.5,
                        ),
                      ),

                      pw.SizedBox(height: 50),

                      /// Closing line
                      pw.Text(
                        "We  wish  him/her  success  in  future  endeavors.",
                        style: pw.TextStyle(
                          font: regular,
                          fontSize: 14,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  pw.Spacer(),

                  /// SIGNATURE
                  pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            "Best wishes,",
                            style: pw.TextStyle(font: regular, fontSize: 12),
                          ),
                          pw.SizedBox(height: 6),
                          pw.Image(signature, width: 110),
                          pw.SizedBox(height: 6),
                          pw.Text(
                            "HR Manager,",
                            style: pw.TextStyle(font: bold, fontSize: 12),
                          ),
                          pw.Text(
                            "Softrate Technologies Pvt. Ltd.",
                            style: pw.TextStyle(font: regular, fontSize: 12),
                          ),
                        ],
                      ),
                      pw.Spacer(),
                      pw.Image(qr, width: 140),
                    ],
                  ),

                  pw.SizedBox(
                    height: 50,
                  ), // Reserve space for footer so content never overlaps
                ],
              ),

              /// ================= FOOTER =================
              pw.Positioned(
                bottom: 18,
                right: 20,
                left: 0,
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      "#PeopleFirstCompany",
                      style: pw.TextStyle(
                        font: bold,
                        fontSize: 10,
                        color: footerColor,
                      ),
                    ),
                    pw.Text(
                      "CID: ${intern.internId}",
                      style: pw.TextStyle(
                        font: bold,
                        fontSize: 10,
                        color: footerColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    ),
  );

    final dir = await getApplicationDocumentsDirectory();
    final file = File("${dir.path}/${intern.internId}_Internship_Certificate.pdf");

    if (await file.exists()) {
      await file.delete();
    }

    final originalBytes = await pdf.save();

    final flatBytes = await _flattenPdf(originalBytes);

    await file.writeAsBytes(
      flatBytes,
      flush: true,
    );

  }

static Future<Uint8List> _flattenPdf(Uint8List originalPdfBytes, {PdfPageFormat? format}) async {
  final pages = Printing.raster(originalPdfBytes, dpi: 300);
  final flattenedPdf = pw.Document();

  await for (final page in pages) {
    // Get the raw ui.Image from the raster so we can composite it.
    final uiImage = await page.toImage();
    final w = uiImage.width.toDouble();
    final h = uiImage.height.toDouble();

    // Draw page onto a white background to replace transparent pixels.
    final recorder = PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = Colors.white,
    );
    canvas.drawImage(uiImage, Offset.zero, Paint());
    final picture = recorder.endRecording();
    final composited = await picture.toImage(uiImage.width, uiImage.height);
    final byteData = await composited.toByteData(format: ImageByteFormat.png);
    if (byteData == null) continue;

    final pngBytes = byteData.buffer.asUint8List();

    flattenedPdf.addPage(
      pw.Page(
        pageFormat: format ?? PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        build: (_) {
          return pw.Image(
            pw.MemoryImage(pngBytes),
            fit: pw.BoxFit.fill,
          );
        },
      ),
    );
  }

  return flattenedPdf.save();
}






  static Future<void> project(ResignationRequest req, String title) async {
    final pdf = pw.Document();

    // Load custom font
    final fontData = await rootBundle.load("assets/fonts/TimesNewRoman.ttf");
    final ttf = pw.Font.ttf(fontData);

    // Load template PDF
    final templateBytes = await rootBundle.load(
      "assets/pdf/Softrate Project final.pdf",
    );
    final templateData = templateBytes.buffer.asUint8List();

    // Rasterize the first page
    PdfRaster? rasterPage;
    await for (final page in Printing.raster(templateData, dpi: 144)) {
      rasterPage = page;
      break;
    }

    if (rasterPage == null) {
      debugPrint("❌ Raster failed");
      return;
    }

    // Convert raster to PNG bytes
    final pngBytes = await rasterPage.toPng();
    final templateImage = pw.MemoryImage(pngBytes);

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: pw.EdgeInsets.zero, // ← remove default margins
        build: (ctx) => pw.Stack(
          children: [
            // Full-bleed template background
            pw.Positioned.fill(
              child: pw.Image(templateImage, fit: pw.BoxFit.cover),
            ),

            // Name overlay
            pw.Positioned.fill(
              // top: 250,
              child: pw.Align(
                alignment: pw.Alignment.topCenter,
                child: pw.Transform.translate(
                  offset: const PdfPoint(90, -15),
                  child: pw.Container(
                    constraints: const pw.BoxConstraints(maxWidth: 600),
                    alignment: pw.Alignment.center,
                    child: pw.Text(
                      capitalizeFullName(req.internName),
                      textAlign: pw.TextAlign.center,
                      softWrap: true,
                      style: pw.TextStyle(
                        font: ttf,
                        fontSize: 36,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColors.black,
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // Title overlay

            // CID overlay
            pw.Positioned(
              left: 250,
              bottom: 20,
              child: pw.Text(
                "CID: ${req.internId}",
                style: pw.TextStyle(
                  font: ttf,
                  fontWeight: pw.FontWeight.bold,
                  fontSize: 14,
                  color: PdfColors.black,
                ),
              ),
            ),
          ],
        ),
      ),
    );

    // Save PDF
    final dir = await getApplicationDocumentsDirectory();
    final file = File("${dir.path}/${req.internId}_Project_Certificate.pdf");

    // Delete old file if exists
    if (file.existsSync()) {
      await file.delete();
    }

    // Save new PDF
    final originalBytes = await pdf.save();
    final flatBytes = await _flattenPdf(originalBytes, format: PdfPageFormat.a4.landscape);
    await file.writeAsBytes(flatBytes);

    debugPrint("✅ Project Certificate saved: ${file.path}");
  }

  static Future<void> lor(
    ResignationRequest req,
    String title,
    InternDetails intern,
  ) async {
    final pdf = pw.Document();

    // ─────────── ASSETS ───────────
    final logo = pw.MemoryImage(
      (await rootBundle.load(
        'assets/images/pdf_logo.png',
      )).buffer.asUint8List(),
    );


    final signature = pw.MemoryImage(
      (await rootBundle.load(
        'assets/images/signature.png',
      )).buffer.asUint8List(),
    );

    final regular = pw.Font.ttf(
      await rootBundle.load('assets/fonts/TimesNewRoman.ttf'),
    );

    final bold = pw.Font.ttf(
      await rootBundle.load('assets/fonts/TimesNewRomanBold.ttf'),
    );

    // Prefix logic (simple version)
    final prefix = title.trim(); // e.g., Mr. / Ms. / Dr.

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        build: (context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(24),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
              // ==== MAIN TITLE (CENTER) ====
              pw.Text(
                "Letter of Recommendation",
                style: pw.TextStyle(font: bold, fontSize: 23),
              ),

              pw.SizedBox(height: 45),

              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  // LEFT MARGIN BEFORE LINE
                  pw.SizedBox(width: 26),

                  // LEFT VERTICAL LINE
                  pw.Container(width: 1, height: 510, color: PdfColors.black),

                  // GAP BETWEEN LINE & CONTENT
                  pw.SizedBox(width: 34),

                  // RIGHT CONTENT
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          "$prefix. ${capitalizeFullName(intern.fullName)}",
                          style: pw.TextStyle(font: bold, fontSize: 14),
                        ),
                        pw.SizedBox(height: 6),

                        pw.Text(
                          intern.role,
                          style: pw.TextStyle(font: regular, fontSize: 12),
                        ),
                        pw.SizedBox(height: 6),

                        pw.Text(
                          "Softrate Technologies Private Limited (Chennai)",
                          style: pw.TextStyle(font: regular, fontSize: 12),
                        ),

                        pw.SizedBox(height: 28),

                        pw.Text(
                          "To Whom It May Concern,",
                          style: pw.TextStyle(font: bold, fontSize: 13),
                        ),

                        pw.SizedBox(height: 22),

                        pw.Text(
                          "I am pleased to recommend $prefix. ${capitalizeFullName(intern.fullName)}, who has been associated with Softrate as a ${intern.role}. During their time with us, they demonstrated a high level of professionalism, a strong work ethic, and a keen willingness to learn.",
                          style: pw.TextStyle(
                            font: regular,
                            fontSize: 13,
                            height: 2,
                          ),
                        ),

                        pw.SizedBox(height: 20),

                        pw.Text(
                          "They approached their responsibilities with commitment and showed the ability to adapt quickly to new challenges. Their communication skills, attention to detail, and collaborative approach contributed positively to the team’s objectives.",
                          style: pw.TextStyle(
                            font: regular,
                            fontSize: 13,
                            height: 2,
                          ),
                        ),

                        pw.SizedBox(height: 20),

                        pw.Text(
                          "We extend our best wishes in all their future endeavors.",
                          style: pw.TextStyle(
                            font: regular,
                            fontSize: 13,
                            height: 2,
                          ),
                        ),

                        pw.SizedBox(height: 28),

                        pw.Text(
                          "Date : ${DateFormat('dd.MM.yyyy').format(DateTime.now())}",
                          style: pw.TextStyle(font: regular, fontSize: 11),
                        ),

                        pw.SizedBox(height: 28),

                        pw.Text(
                          "Kudos,",
                          style: pw.TextStyle(font: regular, fontSize: 12),
                        ),
                        pw.SizedBox(height: 10),

                        pw.Image(signature, width: 110),

                        pw.SizedBox(height: 5),

                        pw.Text(
                          "Maaya Iyer",
                          style: pw.TextStyle(font: bold, fontSize: 17),
                        ),
                        pw.SizedBox(height: 3),

                        pw.Text(
                          "HR Manager",
                          style: pw.TextStyle(font: regular, fontSize: 12),
                        ),
                        pw.Text(
                          "Softrate Global",
                          style: pw.TextStyle(font: regular, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              pw.Spacer(),

              // FOOTER
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Image(logo, width: 140),

                  pw.Spacer(),
                  
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      
                      pw.Text(
                        "Softrate Tech Park, Mangadu, Chennai - 600 122",
                        style: pw.TextStyle(font: regular, fontSize: 10),
                      ),
                      pw.SizedBox(height: 3),
                      pw.UrlLink(
                        destination: "https://www.softrateglobal.com",
                        child: pw.Text(
                          "www.softrateglobal.com",
                          style: pw.TextStyle(
                            font: regular,
                            fontSize: 10,
                            color: PdfColors.black, // no underline, no blue
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );

    // Save PDF
    final dir = await getApplicationDocumentsDirectory();
    final file = File("${dir.path}/${intern.internId}_LOR.pdf");

    if (await file.exists()) {
      await file.delete();
    }

    final originalBytes = await pdf.save();
    final flatBytes = await _flattenPdf(originalBytes);
    await file.writeAsBytes(flatBytes);
  }
}
