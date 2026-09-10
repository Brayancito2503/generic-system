# Rule: Strict Zero Assumptions Policy (Prohibición de Suposiciones)

## Directriz Obligatoria para Agentes de IA

Cualquier agente de IA o desarrollador que opere en este workspace DEBE cumplir estrictamente con las siguientes normas:

1. **PROHIBIDO SUPONER**: NUNCA adivines ni infieras nombres de variables, rutas de archivo, esquemas de base de datos (`schema.prisma`), props de React ni tipos de TypeScript.
2. **VERIFICAR SIEMPRE EL CÓDIGO REAL**: Antes de redactar o modificar cualquier archivo, debes inspeccionar el código fuente authoritative utilizando las herramientas de búsqueda y lectura (`view_file`, `grep_search`).
3. **PREGUNTAR ANTE CUALQUIER AMBIGÜEDAD**: Si el usuario realiza una solicitud que contenga detalles ambiguos o poco especificados, DEBES detenerte y hacer las preguntas aclaratorias necesarias antes de implementar una solución basada en suposiciones.
4. **GARANTIZAR AISLAMIENTO MULTI-TENANT**: Toda interacción con la base de datos o los repositorios debe incluir obligatoriamente la validación y filtrado por `tenantId`.
