/**
 * Valida si un correo electrónico tiene una sintaxis correcta
 * y si su dominio pertenece a proveedores reales y activos.
 * Evita el uso de correos temporales, desechables o ficticios.
 */
export const isRealEmailDomain = (email: string): boolean => {
  if (!email) return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;

  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;

  // Lista negra de dominios falsos, de prueba o temporales conocidos
  const blacklist = [
    'test.com', 'example.com', 'prueba.com', 'inventado.com', 'falso.com',
    'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf',
    'tempmail.com', 'temp-mail.org', '10minutemail.com', 'mailinator.com',
    'dispostable.com', 'guerrillamail.com', 'sharklasers.com', 'trashmail.com'
  ];

  if (blacklist.some(b => domain === b || domain.endsWith('.' + b))) {
    return false;
  }

  // Lista blanca de dominios comunes garantizados (incluyendo variaciones de país)
  const commonDomains = [
    'gmail.com',
    'yahoo.com', 'yahoo.es', 'yahoo.com.mx', 'yahoo.cl', 'yahoo.co', 'yahoo.com.ar', 'yahoo.com.pe',
    'hotmail.com', 'hotmail.es', 'hotmail.com.mx', 'hotmail.cl', 'hotmail.co', 'hotmail.com.ar', 'hotmail.com.pe',
    'outlook.com', 'outlook.es', 'outlook.com.mx', 'outlook.cl', 'outlook.co', 'outlook.com.ar', 'outlook.com.pe',
    'live.com', 'live.es', 'live.cl', 'live.com.mx', 'live.co',
    'icloud.com', 'me.com', 'mac.com',
    'correo.itm.edu.co' // Correo institucional del creador
  ];

  // Si está en la lista blanca de dominios comunes, es válido. De lo contrario, se rechaza.
  return commonDomains.some(d => domain === d || domain.endsWith('.' + d));
};
