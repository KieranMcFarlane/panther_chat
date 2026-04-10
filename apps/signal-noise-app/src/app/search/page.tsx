import VectorSearch from '@/components/ui/VectorSearch-debounced'
import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell'

export default function SearchPage() {
  return (
    <AppPageShell size="narrow">
      <AppPageHeader
        eyebrow="Search"
        title="Find entities, tenders, and people"
        description="Use vector search to jump directly into a dossier, tender trail, or known point of contact without browsing the full entity list first."
      />
        <AppPageBody>
          <section className="rounded-3xl border border-custom-border bg-custom-box/80 p-6 shadow-sm backdrop-blur sm:p-8">
          <VectorSearch className="w-full justify-start" defaultOpen />
          </section>
        </AppPageBody>
      </AppPageShell>
  )
}
