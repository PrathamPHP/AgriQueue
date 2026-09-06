/**
 * Validation utilities for AgriQueue
 */

export interface ValidationResult {
  isValid: boolean;
  cleanDigits: string;
  error: string;
}

/**
 * Validates Aadhaar format:
 * - Accept exactly 12 digits
 * - Allow only numeric characters
 * - Remove/ignore accidental spaces
 * - Do not allow letters or special characters
 * - Error message: "Enter a valid 12-digit Aadhaar number."
 * - Prototype only: Format validation only (no UIDAI claims)
 */
export function validateAadhaar(aadhaar: string): ValidationResult {
  const cleanDigits = (aadhaar || '').replace(/\s+/g, '');

  if (!cleanDigits) {
    return {
      isValid: false,
      cleanDigits: '',
      error: 'Enter a valid 12-digit Aadhaar number.',
    };
  }

  // Reject letters or special characters
  if (!/^\d+$/.test(cleanDigits)) {
    return {
      isValid: false,
      cleanDigits,
      error: 'Enter a valid 12-digit Aadhaar number.',
    };
  }

  // Require exactly 12 digits
  if (cleanDigits.length !== 12) {
    return {
      isValid: false,
      cleanDigits,
      error: 'Enter a valid 12-digit Aadhaar number.',
    };
  }

  return {
    isValid: true,
    cleanDigits,
    error: '',
  };
}

export function validateMobile(mobile: string): { isValid: boolean; cleanDigits: string; error: string } {
  const cleanDigits = (mobile || '').replace(/\D/g, '');
  if (!cleanDigits || cleanDigits.length !== 10) {
    return {
      isValid: false,
      cleanDigits,
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }
  return {
    isValid: true,
    cleanDigits,
    error: '',
  };
}

export function validateName(name: string): { isValid: boolean; error: string } {
  if (!name || !name.trim()) {
    return {
      isValid: false,
      error: 'Please enter your full name.',
    };
  }
  return {
    isValid: true,
    error: '',
  };
}
