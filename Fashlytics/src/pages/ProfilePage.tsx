import { Mail, MapPin, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'

export function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">User Profile</h1>
        <p className="page-subtitle mt-1">Your account details and workspace access.</p>
      </div>

      <section className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />
        <div className="px-6 pb-6">
          <div className="-mt-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar name="Aarav Mehta" className="size-16 text-lg ring-4 ring-surface dark:ring-surface-2-dark" />
              <div>
                <p className="text-lg font-semibold text-ink dark:text-ink-dark">Aarav Mehta</p>
                <p className="text-[13px] text-ink-2 dark:text-ink-2-dark">Data Analytics Lead</p>
              </div>
            </div>
            <Badge tone="brand">Pro workspace</Badge>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3 dark:border-edge-dark dark:bg-surface-dark">
              <Mail className="size-4 text-ink-3 dark:text-ink-3-dark" />
              <div>
                <dt className="text-[11px] text-ink-3 dark:text-ink-3-dark">Email</dt>
                <dd className="text-[13px] font-medium text-ink dark:text-ink-dark">aarav@example.com</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3 dark:border-edge-dark dark:bg-surface-dark">
              <MapPin className="size-4 text-ink-3 dark:text-ink-3-dark" />
              <div>
                <dt className="text-[11px] text-ink-3 dark:text-ink-3-dark">Location</dt>
                <dd className="text-[13px] font-medium text-ink dark:text-ink-dark">Bengaluru, India</dd>
              </div>
            </div>
          </dl>
        </div>
      </section>

      <section className="card flex items-center gap-3 px-5 py-4">
        <ShieldCheck className="size-5 text-emerald-500" />
        <div>
          <p className="text-sm font-medium text-ink dark:text-ink-dark">Workspace access</p>
          <p className="text-xs text-ink-2 dark:text-ink-2-dark">
            You can read all catalogue, brand, category and quality views. Data is served read-only from the warehouse.
          </p>
        </div>
      </section>
    </div>
  )
}
