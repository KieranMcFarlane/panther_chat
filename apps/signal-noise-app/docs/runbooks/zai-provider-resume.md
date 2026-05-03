# Z.ai Provider Resume Runbook

Use this only after the Z.ai coding plan is active. Until then, the pipeline should remain paused with `provider_infrastructure_failure`.

1. Start the app only through `dev-full.sh`.

   ```bash
   bash scripts/dev-full.sh
   ```

2. Confirm the current provider pause and queued backlog.

   ```bash
   node scripts/admin/check-pipeline-provider-pause.cjs
   ```

   Expected before activation: `safe_to_resume: false`, `stop_reason: provider_infrastructure_failure`, and `active_runs: 0`.

3. Run the Z.ai smoke test.

   ```bash
   bash scripts/smoke-zai-inference.sh
   ```

   Expected after activation: exit code `0` with a small successful model response. Do not resume if this still returns insufficient balance.

4. Dry-run the guarded resume.

   ```bash
   node scripts/admin/resume-pipeline-after-provider-activation.cjs
   ```

   Expected: `safe_to_resume: true`. If it is false, inspect the smoke result and active run count.

5. Apply the resume only after the dry-run is safe.

   ```bash
   node scripts/admin/resume-pipeline-after-provider-activation.cjs --apply
   ```

6. Verify one entity moves through the pipeline before leaving it unattended.

   Confirm:
   - one entity is claimed;
   - the run enters `dossier_generation`;
   - nested question progress appears under `phase_details_by_phase.dossier_generation`;
   - `entity_dossiers` receives a partial or full row;
   - the worker advances to the next entity after completion or nonblocking failure.

If any step fails, keep the pause in place and inspect `node scripts/admin/check-pipeline-provider-pause.cjs` before changing control state manually.
