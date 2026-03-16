'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type PipelineFormState = {
  name: string
  entity_type: string
  sport: string
  country: string
  source: string
  website: string
  league: string
  priority_score: string
}

const DEFAULT_FORM_STATE: PipelineFormState = {
  name: '',
  entity_type: 'FEDERATION',
  sport: '',
  country: '',
  source: 'single_entity_form',
  website: '',
  league: '',
  priority_score: '50',
}

export default function SingleEntityPipelineForm() {
  const router = useRouter()
  const [formState, setFormState] = useState<PipelineFormState>(DEFAULT_FORM_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/entity-pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formState,
          priority_score: Number(formState.priority_score || 50),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to queue entity pipeline')
      }

      router.push(result.runDetailUrl)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Failed to queue entity pipeline')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm text-slate-700">
          Name
          <input
            required
            name="name"
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          Entity type
          <input
            required
            name="entity_type"
            value={formState.entity_type}
            onChange={(event) => setFormState((current) => ({ ...current, entity_type: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          Sport
          <input
            required
            name="sport"
            value={formState.sport}
            onChange={(event) => setFormState((current) => ({ ...current, sport: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          Country
          <input
            required
            name="country"
            value={formState.country}
            onChange={(event) => setFormState((current) => ({ ...current, country: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          Source
          <input
            required
            name="source"
            value={formState.source}
            onChange={(event) => setFormState((current) => ({ ...current, source: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          Website
          <input
            name="website"
            value={formState.website}
            onChange={(event) => setFormState((current) => ({ ...current, website: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          League
          <input
            name="league"
            value={formState.league}
            onChange={(event) => setFormState((current) => ({ ...current, league: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          Priority score
          <input
            name="priority_score"
            type="number"
            min="0"
            max="100"
            value={formState.priority_score}
            onChange={(event) => setFormState((current) => ({ ...current, priority_score: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? 'Queueing…' : 'Queue entity'}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </form>
    </section>
  )
}
