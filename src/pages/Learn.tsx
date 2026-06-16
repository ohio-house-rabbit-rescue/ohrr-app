import { learnLinks } from '../data/ohrr'
import { PageHeader, Screen, ExternalCard } from '../components/ui'

export default function Learn() {
  return (
    <>
      <PageHeader
        icon="book"
        title="Rabbit Care"
        subtitle="Good care means happier rabbits — and fewer surrenders. Here are the essentials."
      />
      <Screen className="space-y-2.5">
        {learnLinks.map((l) => (
          <ExternalCard key={l.title} href={l.url} title={l.title} description={l.description} icon={l.icon} />
        ))}
      </Screen>
    </>
  )
}
