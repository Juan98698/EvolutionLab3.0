# Recuperación de contraseña

La recuperación usa el código de un solo uso enviado por Supabase. El formulario de contraseña se muestra después de verificarlo con `verifyOtp({ type: 'recovery' })`. Antes de guardar se comprueba otra vez que la sesión existe y pertenece al usuario verificado. Un enlace vencido o una sesión diferente lleva a solicitar otro código.

El cliente también escucha `PASSWORD_RECOVERY` desde su creación para conservar compatibilidad con enlaces anteriores. No depende de que el hash siga presente cuando se carga la pantalla de acceso. Durante una recarga, solo conserva el identificador verificado y su fecha en `sessionStorage`, durante 30 minutos; nunca guarda allí códigos, contraseñas, enlaces o JWT. Al completar el cambio o cerrar sesión elimina ese estado.

## Configuración del correo

Después de desplegar esta versión, en el proyecto de producción de Supabase:

1. Authentication → Emails → Templates → Reset password.
2. Asunto: `Tu código de recuperación · Evolution Lab`.
3. Copiar `supabase/templates/recovery.html` en Source y guardar.
4. La plantilla debe conservar `{{ .Token }}` y el enlace público `https://evolutionlab.fit/login?recovery=code`. El enlace abre el formulario sin consumir el código.

SMTP usa Resend con el dominio verificado `auth.evolutionlab.fit` y el remitente `acceso@auth.evolutionlab.fit`. No introducir claves privadas en el repositorio.

## Verificación

- Pruebas de interfaz: código inválido, formulario bloqueado antes de verificar, sesión ausente o de otra cuenta, evento anterior a la carga de Login y conservación tras recarga.
- `node scripts/verify-password-recovery.mjs`: comprobación real con una cuenta desechable. Genera un código por la API administrativa sin enviar correo, lo verifica con la clave pública, cambia la contraseña, cierra sesión, vuelve a entrar y rechaza reutilizar el código. Elimina la cuenta al terminar y no imprime credenciales.
- El 14 de noviembre de 2026 pasaron esas operaciones remotas. La entrega real del correo se comprobó aparte en Resend y fue confirmada por el usuario.
- El usuario confirmó la comprobación final desde su correo: verificó el código, guardó una contraseña nueva y volvió a entrar. Las contraseñas y códigos los introdujo directamente en la plataforma.
