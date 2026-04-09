import Link from 'next/link'
import EntityCsvImporter from '@/components/entity-import/EntityCsvImporter'
import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell'
import { Button } from '@/components/ui/button'

export default function EntityImportPage() {
  return (
    <AppPageShell>
      <AppPageHeader
        eyebrow="Intake pipeline"
        title="Import entities from CSV"
        description="Upload new entities, map the required fields, and register them for the end-to-end intelligence pipeline."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/entity-browser">Open entity browser</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/rfps">Open RFPs</Link>
            </Button>
          </>
        }
      />
      <AppPageBody className="max-w-5xl">
        <EntityCsvImporter />
      </AppPageBody>
    </AppPageShell>
  )
}
