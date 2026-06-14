import { describe, it, expect } from 'vitest';
import { isRealEmailDomain } from '../validations';

describe('isRealEmailDomain', () => {
  it('should accept valid common email domains', () => {
    expect(isRealEmailDomain('user@gmail.com')).toBe(true);
    expect(isRealEmailDomain('some.one@hotmail.com')).toBe(true);
    expect(isRealEmailDomain('another_user@outlook.es')).toBe(true);
    expect(isRealEmailDomain('test@correo.itm.edu.co')).toBe(true);
  });

  it('should reject un-whitelisted corporate or country-specific domains', () => {
    expect(isRealEmailDomain('contact@evolutionlab.fit')).toBe(false);
    expect(isRealEmailDomain('admin@gymname.com.co')).toBe(false);
  });

  it('should reject invalid or dummy email domains', () => {
    expect(isRealEmailDomain('user@test.com')).toBe(false);
    expect(isRealEmailDomain('fake@example.com')).toBe(false);
    expect(isRealEmailDomain('someone@prueba.com')).toBe(false);
  });

  it('should reject temporary/disposable email domains', () => {
    expect(isRealEmailDomain('trash@yopmail.com')).toBe(false);
    expect(isRealEmailDomain('user@tempmail.com')).toBe(false);
    expect(isRealEmailDomain('test@10minutemail.com')).toBe(false);
  });

  it('should reject malformed email structures', () => {
    expect(isRealEmailDomain('no_at_symbol.com')).toBe(false);
    expect(isRealEmailDomain('multiple@@gmail.com')).toBe(false);
    expect(isRealEmailDomain('user@')).toBe(false);
    expect(isRealEmailDomain('@gmail.com')).toBe(false);
    expect(isRealEmailDomain('user@gmail')).toBe(false);
  });
});
