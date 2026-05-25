export function formatInvoiceMoney(value: number): string {
  return `INR ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function numberToWords(num: number): string {
  if (num === 0) return 'INR Zero Rupees Only';

  const rounded = Math.round(num * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
      if (n > 0) str += 'And ';
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  }

  function convertRupees(n: number): string {
    if (n === 0) return '';
    let res = '';

    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    if (crore > 0) {
      res += convertLessThanThousand(crore) + ' Crore, ';
    }

    const lakh = Math.floor(n / 100000);
    n %= 100000;
    if (lakh > 0) {
      res += convertLessThanThousand(lakh) + ' Lakh, ';
    }

    const thousand = Math.floor(n / 1000);
    n %= 1000;
    if (thousand > 0) {
      res += convertLessThanThousand(thousand) + ' Thousand, ';
    }

    if (n > 0) {
      res += convertLessThanThousand(n);
    }

    res = res.trim();
    if (res.endsWith(',')) {
      res = res.slice(0, -1);
    }
    return res;
  }

  let words = 'INR ';
  const rupeePart = convertRupees(rupees);
  if (rupeePart) {
    words += rupeePart + ' Rupees';
  } else {
    words += 'Zero Rupees';
  }

  if (paise > 0) {
    words += ' And ' + convertLessThanThousand(paise) + ' Paise';
  }

  words += ' Only';
  return words.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/,\s*Rupees/g, ' Rupees').trim();
}
