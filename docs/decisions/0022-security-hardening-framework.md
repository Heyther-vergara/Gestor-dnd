# 0022 — Seguridad guiada por SOC 2 e ISO 27001

- Fecha: 2026-11-25
- Estado: aceptada

## Contexto

El proyecto ya tenía buenas bases (RLS en Supabase, sin secretos en el repo, todo lo externo validado con Zod), pero no una forma ordenada de decidir qué falta. Además, los avisos de seguridad de Next.js que arregló el PR #24 se descubrieron a mano: nada hubiera avisado.

SOC 2 (Trust Services Criteria) e ISO/IEC 27001:2022 (Anexo A) son los marcos más usados para eso. Certificarse no tiene sentido para un proyecto personal (cuesta miles de dólares y exige una organización), pero sus controles sirven como lista de preguntas.

## Decisión

1. **Usar los dos marcos como guía, sin certificar.** El análisis de brechas y el plan por pasos viven fuera del repo (carpeta de revisión del proyecto); cada paso es un PR pequeño que cita los controles que cierra.
2. **Un control cuenta solo si deja evidencia**: un check de CI, un archivo de configuración, un documento o una captura del panel.
3. **Primer paso en el repo: CI como guardián de los cambios** (SOC 2 CC7.1, CC8.1 · ISO 27001 A.8.8, A.8.25, A.8.32):
   - `pnpm build` en CI, para que un error de compilación no llegue a Vercel.
   - `pnpm audit --prod --audit-level high` en CI: falla si una dependencia de producción tiene un aviso alto o crítico. Solo `--prod`, porque las herramientas de desarrollo no llegan al navegador ni al servidor.
   - `permissions: contents: read` y `persist-credentials: false`: el token de CI solo lee (mínimo privilegio, A.8.2).
   - `timeout-minutes` para que un paso colgado no corra por horas.
   - **Dependabot** semanal para npm y GitHub Actions, con menores y parches agrupados en un PR. Los mayores de Next.js se suben a mano, porque cambian APIs.
4. **Fuera del repo (lo hace el dueño en los paneles):** 2FA en GitHub, Vercel y Supabase, y un ruleset que protege `main` (solo por PR, CI en verde, sin force push ni borrado).

## Consecuencias

- Un PR con un aviso alto nuevo en producción queda en rojo hasta que se actualice la dependencia. Si un aviso no tiene arreglo y no nos afecta, se documenta y se ignora puntualmente en vez de apagar el chequeo.
- CI tarda un poco más (el build).
- Llegarán PR de Dependabot cada lunes. Se mergean si CI está en verde, igual que cualquier otro cambio.
- Pendiente para más adelante: fijar las acciones de GitHub por SHA en vez de por versión (protege de una acción comprometida), cuando Dependabot ya esté funcionando y pueda mantener esos SHA al día.
