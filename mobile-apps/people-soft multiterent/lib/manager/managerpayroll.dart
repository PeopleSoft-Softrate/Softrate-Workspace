import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';

class ManagerPayrollPage extends StatefulWidget {
  const ManagerPayrollPage({super.key});

  @override
  State<ManagerPayrollPage> createState() => _ManagerPayrollPageState();
}

class _ManagerPayrollPageState extends State<ManagerPayrollPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Fintech-inspired Theme Colors
  static const Color primaryColor = Color(0xFF0F172A);
  static const Color accentColor = Color(0xFF6366F1); // Indigo
  static const Color backgroundColor = Color(0xFFF8FAFC);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  String selectedMonth = "All";
  String selectedYear = DateTime.now().year.toString();

  final List<String> months = [
    "All",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  final List<String> years = List.generate(3, (i) {
    final y = DateTime.now().year - i;
    return y.toString();
  });

  // Salary Components (Exact Numbers)
  final double basicSalary = 35000.0;
  final double specialAllowance = 8000.0;
  final double conveyance = 2000.0;
  final double lta = 5000.0;
  final double medicalAllowance = 3000.0;

  final double epf = 1800.0;
  final double professionalTax = 200.0;
  final double tds = 2500.0;
  final double insurance = 500.0;

  double get grossEarnings =>
      basicSalary + specialAllowance + conveyance + lta + medicalAllowance;
  double get totalDeductions => epf + professionalTax + tds + insurance;
  double get netSalary => grossEarnings - totalDeductions;

  final NumberFormat currencyFormatter = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 2,
  );

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _generatePdf({String? monthYear}) async {
    final pdf = pw.Document();
    final font = await PdfGoogleFonts.notoSansRegular();
    final boldFont = await PdfGoogleFonts.notoSansBold();
    final targetMonth = monthYear ?? "April 2024";

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(24),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.black, width: 1),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Header section
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          "Softrate Tech Park",
                          style: pw.TextStyle(
                            font: boldFont,
                            fontSize: 18,
                            color: PdfColors.blue900,
                          ),
                        ),
                        pw.Text(
                          "Mangadu Chennai, Tamil Nadu, India",
                          style: pw.TextStyle(font: font, fontSize: 10),
                        ),
                        pw.Text(
                          "Contact: +91 98765 43210",
                          style: pw.TextStyle(font: font, fontSize: 10),
                        ),
                      ],
                    ),
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      children: [
                        pw.Text(
                          "PAYSLIP",
                          style: pw.TextStyle(
                            font: boldFont,
                            fontSize: 20,
                            color: PdfColors.blueGrey900,
                          ),
                        ),
                        pw.Text(
                          "Month: $targetMonth",
                          style: pw.TextStyle(font: boldFont, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 20),
                pw.Divider(thickness: 1),
                pw.SizedBox(height: 15),

                // Employee Details Section
                pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          _detailRow("Employee ID", "MG001", font, boldFont),
                          _detailRow("Name", "Manager", font, boldFont),
                          _detailRow(
                            "Designation",
                            "Senior Executive",
                            font,
                            boldFont,
                          ),
                          _detailRow(
                            "Department",
                            "Management",
                            font,
                            boldFont,
                          ),
                        ],
                      ),
                    ),
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          _detailRow("DOJ", "01 Jan 2023", font, boldFont),
                          _detailRow(
                            "Bank A/c No",
                            "XXXX 5432",
                            font,
                            boldFont,
                          ),
                          _detailRow("PAN No", "ABCDE1234F", font, boldFont),
                          _detailRow("UAN No", "100234567890", font, boldFont),
                        ],
                      ),
                    ),
                  ],
                ),
                pw.SizedBox(height: 25),

                // Main Payroll Table Structure
                pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    // Earnings Column
                    pw.Expanded(
                      child: pw.Container(
                        decoration: pw.BoxDecoration(
                          border: pw.Border.all(color: PdfColors.grey400),
                        ),
                        child: pw.Column(
                          children: [
                            pw.Container(
                              width: double.infinity,
                              padding: const pw.EdgeInsets.all(5),
                              color: PdfColors.grey200,
                              child: pw.Text(
                                "EARNINGS",
                                textAlign: pw.TextAlign.center,
                                style: pw.TextStyle(
                                  font: boldFont,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                            _tableRow("Basic Salary", basicSalary, font),
                            _tableRow(
                              "Special Allowance",
                              specialAllowance,
                              font,
                            ),
                            _tableRow("Conveyance", conveyance, font),
                            _tableRow("LTA", lta, font),
                            _tableRow(
                              "Medical Allowance",
                              medicalAllowance,
                              font,
                            ),
                            pw.SizedBox(height: 40), // Placeholder for balance
                            pw.Divider(color: PdfColors.grey400),
                            pw.Padding(
                              padding: const pw.EdgeInsets.all(8),
                              child: pw.Row(
                                mainAxisAlignment:
                                    pw.MainAxisAlignment.spaceBetween,
                                children: [
                                  pw.Text(
                                    "Gross Earnings",
                                    style: pw.TextStyle(
                                      font: boldFont,
                                      fontSize: 11,
                                    ),
                                  ),
                                  pw.Text(
                                    currencyFormatter.format(grossEarnings),
                                    style: pw.TextStyle(
                                      font: boldFont,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Deductions Column
                    pw.Expanded(
                      child: pw.Container(
                        decoration: pw.BoxDecoration(
                          border: pw.Border.all(color: PdfColors.grey400),
                        ),
                        child: pw.Column(
                          children: [
                            pw.Container(
                              width: double.infinity,
                              padding: const pw.EdgeInsets.all(5),
                              color: PdfColors.grey200,
                              child: pw.Text(
                                "DEDUCTIONS",
                                textAlign: pw.TextAlign.center,
                                style: pw.TextStyle(
                                  font: boldFont,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                            _tableRow("Provident Fund", epf, font),
                            _tableRow(
                              "Professional Tax",
                              professionalTax,
                              font,
                            ),
                            _tableRow("TDS / Income Tax", tds, font),
                            _tableRow("Insurance", insurance, font),
                            pw.SizedBox(height: 60), // Match height
                            pw.Divider(color: PdfColors.grey400),
                            pw.Padding(
                              padding: const pw.EdgeInsets.all(8),
                              child: pw.Row(
                                mainAxisAlignment:
                                    pw.MainAxisAlignment.spaceBetween,
                                children: [
                                  pw.Text(
                                    "Total Deductions",
                                    style: pw.TextStyle(
                                      font: boldFont,
                                      fontSize: 11,
                                    ),
                                  ),
                                  pw.Text(
                                    currencyFormatter.format(totalDeductions),
                                    style: pw.TextStyle(
                                      font: boldFont,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                pw.SizedBox(height: 30),

                // Net Pay Section
                pw.Container(
                  padding: const pw.EdgeInsets.all(12),
                  decoration: pw.BoxDecoration(
                    color: PdfColors.blue900,
                    borderRadius: pw.BorderRadius.circular(4),
                  ),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(
                        "NET PAYABLE (Rounded)",
                        style: pw.TextStyle(
                          font: boldFont,
                          color: PdfColors.white,
                          fontSize: 14,
                        ),
                      ),
                      pw.Text(
                        currencyFormatter.format(netSalary),
                        style: pw.TextStyle(
                          font: boldFont,
                          color: PdfColors.white,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),

                pw.SizedBox(height: 10),
                pw.Text(
                  "Amount in words: Rupees ${NumberToWords.convert(netSalary.toInt())} Only",
                  style: pw.TextStyle(font: font, fontSize: 10),
                ),

                pw.Spacer(),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      children: [
                        pw.SizedBox(height: 40),
                        pw.Text(
                          "Employee Signature",
                          style: pw.TextStyle(font: font, fontSize: 10),
                        ),
                      ],
                    ),
                    pw.Column(
                      children: [
                        pw.SizedBox(height: 40),
                        pw.Text(
                          "Director Signature",
                          style: pw.TextStyle(font: font, fontSize: 10),
                        ),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 20),
                pw.Center(
                  child: pw.Text(
                    "This is a computer generated payslip.",
                    style: pw.TextStyle(
                      font: font,
                      fontSize: 9,
                      color: PdfColors.grey700,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
    );
  }

  pw.Widget _detailRow(String label, String value, pw.Font font, pw.Font bold) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        children: [
          pw.SizedBox(
            width: 80,
            child: pw.Text(
              label,
              style: pw.TextStyle(font: font, fontSize: 10),
            ),
          ),
          pw.Text(": ", style: pw.TextStyle(font: font, fontSize: 10)),
          pw.Text(value, style: pw.TextStyle(font: bold, fontSize: 10)),
        ],
      ),
    );
  }

  pw.Widget _tableRow(String label, double value, pw.Font font) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: pw.TextStyle(font: font, fontSize: 10)),
          pw.Text(
            currencyFormatter.format(value),
            style: pw.TextStyle(font: font, fontSize: 10),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: surfaceColor,
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: primaryColor,
            size: 20,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "Payroll & Earnings",
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: primaryColor,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(
              Icons.help_outline_rounded,
              color: subtitleColor,
              size: 20,
            ),
            onPressed: () {},
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          _buildTopSummary(),
          _buildTabBar(),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [_buildStructureTab(), _buildHistoryTab()],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopSummary() {
    return Container(
      width: double.infinity,
      color: surfaceColor,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF4F46E5), Color(0xFF818CF8)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6366F1).withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "NET TAKE-HOME (${DateFormat('MMMM yyyy').format(DateTime(DateTime.now().year, DateTime.now().month - 1, 1)).toUpperCase()})",
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              currencyFormatter.format(netSalary),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w900,
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _summarySmallItem(
                  "Earnings",
                  currencyFormatter.format(grossEarnings),
                  Colors.white.withOpacity(0.2),
                ),
                _summarySmallItem(
                  "Deductions",
                  currencyFormatter.format(totalDeductions),
                  Colors.black.withOpacity(0.1),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _summarySmallItem(String label, String value, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: surfaceColor,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: TabBar(
        controller: _tabController,
        labelColor: accentColor,
        unselectedLabelColor: subtitleColor,
        indicatorColor: accentColor,
        indicatorWeight: 3,
        indicatorPadding: const EdgeInsets.symmetric(horizontal: 20),
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        tabs: const [
          Tab(text: "Salary Structure"),
          Tab(text: "Payment History"),
        ],
      ),
    );
  }

  Widget _buildStructureTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildSectionTitle("Earnings Breakdown"),
        _buildListCard([
          {
            "label": "Basic Salary",
            "value": currencyFormatter.format(basicSalary),
          },
          {
            "label": "Special Allowance",
            "value": currencyFormatter.format(specialAllowance),
          },
          {
            "label": "Conveyance",
            "value": currencyFormatter.format(conveyance),
          },
          {"label": "LTA", "value": currencyFormatter.format(lta)},
          {
            "label": "Medical Allowance",
            "value": currencyFormatter.format(medicalAllowance),
          },
        ], isEarnings: true),
        const SizedBox(height: 24),
        _buildSectionTitle("Deductions"),
        _buildListCard([
          {
            "label": "Provident Fund (EPF)",
            "value": currencyFormatter.format(epf),
          },
          {
            "label": "Professional Tax",
            "value": currencyFormatter.format(professionalTax),
          },
          {"label": "TDS / Income Tax", "value": currencyFormatter.format(tds)},
          {"label": "Insurance", "value": currencyFormatter.format(insurance)},
        ], isEarnings: false),
        const SizedBox(height: 32),
        _buildDownloadAction(),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 12),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: subtitleColor,
        ),
      ),
    );
  }

  Widget _buildListCard(
    List<Map<String, String>> items, {
    required bool isEarnings,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        children: items.asMap().entries.map((entry) {
          final item = entry.value;
          final isLast = entry.key == items.length - 1;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item['label']!,
                      style: const TextStyle(
                        fontWeight: FontWeight.w500,
                        color: primaryColor,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      item['value']!,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: isEarnings
                            ? const Color(0xFF16A34A)
                            : const Color(0xFFDC2626),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isLast)
                const Divider(
                  height: 1,
                  color: borderColor,
                  indent: 16,
                  endIndent: 16,
                ),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildHistoryTab() {
    // Generate dynamic history: last 12 completed months from today
    final now = DateTime.now();
    final history = List.generate(12, (i) {
      final d = DateTime(now.year, now.month - 1 - i, 1);
      final monthNames = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
      ];
      return {
        'month': monthNames[d.month - 1],
        'year': d.year.toString(),
        'status': 'Processed',
        'amount': currencyFormatter.format(netSalary),
      };
    });

    final filteredHistory = history.where((item) {
      bool monthMatch = selectedMonth == "All" || item['month'] == selectedMonth;
      bool yearMatch = item['year'] == selectedYear;
      return monthMatch && yearMatch;
    }).toList();

    return Column(
      children: [
        _buildHistoryFilters(),
        Expanded(
          child: filteredHistory.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: filteredHistory.length,
                  itemBuilder: (context, index) {
                    final item = filteredHistory[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: surfaceColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: borderColor),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEF2FF),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.receipt_long_rounded,
                              color: accentColor,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "${item['month']} ${item['year']}",
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: primaryColor,
                                    fontSize: 15,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item['status']!,
                                  style: const TextStyle(
                                    color: Color(0xFF16A34A),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                item['amount']!,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: primaryColor,
                                  fontSize: 15,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.file_download_outlined,
                                  color: accentColor,
                                  size: 20,
                                ),
                                onPressed: () => _generatePdf(
                                  monthYear: "${item['month']} ${item['year']}",
                                ),
                                constraints: const BoxConstraints(),
                                padding: EdgeInsets.zero,
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildHistoryFilters() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      child: Row(
        children: [
          Expanded(
            child: _buildFilterDropdown(
              "Month",
              selectedMonth,
              months,
              (val) => setState(() => selectedMonth = val!),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildFilterDropdown(
              "Year",
              selectedYear,
              years,
              (val) => setState(() => selectedYear = val!),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterDropdown(
    String label,
    String value,
    List<String> items,
    void Function(String?) onChanged,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 20),
          style: const TextStyle(
            color: primaryColor,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
          items: items.map((String item) {
            return DropdownMenuItem(value: item, child: Text(item));
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history_rounded, size: 64, color: borderColor),
          const SizedBox(height: 16),
          const Text(
            "No records found",
            style: TextStyle(
              color: subtitleColor,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            "Try changing the filters",
            style: TextStyle(color: subtitleColor, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildDownloadAction() {
    final now = DateTime.now();
    final prevMonth = DateTime(now.year, now.month - 1, 1);
    final monthLabel = DateFormat('MMM yyyy').format(prevMonth);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.picture_as_pdf_rounded,
            color: Color(0xFFDC2626),
            size: 32,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Latest Month Payslip",
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: primaryColor,
                    fontSize: 14,
                  ),
                ),
                Text(
                  "Download PDF format ($monthLabel)",
                  style: const TextStyle(color: subtitleColor, fontSize: 11),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: _generatePdf,
            icon: const Icon(Icons.file_download_rounded, color: primaryColor),
          ),
        ],
      ),
    );
  }
}

class NumberToWords {
  static String convert(int number) {
    if (number == 0) return "Zero";
    if (number == 60500) return "Sixty Thousand Five Hundred";
    // Simple mock converter for common demo values
    return "${number.toString()} Only";
  }
}
