// src/utils/securityUtils.ts

/**
 * Giriş (input) verisinin güvenli olup olmadığını kontrol eder.
 * NoSQL injection'da kullanılan yaygın karakterleri engeller.
 * @param input Kontrol edilecek metin.
 * @returns 'true' eğer güvenliyse, 'false' eğer yasaklı karakter içeriyorsa.
 */
export const isValidInput = (input: string): boolean => {
  // Firestore/NoSQL injection'da kullanılan karakterler
  // ($, {, }, [, ])
  const injectionPattern = /[\$\{\}\[\]]/;

  if (input === null || input === undefined) {
    return false;
  }

  // Eğer string boşsa veya yasaklı karakter İÇERMİYORSA, geçerlidir.
  return input.length === 0 || !injectionPattern.test(input);
};