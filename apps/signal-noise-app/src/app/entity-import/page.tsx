import EntityCsvImporter from '@/components/entity-import/EntityCsvImporter'

export default function EntityImportPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Intake pipeline
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950">Import entities from CSV</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600">
            Use this page to upload new entities, map the required fields, and register them for the
            end-to-end intelligence pipeline.
          </p>
        </div>

        <EntityCsvImporter />
      </div>
    </main>
  )
}
