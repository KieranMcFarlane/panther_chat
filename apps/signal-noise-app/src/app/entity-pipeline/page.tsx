import SingleEntityPipelineForm from '@/components/entity-import/SingleEntityPipelineForm'

export const dynamic = 'force-dynamic'

export default function EntityPipelinePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Entity pipeline
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Queue a single entity</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Use this form when you want to send one entity through dossier generation, discovery,
            Ralph validation, temporal persistence, and final scoring without preparing a CSV.
          </p>
        </section>

        <SingleEntityPipelineForm />
      </div>
    </main>
  )
}
