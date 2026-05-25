export function numberToWords(num: number): string {
  if (num === 0) return 'INR Zero Rupees Only';

  const rounded = Math.round(num * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanThousand(value: number): string {
    if (value === 0) return '';
    let result = '';
    if (value >= 100) {
      result += `${ones[Math.floor(value / 100)]} Hundred `;
      value %= 100;
      if (value > 0) result += 'And ';
    }
    if (value >= 20) {
      result += `${tens[Math.floor(value / 10)]} `;
      value %= 10;
    }
    if (value > 0) result += `${ones[value]} `;
    return result.trim();
  }

  function convertRupees(value: number): string {
    if (value === 0) return '';
    let result = '';

    const crore = Math.floor(value / 10000000);
    value %= 10000000;
    if (crore > 0) result += `${convertLessThanThousand(crore)} Crore, `;

    const lakh = Math.floor(value / 100000);
    value %= 100000;
    if (lakh > 0) result += `${convertLessThanThousand(lakh)} Lakh, `;

    const thousand = Math.floor(value / 1000);
    value %= 1000;
    if (thousand > 0) result += `${convertLessThanThousand(thousand)} Thousand, `;

    if (value > 0) result += convertLessThanThousand(value);
    result = result.trim();
    return result.endsWith(',') ? result.slice(0, -1) : result;
  }

  let words = 'INR ';
  const rupeePart = convertRupees(rupees);
  words += rupeePart ? `${rupeePart} Rupees` : 'Zero Rupees';

  if (paise > 0) words += ` And ${convertLessThanThousand(paise)} Paise`;

  words += ' Only';
  return words.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/,\s*Rupees/g, ' Rupees').trim();
}
