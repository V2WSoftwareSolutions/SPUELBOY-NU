# 3D models

Drop glTF/GLB exports of the NU® devices here, for example:

- `nu-portable.glb`
- `nu-built-in.glb`
- `neptun-t2000.glb`

Then point `viewer.modelUrl` at them in `src/app/core/data/nu-products.data.ts`
(e.g. `/models/nu-portable.glb`).

Name the export's materials `NU_Housing`, `NU_Trim` and `NU_Brush` (`NEP_Pot`,
`NEP_Trim` and `NEP_Brush` for the Neptun T2000) so the
personalisation swatches keep repainting the model live. Until a file is added,
the viewer builds the device from procedural geometry instead.
