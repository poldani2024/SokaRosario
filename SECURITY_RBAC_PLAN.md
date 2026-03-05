# Propuesta de actualización: UX moderna + seguridad por niveles (RBAC + jerarquía)

## 1) Objetivo

Modernizar la app para que sea más simple de usar y, al mismo tiempo, reforzar seguridad para que cada nivel vea solo lo que le corresponde:

- **Admin**: acceso total.
- **SubRegión**: ve ciudades asignadas, sectores, hanes y miembros dentro de su alcance.
- **Ciudad**: ve sectores, hanes y miembros de sus ciudades asignadas.
- **Sector**: ve hanes y miembros de sus sectores asignados.
- **Responsable de Han**: ve miembros de sus hanes asignados.

## 2) Diseño de seguridad recomendado

### 2.1 Principio clave: seguridad en backend, no en frontend

Ocultar botones o pantallas en UI ayuda a UX, pero **no protege datos**. La autorización debe vivir en:

1. **Firestore Security Rules** (lectura/escritura de datos).
2. **Cloud Functions / backend** para operaciones sensibles.
3. **Custom Claims** (opcional) para checks rápidos de rol global.

### 2.2 Modelo de autorización híbrido (rol + alcance)

No alcanza con guardar solo `role`. También se necesita el **scope** (qué subregiones/ciudades/sectores/hanes puede ver).

Propuesta de documento por usuario:

```json
roles/{uid} {
  "role": "admin | subregion | ciudad | sector | han",
  "scope": {
    "subregionIds": ["sr-01"],
    "ciudadIds": ["ci-rosario"],
    "sectorIds": ["sec-centro"],
    "hanIds": ["han-123", "han-456"]
  },
  "active": true,
  "updatedAt": "serverTimestamp"
}
```

Regla general:
- **rol** define el nivel máximo.
- **scope** limita a qué entidades concretas accede.

## 3) Modelo de datos para soportar control de acceso

Para que las reglas sean eficientes, cada miembro debería tener referencias jerárquicas “materializadas”:

```json
miembros/{miembroId} {
  "nombre": "...",
  "hanId": "han-123",
  "sectorId": "sec-centro",
  "ciudadId": "ci-rosario",
  "subregionId": "sr-01",
  "...otrosCampos"
}
```

Así las reglas pueden validar acceso directo sin joins complejos.

## 4) Firestore Rules (enfoque)

Implementar helpers en reglas:

- `isSignedIn()`
- `myRole()`
- `myScope()`
- `canReadMember(memberData)`
- `canWriteMember(memberData)`

Lógica sugerida para lectura de `miembros`:

- Admin: `true`
- SubRegión: `member.subregionId in myScope.subregionIds`
- Ciudad: `member.ciudadId in myScope.ciudadIds`
- Sector: `member.sectorId in myScope.sectorIds`
- Han: `member.hanId in myScope.hanIds`

Para escritura:
- Admin puede todo.
- Niveles inferiores solo edición limitada (ej. visitas/seguimiento), nunca reasignar jerarquía (`hanId/sectorId/ciudadId/subregionId`) salvo permisos explícitos.

## 5) Gestión de roles y cambios de alcance

No permitir que cliente escriba libremente `roles/{uid}`.

Recomendado:

- Solo **Admin** actualiza roles mediante:
  - panel admin + Cloud Function callable, o
  - panel admin con reglas estrictas (menos recomendable que function).
- Registrar auditoría (`audit_logs`) con:
  - quién cambió rol,
  - antes/después,
  - fecha.

## 6) UX/UI moderna (reemplazo de “flor de loto”)

Para un look más simple y moderno:

1. **Dashboard limpio** con cards por módulo (Miembros, Hanes, Sectores, Reportes, Administración).
2. **Menú lateral** colapsable + barra superior con búsqueda.
3. **Filtros jerárquicos** (Subregión > Ciudad > Sector > Han) con selección guiada.
4. **Tabla principal** con paginación, búsqueda y chips de estado.
5. **Acciones contextuales**: el usuario solo ve acciones permitidas por su rol/scope.

Importante: mostrar/ocultar en UI según permisos mejora usabilidad, pero la seguridad real sigue en reglas/backend.

## 7) Plan de implementación por etapas

1. **Definir taxonomía final** de roles (`admin`, `subregion`, `ciudad`, `sector`, `han`).
2. **Normalizar datos** de miembros con `hanId/sectorId/ciudadId/subregionId`.
3. **Crear `roles/{uid}` con scope** y script de migración inicial.
4. **Aplicar Firestore Rules** con funciones helper.
5. **Bloquear edición de roles** desde cliente común y mover a Cloud Function.
6. **Actualizar frontend** con nuevo dashboard y navegación lateral.
7. **Pruebas de autorización** por cada rol (casos allow/deny).
8. **Auditoría y monitoreo** (logs de cambios de permisos).

## 8) Matriz rápida de permisos (lectura)

- **Admin**: todos los miembros.
- **SubRegión**: miembros de subregiones asignadas.
- **Ciudad**: miembros de ciudades asignadas.
- **Sector**: miembros de sectores asignados.
- **Han**: miembros de hanes asignados.

## 9) Recomendaciones extra de hardening

- Activar **App Check** para reducir abuso de APIs.
- Forzar uso de índices y queries acotadas por scope.
- Evitar traer colecciones completas al cliente.
- Implementar principio de **mínimo privilegio** por defecto.
- Revisiones periódicas de permisos (recertificación).

---

Si querés, siguiente paso te puedo preparar una versión concreta de **Firestore Rules** y un ejemplo de **Cloud Function** para alta/baja de roles con auditoría.


## 10) Acceso por campo (Field-Level Security) y "mismo rol"

Sí, es totalmente viable. La forma más segura es combinar:

1. **Política configurable por rol** (colección `fieldPolicies/{role}`).
2. **Entrega de datos filtrada desde Cloud Function** (no lectura directa de campos sensibles desde cliente).

Ejemplo de política:

```json
fieldPolicies/LiderSector {
  "allowedFields": ["nombre", "telefono", "hanId", "sectorId", "zaimu"],
  "sameRoleHiddenFields": ["zaimu"],
  "canViewSameRole": true
}
```

Significado:
- `allowedFields`: campos visibles para ese rol.
- `sameRoleHiddenFields`: campos que se ocultan cuando el miembro visto tiene el mismo rol que quien consulta.
- `canViewSameRole`: habilita o bloquea ver fichas de personas del mismo rol.

Con esta política, por ejemplo, un líder de sector puede ver el campo `zaimu` en general, pero **no** cuando consulta a otro miembro con su mismo rol.

## 11) Pantalla configurable sugerida (Admin)

Crear una pantalla “Políticas de campos” donde Admin pueda:

1. Elegir rol objetivo.
2. Tildar campos permitidos (`allowedFields`).
3. Marcar campos ocultos entre pares del mismo rol (`sameRoleHiddenFields`).
4. Definir si ese rol puede o no ver miembros del mismo rol (`canViewSameRole`).
5. Guardar cambios con auditoría (`updatedBy`, `updatedAt`).

La UI puede ser simple (checkboxes por campo + switches), pero la aplicación debe consumir siempre la Cloud Function que devuelve datos ya filtrados.

