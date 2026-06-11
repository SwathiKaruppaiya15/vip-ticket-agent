import { Sidebar } from './Sidebar'
import { Header }  from './Header'

interface PageWrapperProps {
  title:      string
  subtitle?:  string
  children:   React.ReactNode
  actions?:   React.ReactNode
  maxWidth?:  string
}

export function PageWrapper({
  title,
  subtitle,
  children,
  maxWidth = 'max-w-[1320px]',
}: PageWrapperProps) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0F172A' }}>
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <Header title={title} subtitle={subtitle} />

        <main className="flex-1 overflow-y-auto">
          <div className={`mx-auto ${maxWidth} px-4 sm:px-6 py-6 animate-fade-in`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
