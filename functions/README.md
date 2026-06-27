# Cloud Functions — Pagos con tarjeta verificados (PagueloFácil)

Backend del **Plan C**: cobro con tarjeta + verificación del pago contra PagueloFácil.

## Funciones
- `createCardPayment` (`POST /pf/create`) — crea el cobro en PagueloFácil con el
  código de comercio (CCLW, secreto) y devuelve la URL de checkout de un solo uso.
- `pfReturn` (`POST /pf/return`) — recibe el resultado de PagueloFácil, verifica la
  operación de forma independiente y escribe el aporte en Firestore (`verified:true`
  sólo si la API confirma). Luego redirige al donante a la app.

Ambas se exponen en el mismo dominio vía *rewrites* de Hosting (ver `firebase.json`).

## Pasos para desplegar (una sola vez)

> Requiere el proyecto en plan **Blaze** (Cloud Functions).

```bash
# 1) Activar Blaze en la consola de Firebase (Configuración → Uso y facturación).

# 2) Cargar los secretos de PagueloFácil (NO van en git):
firebase functions:secrets:set PF_CCLW     # Código web del comercio
firebase functions:secrets:set PF_TOKEN    # Token de API REST (verificación)

# 3) Instalar dependencias:
cd functions && npm install && cd ..

# 4) Desplegar funciones + reglas + hosting:
npm run build
firebase deploy --only functions,firestore:rules,hosting
```

## Pendiente de confirmar con credenciales reales
- **Endpoint REST de verificación** (`verifyOperation` en `index.js`): ajustar la URL
  y el formato de respuesta según la colección Postman oficial de PagueloFácil
  (https://www.postman.com/paguelofacil/public). Mientras no confirme la aprobación,
  el aporte se guarda como pendiente (`verified:false`) — nunca como verificado.
- **Webhook/URL de retorno**: si PagueloFácil requiere habilitar el `RETURN_URL`
  por soporte, escribir a `customerservice@paguelofacil.com`.
- Probar primero en **sandbox** (`https://sandbox.paguelofacil.com/LinkDeamon.cfm`)
  cambiando `PF_LINK_URL` si se desea un entorno de pruebas.

## Notas
- Moneda: PagueloFácil cobra en **USD** (mínimo $1.00).
- Las reglas de Firestore impiden que un cliente marque `verified:true`; sólo estas
  funciones (Admin SDK) pueden hacerlo.
