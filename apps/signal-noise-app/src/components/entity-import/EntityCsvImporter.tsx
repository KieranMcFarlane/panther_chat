'use client'

import { useEffect, useState } from 'react'
import { Importer, ImporterField } from 'react-csv-importer'
import 'react-csv-importer/dist/index.css'
import { REQUIRED_ENTITY_IMPORT_COLUMNS, OPTIONAL_ENTITY_IMPORT_COLUMNS } from '@/lib/entity-import-schema'

type ImportSummary = {
  batchId?: string
  acceptedRows?: number
  created_rows?: number
  updated_rows?: number
  invalid_rows?: Array<{ index: number; errors: string[] }>
}

type BatchStatus = {
  batch: {
    id: string
    status: string
    created_rows: number
    updated_rows: number
    invalid_rows: number
  } | null
  pipeline_runs: Array<{
    id: string
    entity_id: string
    entity_name: string
    phase: string
    status: string
    error_message: string | null
    dossier_id: string | null
    sales_readiness: string | null
    rfp_count: number
    metadata: Record<string, unknown>
  }>
}

export default function EntityCsvImporter() {
  const [batchId, setBatchId] = useState<string | null>(null)
  const [acceptedRows, setAcceptedRows] = useState(0)
  const [rejectedRows, setRejectedRows] = useState<Array<{ index: number; errors: string[] }>>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)
  const [pipelineStarted, setPipelineStarted] = useState(false)

  useEffect(() => {
    if (!batchId) {
      return
    }

    let cancelled = false

    const startPipeline = async () => {
      if (pipelineStarted) {
        return
      }

      setPipelineStarted(true)
      const response = await fetch(`/api/entity-import/${batchId}/run`, {
        method: 'POST',
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        throw new Error(result.error || 'Failed to start entity pipeline')
      }
    }

    const loadBatchStatus = async () => {
      const response = await fetch(`/api/entity-import/${batchId}`)
      if (!response.ok) {
        return
      }

      const status = (await response.json()) as BatchStatus
      if (!cancelled) {
        setBatchStatus(status)
      }
    }

    void startPipeline().catch((error) => {
      if (!cancelled) {
        setPipelineStarted(false)
        setImportError(error instanceof Error ? error.message : 'Failed to start entity pipeline')
      }
    })

    void loadBatchStatus()
    const interval = window.setInterval(() => {
      void loadBatchStatus()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [batchId, pipelineStarted])

  const handleImport = async (rows: Array<Record<string, string>>) => {
    const response = await fetch('/api/entity-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows,
      }),
    })

    const result = (await response.json()) as ImportSummary & { error?: string }

    if (!response.ok) {
      throw new Error(result.error || 'Failed to import entity rows')
    }

    setBatchId(result.batchId ?? null)
    setAcceptedRows(result.acceptedRows ?? 0)
    setRejectedRows(result.invalid_rows ?? [])
    setImportError(null)
    setBatchStatus(null)
    setPipelineStarted(false)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">CSV entity import</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload a CSV, map the columns, and register entities into the shared intelligence system.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Required columns</h3>
            <p className="mt-2 text-xs text-slate-500">
              Required CSV headers: name, entity_type, sport, country, source
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {REQUIRED_ENTITY_IMPORT_COLUMNS.map((column) => (
                <li key={column}>{column}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Optional columns</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {OPTIONAL_ENTITY_IMPORT_COLUMNS.map((column) => (
                <li key={column}>{column}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Importer
          dataHandler={handleImport}
          chunkSize={200}
          restartable={false}
          onStart={() => {
            setImportError(null)
            setBatchId(null)
            setAcceptedRows(0)
            setRejectedRows([])
            setPipelineStarted(false)
          }}
          onClose={() => undefined}
          onComplete={() => undefined}
        >
          {REQUIRED_ENTITY_IMPORT_COLUMNS.map((column) => (
            <ImporterField key={column} name={column} label={column} />
          ))}
          {OPTIONAL_ENTITY_IMPORT_COLUMNS.map((column) => (
            <ImporterField key={column} name={column} label={column} optional />
          ))}
        </Importer>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Batch status</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>batchId: {batchId ?? 'Not started'}</p>
          <p>acceptedRows: {acceptedRows}</p>
          <p>rejectedRows: {rejectedRows.length}</p>
          <p>status: {batchStatus?.batch?.status ?? 'Waiting for batch'}</p>
          {importError ? <p className="text-red-600">{importError}</p> : null}
        </div>

        {batchStatus?.pipeline_runs?.length ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">Phase</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Sales readiness</th>
                  <th className="py-2 pr-4">RFP count</th>
                  <th className="py-2 pr-4">Dossier</th>
                </tr>
              </thead>
              <tbody>
                {batchStatus.pipeline_runs.map((run) => (
                  (() => {
                    const phaseMap = typeof run.metadata?.phases === 'object' && run.metadata?.phases !== null
                      ? (run.metadata.phases as Record<string, { status?: string; error?: string; reason?: string }>)
                      : {}
                    const phaseEntries = Object.entries(phaseMap)

                    return (
                      <tr key={run.id} className="border-b border-slate-100 align-top">
                        <td className="py-3 pr-4">{run.entity_name}</td>
                        <td className="py-3 pr-4">
                          <div>{run.phase}</div>
                          {phaseEntries.length ? (
                            <div className="mt-2 space-y-1 text-xs text-slate-500">
                              {phaseEntries.map(([phaseName, detail]) => (
                                <div key={phaseName}>
                                  {phaseName}: {detail.status ?? 'unknown'}
                                  {detail.reason ? ` (${detail.reason})` : ''}
                                  {detail.error ? ` - ${detail.error}` : ''}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          <div>{run.status}</div>
                          {run.error_message ? (
                            <div className="mt-1 text-xs text-red-600">{run.error_message}</div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">{run.sales_readiness ?? 'Pending'}</td>
                        <td className="py-3 pr-4">
                          <div>{run.rfp_count}</div>
                          {run.rfp_count > 0 ? (
                            <a
                              href="/rfps"
                              className="mt-1 inline-block text-xs text-sky-700 underline underline-offset-2"
                            >
                              View RFPs
                            </a>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          {run.dossier_id ? (
                            <a
                              href={`/entity-browser/${run.entity_id}/dossier?from=1`}
                              className="text-sky-700 underline underline-offset-2"
                            >
                              Open dossier
                            </a>
                          ) : (
                            'Pending'
                          )}
                        </td>
                      </tr>
                    )
                  })()
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
